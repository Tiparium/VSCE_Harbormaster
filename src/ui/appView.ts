import * as vscode from 'vscode';

import { AccentGroupDefinition, AccentSectionDefinition, getAccentPickerHtml } from './accentPicker';

type AppCommand =
  | 'projectWindowTitle.createConfig'
  | 'projectWindowTitle.openConfig'
  | 'projectWindowTitle.refresh'
  | 'projectWindowTitle.setWindowAccent'
  | 'projectWindowTitle.resetWindowAccent'
  | 'projectWindowTitle.rebuildState'
  | 'projectWindowTitle.addGlobalTag'
  | 'projectWindowTitle.removeGlobalTag'
  | 'projectWindowTitle.assignTag'
  | 'projectWindowTitle.removeProjectTag'
  | 'projectWindowTitle.addProjectToCatalog'
  | 'projectWindowTitle.openProjectFromCatalog'
  | 'projectWindowTitle.showMenu'
  | 'projectWindowTitle.createHarbormasterProject'
  | 'projectWindowTitle.openGlobalTags';

type AppSection = {
  title: string;
  description?: string;
  headerActions?: { label: string; command: AppCommand; variant?: 'open' | 'create' }[];
  actions: { label: string; command: AppCommand }[];
};

export type HealthSnapshot = {
  missing: string[];
  corrupt: string[];
  legacy: string[];
};

export type AppViewTracker = {
  onDidChange: vscode.Event<void>;
  getCurrentProjectInfo(settings: any): Promise<{
    name?: string;
    version?: string;
    tags?: string[];
    windowAccent?: string;
    windowAccentSections?: Record<string, string>;
    windowAccentGroups?: Record<string, string>;
    windowAccentSectionsInherit?: Record<string, boolean>;
    windowAccentGroupsInherit?: Record<string, boolean>;
  windowAccentOverrides?: Record<string, string>;
  windowAccentHistory?: Record<string, string[]>;
  windowAccentHighlightBoost?: number;
} | undefined>;
  getHealthSnapshot(): Promise<HealthSnapshot | undefined>;
  projectConfigExists(settings: any): Promise<boolean>;
  tagsFileExists(settings: any): Promise<boolean>;
  isCurrentProjectInCatalog(settings: any): Promise<boolean>;
  isHarbormasterProject(settings: any): Promise<boolean>;
  setWindowAccentColor(accent: string | undefined): Promise<void>;
  setWindowAccentSection(sectionId: string, accent: string | undefined): Promise<void>;
  setWindowAccentSectionInherit(sectionId: string, inherit: boolean): Promise<void>;
  setWindowAccentGroup(groupId: string, accent: string | undefined): Promise<void>;
  setWindowAccentGroupInherit(groupId: string, inherit: boolean): Promise<void>;
  setWindowAccentOverride(key: string, accent: string | undefined): Promise<void>;
  recordWindowAccentHistory(groupId: string, accent: string): Promise<void>;
  previewWindowAccentGroup(groupId: string, accent: string | undefined): Promise<void>;
  previewWindowAccentSection(sectionId: string, accent: string | undefined): Promise<void>;
  resetWindowAccentColor(): Promise<void>;
  clearWindowAccentLayers(): Promise<void>;
  swapWindowAccentBackup(): Promise<boolean>;
  saveColorPreset(): Promise<void>;
  applyColorPreset(): Promise<void>;
  reportInvalidAccentInput(scope: string, value: string): Promise<void>;
  clearInvalidAccentInput(): Promise<void>;
  setWindowAccentHighlightBoost(value: number | undefined, preview?: boolean): Promise<void>;
};

