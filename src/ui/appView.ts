import * as vscode from 'vscode';

import { AccentGroupDefinition, AccentSectionDefinition, getAccentPickerHtml } from './accentPicker';
import { BASE_WEBVIEW_STYLES } from './styles';

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
  | 'projectWindowTitle.setAccentPickerBreakpoint';

type AppSection = {
  title: string;
  description?: string;
  headerActions?: { label: string; command: AppCommand }[];
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
  setWindowAccentColor(accent: string | undefined): Promise<void>;
  setWindowAccentSection(sectionId: string, accent: string | undefined): Promise<void>;
  setWindowAccentSectionInherit(sectionId: string, inherit: boolean): Promise<void>;
  setWindowAccentGroup(groupId: string, accent: string | undefined): Promise<void>;
  setWindowAccentGroupInherit(groupId: string, inherit: boolean): Promise<void>;
  setWindowAccentOverride(key: string, accent: string | undefined): Promise<void>;
  recordWindowAccentHistory(groupId: string, accent: string): Promise<void>;
  previewWindowAccentGroup(groupId: string, accent: string | undefined): Promise<void>;
  resetWindowAccentColor(): Promise<void>;
  clearWindowAccentLayers(): Promise<void>;
  swapWindowAccentBackup(): Promise<boolean>;
  saveColorPreset(): Promise<void>;
  applyColorPreset(): Promise<void>;
  reportInvalidAccentInput(scope: string, value: string): Promise<void>;
  clearInvalidAccentInput(): Promise<void>;
  setWindowAccentHighlightBoost(value: number | undefined): Promise<void>;
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
    private readonly devToolsEnabled: boolean
  ) {
    this.tracker.onDidChange(() => void this.refresh());
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
    };
    view.webview.onDidReceiveMessage(async (message) => {
      if (!message || typeof message !== 'object') {
        return;
      }
      if (message.type === 'navigateHome') {
        this.setMode('home');
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
    if (this.mode === 'accent') {
      await this.renderAccentView(settings);
      return;
    }
    const info = await this.tracker.getCurrentProjectInfo(settings);
    const themeCss = buildHarbormasterThemeCss(
      this.normalizeAccentColor(info?.windowAccent),
      this.normalizeAccentSections(info?.windowAccentSections),
      this.normalizeAccentGroups(info?.windowAccentGroups),
      this.normalizeAccentOverrides(info?.windowAccentOverrides)
    );
    const health = await this.tracker.getHealthSnapshot();
    const configExists = await this.tracker.projectConfigExists(settings);
    const tagsExists = await this.tracker.tagsFileExists(settings);
    const inCatalog = await this.tracker.isCurrentProjectInCatalog(settings);

    this.view.webview.html = getAppHtml({
      name: info?.name,
      version: info?.version,
      tags: info?.tags ?? [],
      health,
      configExists,
      tagsExists,
      inCatalog,
      versionLabel: `${this.version}${this.devToolsEnabled ? ' [DEV]' : ''}`,
      themeCss,
    });
  }

  notifyThemeDefaults(): void {
    if (!this.view || this.mode !== 'accent') {
      return;
    }
    void this.view.webview.postMessage({ type: 'themeDefaults' });
  }

  private async renderAccentView(settings: unknown): Promise<void> {
    const info = await this.tracker.getCurrentProjectInfo(settings);
    const baseExplicit = this.normalizeAccentColor(info?.windowAccent);
    const baseColor = baseExplicit ?? '';
    const sectionColors = this.normalizeAccentSections(info?.windowAccentSections);
    const groupColors = this.normalizeAccentGroups(info?.windowAccentGroups);
    const sectionInherit = this.normalizeAccentSectionInherit(info?.windowAccentSectionsInherit);
    const groupInherit = this.normalizeAccentGroupInherit(info?.windowAccentGroupsInherit);
    const overrides = this.normalizeAccentOverrides(info?.windowAccentOverrides);
    const groupHistory = this.normalizeAccentHistory(info?.windowAccentHistory);
    const breakpoint = (settings as { accentPickerBreakpoint?: number }).accentPickerBreakpoint ?? 560;
    const highlightBoost =
      typeof info?.windowAccentHighlightBoost === 'number' ? info.windowAccentHighlightBoost : undefined;
    const themeCss = buildHarbormasterThemeCss(
      this.normalizeAccentColor(info?.windowAccent),
      this.normalizeAccentSections(info?.windowAccentSections),
      this.normalizeAccentGroups(info?.windowAccentGroups),
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
      breakpoint,
      this.accentSections,
      this.accentGroups,
      {
        showBackButton: true,
        backLabel: 'Back',
        useThemeDefault: !baseExplicit,
        defaultBaseColor: '#181818',
        themeCss,
        highlightBoost,
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
      await this.tracker.setWindowAccentHighlightBoost(message.value);
      await this.refresh();
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
  versionLabel: string;
  themeCss: string;
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
  } as const;
  const addCatalogAction = state.inCatalog
    ? []
    : [{ label: 'Add to catalog', command: 'projectWindowTitle.addProjectToCatalog' as AppCommand }];
  const sections: AppSection[] = [
    {
      title: 'Project',
      headerActions: [openCatalogAction],
      actions: [
        ...addCatalogAction,
        {
          label: state.configExists ? 'Open project config' : 'Create project config',
          command: configCommand,
        },
        { label: 'Refresh window title', command: 'projectWindowTitle.refresh' },
        { label: 'Color settings', command: 'projectWindowTitle.setWindowAccent' },
        { label: 'Rebuild project state', command: 'projectWindowTitle.rebuildState' },
      ],
    },
    {
      title: 'Tags',
      actions: [
        { label: 'Add global tag', command: 'projectWindowTitle.addGlobalTag' },
        ...(state.tagsExists
          ? [{ label: 'Remove global tag', command: 'projectWindowTitle.removeGlobalTag' as AppCommand }]
          : []),
        ...(state.tagsExists
          ? [{ label: 'Assign tag to project', command: 'projectWindowTitle.assignTag' as AppCommand }]
          : []),
        ...(state.tagsExists
          ? [{ label: 'Remove tag from project', command: 'projectWindowTitle.removeProjectTag' as AppCommand }]
          : []),
      ],
    },
    {
      title: 'Utility',
      actions: [
        { label: 'Accent picker breakpoint', command: 'projectWindowTitle.setAccentPickerBreakpoint' },
        { label: 'Command palette menu', command: 'projectWindowTitle.showMenu' },
      ],
    },
  ];

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      ${BASE_WEBVIEW_STYLES}
      ${state.themeCss}
      .header {
        display: grid;
        gap: 6px;
        padding: 12px;
        border-radius: 12px;
        background: var(--hm-panel-bg, var(--vscode-sideBarSectionHeader-background));
        margin-bottom: 12px;
      }
      .title {
        font-size: 1.1rem;
        font-weight: 700;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 0.85rem;
        opacity: 0.85;
      }
      .section {
        margin-top: 12px;
      }
      .section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .section-heading {
        margin: 0;
        font-size: 0.95rem;
        letter-spacing: 0.08em;
      }
      .section-actions {
        display: flex;
        gap: 8px;
      }
      .section-actions button {
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 0.75rem;
      }
      .section-actions .action-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--hm-accent, var(--vscode-button-background)) 70%, transparent),
          var(--vscode-button-background)
        );
        border: 1px solid color-mix(in srgb, var(--vscode-button-background) 75%, transparent);
        color: var(--vscode-button-foreground);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--vscode-button-background) 35%, transparent);
      }
      .action-primary.compact {
        width: 36px;
        height: 36px;
        padding: 0;
        gap: 0;
        justify-content: center;
        overflow: hidden;
        transition: width 180ms ease, padding 180ms ease;
      }
      .action-primary.compact:hover {
        width: 160px;
        padding: 6px 14px;
        gap: 8px;
        justify-content: flex-start;
      }
      .action-primary .icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .action-primary .icon svg {
        width: 16px;
        height: 16px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.5;
        stroke-linejoin: round;
        stroke-linecap: round;
      }
      .action-primary .label-text {
        white-space: nowrap;
        opacity: 0;
        transition: opacity 120ms ease;
      }
      .action-primary.compact .label-text {
        width: 0;
        overflow: hidden;
      }
      .action-primary.compact:hover .label-text {
        width: auto;
      }
      .action-primary.compact:hover .label-text {
        opacity: 1;
      }
      .action-primary.compact:hover .icon {
        opacity: 0;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 8px;
      }
      .health {
        margin-top: 10px;
        font-size: 0.85rem;
      }
      .health strong {
        display: block;
        margin-bottom: 6px;
      }
      ul {
        margin: 0;
        padding-left: 18px;
      }
      .footer {
        margin-top: 12px;
        font-size: 0.75rem;
        opacity: 0.7;
      }
    </style>
  </head>
  <body>
      <div class="header panel-card">
      <div class="title">${escapeHtml(name)}</div>
      <div class="meta">
        <div class="pill">${escapeHtml(version)}</div>
        <div class="pill">${escapeHtml(state.versionLabel)}</div>
      </div>
      <div class="meta">
        ${tags.map((tag) => `<div class="pill">${escapeHtml(tag)}</div>`).join('')}
      </div>
    </div>
    ${sections
      .map(
        (section) => `
      <div class="section panel-card">
        <div class="section-title">
          <h3 class="section-heading">${escapeHtml(section.title)}</h3>
          ${
            section.headerActions && section.headerActions.length
              ? `<div class="section-actions">
                  ${section.headerActions
                    .map(
                      (action) =>
                        `<button class="action-primary compact" data-command="${action.command}">
                          <span class="icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" role="img" focusable="false">
                              <path d="M3.5 7.5h5l2 2h10v8.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" />
                            </svg>
                          </span>
                          <span class="label-text">${escapeHtml(action.label)}</span>
                        </button>`
                    )
                    .join('')}
                </div>`
              : ''
          }
        </div>
        <div class="grid">
          ${section.actions
            .map(
              (action) =>
                `<button data-command="${action.command}">${escapeHtml(action.label)}</button>`
            )
            .join('')}
        </div>
      </div>`
      )
      .join('')}
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
      document.querySelectorAll('button[data-command]').forEach((button) => {
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
  overrides: Record<string, string>
): string {
  const accent = groupAccents.harbormaster || sectionAccents.harbormaster || baseAccent;
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
  if (values.panelBg) entries.push(`--hm-panel-bg: ${values.panelBg};`);
  if (values.cardBg) entries.push(`--hm-card-bg: ${values.cardBg};`);
  if (values.border) entries.push(`--hm-border: ${values.border};`);
  if (values.accent) entries.push(`--hm-accent: ${values.accent};`);
  if (values.text) entries.push(`--hm-text: ${values.text};`);
  if (values.buttonBg) entries.push(`--hm-button-bg: ${values.buttonBg};`);
  if (values.buttonHover) entries.push(`--hm-button-hover: ${values.buttonHover};`);
  if (values.pillBg) entries.push(`--hm-pill-bg: ${values.pillBg};`);

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