export class HarbormasterAppViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private mode: 'home' | 'accent' = 'home';

  constructor(
    private readonly tracker: AppViewTracker,
    private readonly getSettings: () => unknown,
    private readonly accentSections: AccentSectionDefinition[],
    private readonly accentGroups: AccentGroupDefinition[],
    private readonly normalizeAccentColor: (value: string | undefined) => string | undefined,
    private readonly normalizeAccentSections: (value: unknown) => Record<string, string>,
    private readonly normalizeAccentGroups: (value: unknown) => Record<string, string>,
    private readonly normalizeAccentSectionInherit: (value: unknown) => Record<string, boolean>,
    private readonly normalizeAccentGroupInherit: (value: unknown) => Record<string, boolean>,
    private readonly normalizeAccentOverrides: (value: unknown) => Record<string, string>,
    private readonly normalizeAccentHistory: (value: unknown) => Record<string, string[]>,
    private readonly version: string,
    private readonly devToolsEnabled: boolean,
    private readonly extensionUri: vscode.Uri
  ) {
    this.tracker.onDidChange(() => void this.refresh());
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'resources')],
    };
    view.webview.onDidReceiveMessage(async (message) => {
      if (!message || typeof message !== 'object') {
        return;
      }
      if (message.type === 'navigateHome') {
        this.setMode('home');
        return;
      }
      if (message.type === 'uiError' && typeof message.message === 'string') {
        void vscode.window.showErrorMessage(`Harbormaster UI error: ${message.message}`);
        return;
      }
      if (message.type === 'command' && typeof message.command === 'string') {
        if (message.command === 'projectWindowTitle.setWindowAccent') {
          this.setMode('accent');
          return;
        }
        await vscode.commands.executeCommand(message.command);
      }
      if (this.mode === 'accent') {
        await this.handleAccentMessage(message);
      }
      if (message.type === 'refresh') {
        await this.refresh();
      }
    });
    void this.refresh();
  }

  setMode(mode: 'home' | 'accent'): void {
    if (this.mode === mode) {
      void this.reveal();
      return;
    }
    this.mode = mode;
    void this.refresh();
    void this.reveal();
  }

  async reveal(): Promise<void> {
    if (this.view) {
      this.view.show?.(true);
    }
  }

  async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    const settings = this.getSettings();
    const toolkitUri = this.getToolkitUri(this.view.webview);
    const stylesheetUri = this.getStylesheetUri(this.view.webview);
    if (this.mode === 'accent') {
      await this.renderAccentView(settings, toolkitUri, stylesheetUri);
      return;
    }
    const info = await this.tracker.getCurrentProjectInfo(settings);
    const themeCss = buildHarbormasterThemeCss(
      this.normalizeAccentColor(info?.windowAccent),
      this.normalizeAccentSections(info?.windowAccentSections),
      this.normalizeAccentGroups(info?.windowAccentGroups),
      this.normalizeAccentSectionInherit(info?.windowAccentSectionsInherit),
      this.normalizeAccentGroupInherit(info?.windowAccentGroupsInherit),
      this.normalizeAccentOverrides(info?.windowAccentOverrides)
    );
    const health = await this.tracker.getHealthSnapshot();
    const configExists = await this.tracker.projectConfigExists(settings);
    const tagsExists = await this.tracker.tagsFileExists(settings);
    const inCatalog = await this.tracker.isCurrentProjectInCatalog(settings);
    const isHarbormasterProject = await this.tracker.isHarbormasterProject(settings);

    this.view.webview.html = getAppHtml({
      name: info?.name,
      version: info?.version,
      tags: info?.tags ?? [],
      health,
      configExists,
      tagsExists,
      inCatalog,
      isHarbormasterProject,
      versionLabel: `${this.version}${this.devToolsEnabled ? ' [DEV]' : ''}`,
      themeCss,
      toolkitUri,
      stylesheetUri,
    });
  }

  notifyThemeDefaults(): void {
    if (!this.view || this.mode !== 'accent') {
      return;
    }
    void this.view.webview.postMessage({ type: 'themeDefaults' });
  }

  private async renderAccentView(settings: unknown, toolkitUri: string, stylesheetUri: string): Promise<void> {
    const info = await this.tracker.getCurrentProjectInfo(settings);
    const baseExplicit = this.normalizeAccentColor(info?.windowAccent);
    const baseColor = baseExplicit ?? '';
    const sectionColors = this.normalizeAccentSections(info?.windowAccentSections);
    const groupColors = this.normalizeAccentGroups(info?.windowAccentGroups);
    const sectionInherit = this.normalizeAccentSectionInherit(info?.windowAccentSectionsInherit);
    const groupInherit = this.normalizeAccentGroupInherit(info?.windowAccentGroupsInherit);
    const overrides = this.normalizeAccentOverrides(info?.windowAccentOverrides);
    const groupHistory = this.normalizeAccentHistory(info?.windowAccentHistory);
    const highlightBoost =
      typeof info?.windowAccentHighlightBoost === 'number' ? info.windowAccentHighlightBoost : undefined;
    const themeCss = buildHarbormasterThemeCss(
      this.normalizeAccentColor(info?.windowAccent),
      this.normalizeAccentSections(info?.windowAccentSections),
      this.normalizeAccentGroups(info?.windowAccentGroups),
      this.normalizeAccentSectionInherit(info?.windowAccentSectionsInherit),
      this.normalizeAccentGroupInherit(info?.windowAccentGroupsInherit),
      this.normalizeAccentOverrides(info?.windowAccentOverrides)
    );
    this.view!.webview.html = getAccentPickerHtml(
      baseColor,
      sectionColors,
      groupColors,
      sectionInherit,
      groupInherit,
      overrides,
      groupHistory,
      this.accentSections,
      this.accentGroups,
      {
        showBackButton: true,
        backLabel: 'Back',
        useThemeDefault: !baseExplicit,
        defaultBaseColor: '#181818',
        themeCss,
        highlightBoost,
        toolkitUri,
        stylesheetUri,
      }
    );
  }

  private async handleAccentMessage(message: any): Promise<void> {
    if (message.type === 'invalidHex' && typeof message.scope === 'string') {
      const value = typeof message.value === 'string' ? message.value : '';
      await this.tracker.reportInvalidAccentInput(message.scope, value);
      return;
    }
    if (message.type === 'clearInvalidHex' && typeof message.scope === 'string') {
      await this.tracker.clearInvalidAccentInput();
      return;
    }
    if (message.type === 'setHighlightBoost' && typeof message.value === 'number') {
      const preview = Boolean(message.preview);
      await this.tracker.setWindowAccentHighlightBoost(message.value, preview);
      return;
    }
    const normalizeAccentColor = this.normalizeAccentColor;
    if (message.type === 'applyBase' && typeof message.value === 'string') {
      const normalized = normalizeAccentColor(message.value);
      if (!normalized) {
        void vscode.window.showErrorMessage('Harbormaster: Invalid hex color. Use #RRGGBB or #RGB.');
        return;
      }
      await this.tracker.setWindowAccentColor(normalized);
      await this.tracker.recordWindowAccentHistory('base', normalized);
      await this.refresh();
      return;
    }
    if (message.type === 'clearBase') {
      await this.tracker.setWindowAccentColor(undefined);
      await this.refresh();
      return;
    }
    if (message.type === 'clearAll') {
      await this.tracker.resetWindowAccentColor();
      await this.refresh();
      return;
    }
    if (message.type === 'clearAllButBase') {
      await this.tracker.clearWindowAccentLayers();
      await this.refresh();
      return;
    }
    if (message.type === 'swapBackup') {
      const swapped = await this.tracker.swapWindowAccentBackup();
      void vscode.window.showInformationMessage(
        swapped
          ? 'Harbormaster: swapped with backup.'
          : 'Harbormaster: no color backup available yet.'
      );
      await this.refresh();
      return;
    }
    if (message.type === 'savePreset') {
      await this.tracker.saveColorPreset();
      await this.refresh();
      return;
    }
    if (message.type === 'applyPreset') {
      await this.tracker.applyColorPreset();
      await this.refresh();
      return;
    }
    if (message.type === 'applySection' && typeof message.section === 'string' && typeof message.value === 'string') {
      const normalized = normalizeAccentColor(message.value);
      if (!normalized) {
        void vscode.window.showErrorMessage('Harbormaster: Invalid hex color. Use #RRGGBB or #RGB.');
        return;
      }
      await this.tracker.setWindowAccentSection(message.section, normalized);
      await this.tracker.recordWindowAccentHistory(message.section, normalized);
      await this.refresh();
      return;
    }
    if (message.type === 'inheritSection' && typeof message.section === 'string') {
      const enabled = typeof message.enabled === 'boolean' ? message.enabled : true;
      await this.tracker.setWindowAccentSectionInherit(message.section, enabled);
      await this.refresh();
      return;
    }
    if (message.type === 'clearSection' && typeof message.section === 'string') {
      await this.tracker.setWindowAccentSection(message.section, undefined);
      await this.refresh();
      return;
    }
    if (message.type === 'applyGroup' && typeof message.group === 'string' && typeof message.value === 'string') {
      const normalized = normalizeAccentColor(message.value);
      if (!normalized) {
        void vscode.window.showErrorMessage('Harbormaster: Invalid hex color. Use #RRGGBB or #RGB.');
        return;
      }
      await this.tracker.setWindowAccentGroup(message.group, normalized);
      await this.tracker.recordWindowAccentHistory(message.group, normalized);
      await this.refresh();
      return;
    }
    if (message.type === 'inheritGroup' && typeof message.group === 'string') {
      const enabled = typeof message.enabled === 'boolean' ? message.enabled : true;
      await this.tracker.setWindowAccentGroupInherit(message.group, enabled);
      await this.refresh();
      return;
    }
    if (message.type === 'clearGroup' && typeof message.group === 'string') {
      await this.tracker.setWindowAccentGroup(message.group, undefined);
      await this.refresh();
      return;
    }
    if (message.type === 'applyOverride' && typeof message.key === 'string' && typeof message.value === 'string') {
      const normalized = normalizeAccentColor(message.value);
      if (!normalized) {
        void vscode.window.showErrorMessage('Harbormaster: Invalid hex color. Use #RRGGBB or #RGB.');
        return;
      }
      await this.tracker.setWindowAccentOverride(message.key, normalized);
      await this.refresh();
      return;
    }
    if (message.type === 'clearOverride' && typeof message.key === 'string') {
      await this.tracker.setWindowAccentOverride(message.key, undefined);
      await this.refresh();
      return;
    }
    if (message.type === 'previewGroup' && typeof message.group === 'string') {
      const preview = normalizeAccentColor(typeof message.value === 'string' ? message.value : undefined);
      await this.tracker.previewWindowAccentGroup(message.group, preview);
    }
    if (message.type === 'previewSection' && typeof message.section === 'string') {
      const preview = normalizeAccentColor(typeof message.value === 'string' ? message.value : undefined);
      await this.tracker.previewWindowAccentSection(message.section, preview);
    }
  }

  private getToolkitUri(webview: vscode.Webview): string {
    const toolkitPath = vscode.Uri.joinPath(this.extensionUri, 'resources', 'webview-ui-toolkit.js');
    return webview.asWebviewUri(toolkitPath).toString();
  }

  private getStylesheetUri(webview: vscode.Webview): string {
    const stylesheetPath = vscode.Uri.joinPath(this.extensionUri, 'resources', 'harbormaster-ui.css');
    return webview.asWebviewUri(stylesheetPath).toString();
  }
}

type AppState = {
  name?: string;
  version?: string;
  tags: string[];
  health?: HealthSnapshot;
  configExists: boolean;
  tagsExists: boolean;
  inCatalog: boolean;
  isHarbormasterProject: boolean;
  versionLabel: string;
  themeCss: string;
  toolkitUri: string;
  stylesheetUri: string;
};

function getAppHtml(state: AppState): string {
  const name = state.name ?? 'Headless workspace';
  const version = state.version ?? 'No version set';
  const tags = state.tags.length ? state.tags : ['No tags'];
  const health = state.health;
  const configCommand: AppCommand = state.configExists
    ? 'projectWindowTitle.openConfig'
    : 'projectWindowTitle.createConfig';
  const openCatalogAction = {
    label: 'Open Project',
    command: 'projectWindowTitle.openProjectFromCatalog',
    variant: 'open',
  } as const;
  const createProjectAction = {
    label: 'Create Harbormaster Project',
    command: 'projectWindowTitle.createHarbormasterProject',
    variant: 'create',
  } as const;
  const addCatalogAction =
    state.isHarbormasterProject && !state.inCatalog
      ? [{ label: 'Add to catalog', command: 'projectWindowTitle.addProjectToCatalog' as AppCommand }]
      : [];
  const sections: AppSection[] = [
    {
      title: 'Project',
      headerActions: state.isHarbormasterProject ? [openCatalogAction] : [openCatalogAction, createProjectAction],
      actions: [
        ...addCatalogAction,
        ...(state.isHarbormasterProject
          ? [
              {
                label: state.configExists ? 'Open project config' : 'Create project config',
                command: configCommand,
              },
              { label: 'Refresh window title', command: 'projectWindowTitle.refresh' as AppCommand },
              { label: 'Color settings', command: 'projectWindowTitle.setWindowAccent' as AppCommand },
              { label: 'Rebuild project state', command: 'projectWindowTitle.rebuildState' as AppCommand },
            ]
          : []),
      ],
    },
    {
      title: 'Tags',
      actions: [
        { label: 'Global tag menu', command: 'projectWindowTitle.openGlobalTags' },
      ],
    },
    {
      title: 'Utility',
      actions: [{ label: 'Command palette menu', command: 'projectWindowTitle.showMenu' }],
    },
  ];

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script type="module">
      import {
        provideVSCodeDesignSystem,
        vsCodeBadge,
        vsCodeButton,
        vsCodeTag,
      } from "${state.toolkitUri}";

      provideVSCodeDesignSystem().register(vsCodeBadge(), vsCodeButton(), vsCodeTag());
    </script>
    <link rel="stylesheet" href="${state.stylesheetUri}" />
    <style>
      ${state.themeCss}
    </style>
  </head>
  <body>
    <div class="stack">
      <div class="header">
        <div class="title-row">
          <div class="title">${escapeHtml(name)}</div>
          <div class="version-block">
            <div class="version-label">Harbormaster Version</div>
            <vscode-badge>${escapeHtml(state.versionLabel)}</vscode-badge>
          </div>
        </div>
        <div class="meta">
          <vscode-tag>${escapeHtml(version)}</vscode-tag>
          ${tags.map((tag) => `<vscode-tag>${escapeHtml(tag)}</vscode-tag>`).join('')}
        </div>
      </div>
      ${sections
        .map(
          (section) => `
        <div class="section">
          <div class="section-header">
            <div class="section-heading">${escapeHtml(section.title)}</div>
            ${
              section.headerActions && section.headerActions.length
                ? `<div class="section-actions">
                    ${section.headerActions
                      .map((action) => {
                        const isCreate = action.variant === 'create';
                        const icon = isCreate
                          ? `<svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                              <path d="M12 5v14M5 12h14" />
                            </svg>`
                          : `<svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">
                              <path d="M3.5 7.5h5l2 2h10v8.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" />
                            </svg>`;
                        const variantClass = isCreate ? 'action-pill create' : 'action-pill open';
                        const expanded = isCreate ? '220px' : '160px';
                        return `<button class="${variantClass} compact" data-command="${action.command}" style="--expanded-width: ${expanded};">
                          <span class="icon">${icon}</span>
                          <span class="label-text">${escapeHtml(action.label)}</span>
                        </button>`;
                      })
                      .join('')}
                  </div>`
                : ''
            }
          </div>
          <div class="grid">
            ${section.actions
              .map(
                (action) =>
                  `<vscode-button appearance="secondary" data-command="${action.command}">
                    ${escapeHtml(action.label)}
                  </vscode-button>`
              )
              .join('')}
          </div>
        </div>`
        )
        .join('')}
    </div>
    ${
      health && (health.missing.length || health.corrupt.length || health.legacy.length)
        ? `<div class="section health">
            <strong>Project health</strong>
            ${health.missing.length ? `<div>Missing:</div><ul>${health.missing.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
            ${health.corrupt.length ? `<div>Corrupt JSON:</div><ul>${health.corrupt.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
            ${health.legacy.length ? `<div>Legacy metadata:</div><ul>${health.legacy.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
          </div>`
        : ''
    }
    <div class="footer">Harbormaster app view</div>
    <script>
      const vscode = acquireVsCodeApi();
      document.querySelectorAll('[data-command]').forEach((button) => {
        button.addEventListener('click', () => {
          const command = button.getAttribute('data-command');
          if (command) {
            vscode.postMessage({ type: 'command', command });
          }
        });
      });
    </script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHarbormasterThemeCss(
  baseAccent: string | undefined,
  sectionAccents: Record<string, string>,
  groupAccents: Record<string, string>,
  sectionInherit: Record<string, boolean>,
  groupInherit: Record<string, boolean>,
  overrides: Record<string, string>
): string {
  const explicitSection = sectionAccents.harbormaster;
  const sectionUsesInherit = Boolean(sectionInherit.harbormaster) || !explicitSection;
  const sectionColor = sectionUsesInherit ? baseAccent : explicitSection;
  const explicitGroup = groupAccents.harbormaster;
  const groupUsesInherit = Boolean(groupInherit.harbormaster) || !explicitGroup;
  const accent = groupUsesInherit ? sectionColor : explicitGroup;
  const hasOverrides = Object.keys(overrides).some((key) => key.startsWith('harbormaster.'));
  if (!accent && !hasOverrides) {
    return '';
  }

  const derived = accent ? deriveHarbormasterTheme(accent) : {};
  const values = {
    panelBg: overrides['harbormaster.panelBackground'] ?? derived.panelBg,
    cardBg: overrides['harbormaster.cardBackground'] ?? derived.cardBg,
    border: overrides['harbormaster.border'] ?? derived.border,
    accent: overrides['harbormaster.accent'] ?? derived.accent,
    text: overrides['harbormaster.text'] ?? derived.text,
    buttonBg: overrides['harbormaster.buttonBackground'] ?? derived.buttonBg,
    buttonHover: overrides['harbormaster.buttonHover'] ?? derived.buttonHover,
    pillBg: overrides['harbormaster.pillBackground'] ?? derived.pillBg,
  };

  const entries: string[] = [];
  if (values.panelBg) {
    entries.push(`--vscode-sideBar-background: ${values.panelBg};`);
    entries.push(`--vscode-editor-background: ${values.panelBg};`);
    entries.push(`--hm-panel-bg: ${values.panelBg};`);
  }
  if (values.cardBg) {
    entries.push(`--vscode-sideBarSectionHeader-background: ${values.cardBg};`);
    entries.push(`--vscode-editorWidget-background: ${values.cardBg};`);
    entries.push(`--hm-card-bg: ${values.cardBg};`);
  }
  if (values.border) {
    entries.push(`--vscode-input-border: ${values.border};`);
    entries.push(`--hm-border: ${values.border};`);
  }
  if (values.accent) {
    entries.push(`--vscode-button-background: ${values.accent};`);
    entries.push(`--vscode-activityBarBadge-background: ${values.accent};`);
    entries.push(`--hm-accent: ${values.accent};`);
  }
  if (values.text) {
    entries.push(`--vscode-foreground: ${values.text};`);
    entries.push(`--vscode-button-foreground: ${values.text};`);
    entries.push(`--vscode-button-secondaryForeground: ${values.text};`);
    entries.push(`--vscode-badge-foreground: ${values.text};`);
    entries.push(`--hm-text: ${values.text};`);
  }
  if (values.buttonBg) {
    entries.push(`--vscode-button-secondaryBackground: ${values.buttonBg};`);
    entries.push(`--hm-button-bg: ${values.buttonBg};`);
  }
  if (values.buttonHover) {
    entries.push(`--vscode-button-hoverBackground: ${values.buttonHover};`);
    entries.push(`--hm-button-hover: ${values.buttonHover};`);
  }
  if (values.pillBg) {
    entries.push(`--vscode-badge-background: ${values.pillBg};`);
    entries.push(`--hm-pill-bg: ${values.pillBg};`);
  }

  return entries.length > 0 ? `:root { ${entries.join(' ')} }` : '';
}

function deriveHarbormasterTheme(accent: string): {
  panelBg?: string;
  cardBg?: string;
  border?: string;
  accent?: string;
  text?: string;
  buttonBg?: string;
  buttonHover?: string;
  pillBg?: string;
} {
  const text = getContrastColor(accent);
  return {
    panelBg: applyAlpha(accent, 0.2),
    cardBg: applyAlpha(accent, 0.12),
    border: applyAlpha(accent, 0.35),
    accent,
    text,
    buttonBg: applyAlpha(accent, 0.25),
    buttonHover: applyAlpha(accent, 0.35),
    pillBg: applyAlpha(accent, 0.25),
  };
}

function applyAlpha(color: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const hexAlpha = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `${color}${hexAlpha}`;
}

function getContrastColor(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#000000' : '#FFFFFF';
}
