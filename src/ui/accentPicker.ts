export type AccentSectionDefinition = {
  id: string;
  label: string;
};

export type AccentGroupDefinition = {
  id: string;
  label: string;
  section: string;
  keys: string[];
};

import { BASE_WEBVIEW_STYLES } from './styles';

export function getAccentPickerHtml(
  baseColor: string,
  sectionColors: Record<string, string>,
  groupColors: Record<string, string>,
  sectionInherit: Record<string, boolean>,
  groupInherit: Record<string, boolean>,
  overrides: Record<string, string>,
  groupHistory: Record<string, string[]>,
  breakpoint: number,
  sections: AccentSectionDefinition[],
  groups: AccentGroupDefinition[],
  options: {
    showBackButton?: boolean;
    backLabel?: string;
    useThemeDefault?: boolean;
    defaultBaseColor?: string;
    themeCss?: string;
    highlightBoost?: number;
  } = {}
): string {
  const safeBreakpoint = Number.isFinite(breakpoint) && breakpoint > 0 ? Math.round(breakpoint) : 560;
  const showBackButton = Boolean(options.showBackButton);
  const backLabel = options.backLabel ?? 'Back';
  const useThemeDefault = Boolean(options.useThemeDefault);
  // TODO: Replace hardcoded default with a reliable theme-derived accent value.
  const defaultBaseColor = options.defaultBaseColor ?? '#181818';
  const sectionPayload = sections.map((section) => ({
    id: section.id,
    label: section.label,
    color: sectionColors[section.id] ?? '',
    inherit: Boolean(sectionInherit[section.id]) || !sectionColors[section.id],
    history: groupHistory[section.id] ?? [],
  }));
  const groupPayload = groups.map((group) => ({
    id: group.id,
    label: group.label,
    section: group.section,
    color: groupColors[group.id] ?? '',
    inherit: Boolean(groupInherit[group.id]) || !groupColors[group.id],
    history: groupHistory[group.id] ?? [],
    keys: group.keys,
  }));
  const baseHistory = groupHistory.base ?? [];
  const highlightBoost =
    typeof options.highlightBoost === 'number' ? Math.max(0, Math.min(0.4, options.highlightBoost)) : 0.15;
  const highlightBoostPercent = Math.round(highlightBoost * 100);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      ${BASE_WEBVIEW_STYLES}
      ${options.themeCss ?? ''}
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }
      .topbar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }
      .topbar button {
        padding: 4px 8px;
      }
      .toolbar {
        display: grid;
        gap: 8px;
      }
      .toolbar-title {
        font-weight: 600;
      }
      .toolbar-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .toolbar-presets {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        padding-top: 6px;
        margin-top: 4px;
        border-top: 1px dashed rgba(127, 127, 127, 0.25);
      }
      .boost-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 52px minmax(0, 1fr);
        gap: 8px;
        align-items: center;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px dashed rgba(127, 127, 127, 0.2);
      }
      .boost-row label {
        font-size: 0.85rem;
        opacity: 0.85;
      }
      .boost-row input[type='range'] {
        width: 100%;
      }
      .section-block {
        margin-top: 12px;
        padding: 12px;
        border-radius: 12px;
        border: 1px solid var(--hm-border, rgba(127, 127, 127, 0.2));
        background: var(--hm-card-bg, rgba(0, 0, 0, 0.12));
      }
      .row {
        display: grid;
        grid-template-columns: 150px minmax(0, 1fr) minmax(0, 1fr);
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }
      .controls {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        gap: 8px;
        align-items: center;
      }
      .controls.inherit-controls {
        grid-template-columns: 42px auto minmax(0, 1fr);
      }
      .controls input[type="text"] {
        width: 100%;
      }
      .input-invalid {
        border-color: rgba(255, 255, 255, 0.35);
      }
      .label {
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .eye-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 999px;
        border: 1px solid var(--hm-border, rgba(127, 127, 127, 0.3));
        background: color-mix(in srgb, var(--hm-card-bg, rgba(0, 0, 0, 0.12)) 70%, transparent);
      }
      .eye-button svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.5;
        stroke-linejoin: round;
        stroke-linecap: round;
        opacity: 0.85;
      }
      .actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .inherit-toggle {
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--hm-border, rgba(127, 127, 127, 0.3));
        background: var(--vscode-button-secondaryBackground, rgba(127, 127, 127, 0.2));
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        font-size: 0.72rem;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .inherit-toggle.active {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 2px 6px;
        border-radius: 999px;
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        border: 1px solid var(--hm-border, rgba(127, 127, 127, 0.3));
        background: var(--hm-pill-bg, rgba(127, 127, 127, 0.2));
      }
      .badge.inherit {
        opacity: 0.7;
      }
      .badge.override {
        background: var(--hm-accent, rgba(127, 127, 127, 0.35));
      }
      .dropdown {
        position: relative;
      }
      .dropdown-trigger {
        width: 100%;
      }
      .dropdown-list {
        display: none;
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 6px);
        background: var(--vscode-editorWidget-background);
        background: color-mix(in srgb, var(--vscode-editorWidget-background) 92%, transparent);
        border: 1px solid var(--hm-border, rgba(127, 127, 127, 0.2));
        border-radius: 10px;
        padding: 6px;
        z-index: 10;
        max-height: 220px;
        overflow-y: auto;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      }
      .dropdown-list.open {
        display: grid;
        gap: 6px;
      }
      .dropdown-item {
        display: grid;
        grid-template-columns: 18px 1fr;
        gap: 8px;
        align-items: center;
        text-align: left;
        padding: 6px 8px;
      }
      .swatch {
        width: 14px;
        height: 14px;
        border-radius: 4px;
        border: 1px solid var(--hm-border, rgba(127, 127, 127, 0.35));
      }
      details {
        border-top: 1px dashed rgba(127, 127, 127, 0.3);
        margin-top: 10px;
        padding-top: 10px;
      }
      summary {
        cursor: pointer;
        font-weight: 600;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--hm-border, rgba(127, 127, 127, 0.25));
        background: color-mix(in srgb, var(--hm-card-bg, rgba(0, 0, 0, 0.12)) 85%, transparent);
      }
      summary.section-toggle::after {
        content: '▸';
        opacity: 0.75;
        transition: transform 120ms ease;
      }
      details[open] summary.section-toggle::after {
        transform: rotate(90deg);
      }
      .compact-row {
        display: grid;
        grid-template-columns: 150px minmax(0, 1fr) minmax(0, 1fr);
        gap: 12px;
        align-items: center;
        margin-bottom: 10px;
      }
      .compact-row .actions {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      @media (max-width: ${safeBreakpoint}px) {
        .row {
          grid-template-columns: 1fr;
          align-items: start;
        }
        .compact-row {
          grid-template-columns: 1fr;
        }
        .row > * {
          width: 100%;
          justify-self: stretch;
        }
        .controls {
          grid-template-columns: 42px minmax(0, 1fr);
        }
        .controls.inherit-controls {
          grid-template-columns: 42px auto minmax(0, 1fr);
        }
        input[type="text"],
        select,
        button {
          width: 100%;
        }
        .toolbar-actions {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .toolbar-presets {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .row .actions {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .compact-row .actions {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    </style>
  </head>
  <body>
    ${showBackButton ? `<div class="topbar"><button id="backButton">${backLabel}</button><strong>Accent Colors</strong></div>` : '<h2>Accent Colors</h2>'}
    <div class="toolbar panel-card">
      <div class="toolbar-title">Quick actions</div>
      <div class="toolbar-actions">
        <button id="clearAll" type="button">Clear all</button>
        <button id="clearAllButBase" type="button">Clear all but base</button>
        <button id="swapBackup" type="button">Swap backup</button>
      </div>
      <div class="toolbar-presets">
        <button id="savePreset" type="button">Save preset</button>
        <button id="applyPreset" type="button">Apply preset</button>
      </div>
      <div class="boost-row">
        <label for="highlightBoost">Highlights inherit boost</label>
        <div id="highlightBoostValue">${highlightBoostPercent}%</div>
        <input id="highlightBoost" type="range" min="0" max="40" step="1" value="${highlightBoostPercent}" />
      </div>
    </div>
    <div class="row panel-card">
      <div class="label">Base accent</div>
      <div class="controls">
        <input id="baseWheel" type="color" value="${baseColor}" />
        <input id="baseInput" type="text" value="${baseColor}" />
      </div>
      <div class="actions">
        <div id="baseHistory"></div>
        <button id="baseApply">Apply</button>
        <button id="baseClear">Clear base</button>
      </div>
    </div>
    <div id="sections"></div>
    <script>
      const vscode = acquireVsCodeApi();
      const baseWheel = document.getElementById('baseWheel');
      const baseInput = document.getElementById('baseInput');
      const baseApply = document.getElementById('baseApply');
      const baseClear = document.getElementById('baseClear');
      const baseHistory = document.getElementById('baseHistory');
      const clearAll = document.getElementById('clearAll');
      const clearAllButBase = document.getElementById('clearAllButBase');
      const backButton = document.getElementById('backButton');
      const swapBackup = document.getElementById('swapBackup');
      const savePreset = document.getElementById('savePreset');
      const applyPreset = document.getElementById('applyPreset');
      const highlightBoost = document.getElementById('highlightBoost');
      const highlightBoostValue = document.getElementById('highlightBoostValue');
      const sections = ${JSON.stringify(sectionPayload)};
      const groups = ${JSON.stringify(groupPayload)};
      const overrides = ${JSON.stringify(overrides)};
      const sectionsRoot = document.getElementById('sections');
      const baseHistoryValues = ${JSON.stringify(baseHistory)};
      const baseExplicit = ${JSON.stringify(Boolean(baseColor && baseColor.trim()))};
      const useThemeDefault = ${useThemeDefault};
      const defaultBaseColor = ${JSON.stringify(defaultBaseColor)};
      const viewState = vscode.getState() || {};
      const openSections = new Set(viewState.openSections || []);
      let baseDirty = false;

      const normalize = (value) => {
        const trimmed = value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
        if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
          return '#' + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2] + trimmed[3] + trimmed[3];
        }
        if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return ('#' + trimmed).toUpperCase();
        if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
          return (
            '#' +
            trimmed[0] +
            trimmed[0] +
            trimmed[1] +
            trimmed[1] +
            trimmed[2] +
            trimmed[2]
          ).toUpperCase();
        }
        return null;
      };

      const invert = (value) => {
        const normalized = normalize(value);
        if (!normalized) return null;
        const r = 255 - parseInt(normalized.slice(1, 3), 16);
        const g = 255 - parseInt(normalized.slice(3, 5), 16);
        const b = 255 - parseInt(normalized.slice(5, 7), 16);
        return (
          '#' +
          r.toString(16).padStart(2, '0') +
          g.toString(16).padStart(2, '0') +
          b.toString(16).padStart(2, '0')
        ).toUpperCase();
      };

      const getBlinkColor = (value) => invert(value);

      const parseColorToHex = (value) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const normalized = normalize(trimmed);
        if (normalized) return normalized;
        const match = trimmed.match(/rgba?\\(([^)]+)\\)/i);
        if (!match) return null;
        const parts = match[1].split(',').map((entry) => Number.parseFloat(entry.trim()));
        if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
        const [r, g, b] = parts;
        const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
        const toHex = (n) => clamp(n).toString(16).padStart(2, '0').toUpperCase();
        return '#' + toHex(r) + toHex(g) + toHex(b);
      };

      const getDefaultBaseColor = () => {
        if (!useThemeDefault) return defaultBaseColor;
        const style = getComputedStyle(document.body);
        const cssColor = style.getPropertyValue('--vscode-editor-background').trim();
        return parseColorToHex(cssColor) || defaultBaseColor;
      };

      const setInvalidAccent = (targetInput, isInvalid) => {
        if (!isInvalid) {
          targetInput.classList.remove('input-invalid');
          targetInput.style.backgroundColor = '';
          targetInput.style.color = '';
          return;
        }
        const inverted = getBlinkColor(getDefaultBaseColor());
        targetInput.classList.add('input-invalid');
        targetInput.style.backgroundColor = inverted || '';
        targetInput.style.color = getDefaultBaseColor();
      };

      const bindColorPair = (wheel, input, scope) => {
        wheel.addEventListener('input', () => {
          if (input === baseInput) baseDirty = true;
          input.value = wheel.value.toUpperCase();
          setInvalidAccent(input, false);
          vscode.postMessage({ type: 'clearInvalidHex', scope });
        });
        input.addEventListener('input', () => {
          if (input === baseInput) baseDirty = true;
          const trimmed = input.value.trim();
          if (trimmed.length === 0) {
            setInvalidAccent(input, false);
            vscode.postMessage({ type: 'clearInvalidHex', scope });
            return;
          }
          if (trimmed.length !== 6 && trimmed.length !== 7) {
            setInvalidAccent(input, false);
            vscode.postMessage({ type: 'clearInvalidHex', scope });
            return;
          }
          const isValid =
            (trimmed.length === 6 && /^[0-9a-fA-F]{6}$/.test(trimmed)) ||
            (trimmed.length === 7 && /^#[0-9a-fA-F]{6}$/.test(trimmed));
          if (!isValid) {
            setInvalidAccent(input, true);
            vscode.postMessage({ type: 'invalidHex', scope, value: trimmed });
            return;
          }
          const normalized = trimmed.length === 6 ? ('#' + trimmed).toUpperCase() : trimmed.toUpperCase();
          input.value = normalized;
          wheel.value = normalized;
          setInvalidAccent(input, false);
          vscode.postMessage({ type: 'clearInvalidHex', scope });
        });
      };

      bindColorPair(baseWheel, baseInput, 'base');

      const buildHistoryDropdown = (values, onSelect) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'dropdown';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dropdown-trigger';
        button.textContent = 'Recent...';
        const list = document.createElement('div');
        list.className = 'dropdown-list';
        values.forEach((value) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'dropdown-item';
          const swatch = document.createElement('span');
          swatch.className = 'swatch';
          swatch.style.background = value;
          const label = document.createElement('span');
          label.textContent = value;
          item.appendChild(swatch);
          item.appendChild(label);
          item.addEventListener('click', () => {
            list.classList.remove('open');
            onSelect(value);
          });
          list.appendChild(item);
        });
        button.addEventListener('click', () => {
          list.classList.toggle('open');
        });
        document.addEventListener('click', (event) => {
          if (!wrapper.contains(event.target)) {
            list.classList.remove('open');
          }
        });
        wrapper.appendChild(button);
        wrapper.appendChild(list);
        return wrapper;
      };

      const baseHistoryDropdown = buildHistoryDropdown(baseHistoryValues, (value) => {
        baseDirty = true;
        baseInput.value = value;
        baseWheel.value = value;
      });
      baseHistory.appendChild(baseHistoryDropdown);

      baseApply.addEventListener('click', () => {
        vscode.postMessage({ type: 'applyBase', value: baseInput.value });
      });

      baseClear.addEventListener('click', () => {
        vscode.postMessage({ type: 'clearBase' });
      });

      const createBadge = (text, className) => {
        const badge = document.createElement('span');
        badge.className = 'badge ' + className;
        badge.textContent = text;
        return badge;
      };

      const createEyeButton = () => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'eye-button';
        button.innerHTML = '<svg viewBox="0 0 24 24" role="img" aria-hidden="true"><path d="M2 12s4.2-6 10-6 10 6 10 6-4.2 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3.5"/></svg>';
        return button;
      };

      const groupHasOverride = (group) => {
        if (group.color) return true;
        if (!group.keys) return false;
        return group.keys.some((key) => overrides[key]);
      };

      const groupById = new Map(groups.map((group) => [group.id, group]));

      const getSectionRow = (sectionId) =>
        document.querySelector('.row[data-section-id="' + sectionId + '"]');

      const getSectionEffectiveColor = (sectionId) => {
        const row = getSectionRow(sectionId);
        if (!row) return baseInput.value;
        if (row.dataset.inherit === '1') {
          return baseInput.value;
        }
        if (row.dataset.override === '1') {
          const input = row.querySelector('input[type="text"]');
          return input ? input.value : baseInput.value;
        }
        return baseInput.value;
      };

      const buildSectionRow = (section) => {
        const row = document.createElement('div');
        row.className = 'row';
        row.dataset.sectionId = section.id;
        row.dataset.override = section.color ? '1' : '0';
        row.dataset.inherit = section.inherit ? '1' : '0';

        const label = document.createElement('div');
        label.className = 'label';
        const labelText = document.createElement('span');
        labelText.textContent = section.label;
        const sectionEye = createEyeButton();
        const previewSection = (value) => {
          vscode.postMessage({ type: 'previewSection', section: section.id, value: value || '' });
        };
        const previewOn = () => {
          const inverted = getBlinkColor(getSectionEffectiveColor(section.id));
          if (inverted) {
            previewSection(inverted);
          }
        };
        const previewOff = () => {
          previewSection('');
        };
        sectionEye.addEventListener('mousedown', previewOn);
        sectionEye.addEventListener('mouseup', previewOff);
        sectionEye.addEventListener('mouseleave', previewOff);
        label.appendChild(labelText);
        label.appendChild(sectionEye);
        // Inherit is now handled via the toggle button, so no badge here.

        const controls = document.createElement('div');
        controls.className = 'controls inherit-controls';

        const wheel = document.createElement('input');
        wheel.type = 'color';
        wheel.value = section.color ? section.color : getDefaultBaseColor();

        const input = document.createElement('input');
        input.type = 'text';
        input.value = section.color ? section.color : getDefaultBaseColor();

        bindColorPair(wheel, input, 'section:' + section.id);

        const actions = document.createElement('div');
        actions.className = 'actions';

        const history = buildHistoryDropdown(section.history || [], (value) => {
          input.value = value;
          wheel.value = value;
        });

        const inherit = document.createElement('button');
        inherit.type = 'button';
        inherit.className = 'inherit-toggle';
        inherit.textContent = 'Inherit';
        if (row.dataset.inherit === '1') {
          inherit.classList.add('active');
        }
        inherit.addEventListener('click', () => {
          const next = row.dataset.inherit !== '1';
          row.dataset.inherit = next ? '1' : '0';
          inherit.classList.toggle('active', next);
          vscode.postMessage({ type: 'inheritSection', section: section.id, enabled: next });
        });

        const apply = document.createElement('button');
        apply.textContent = 'Apply';
        apply.addEventListener('click', () => {
          row.dataset.override = '1';
          row.dataset.inherit = '0';
          inherit.classList.remove('active');
          vscode.postMessage({ type: 'applySection', section: section.id, value: input.value });
        });

        const clear = document.createElement('button');
        clear.textContent = 'Clear';
        clear.addEventListener('click', () => {
          row.dataset.override = '0';
          row.dataset.inherit = '1';
          inherit.classList.add('active');
          input.value = getDefaultBaseColor();
          wheel.value = getDefaultBaseColor();
          vscode.postMessage({ type: 'clearSection', section: section.id });
        });

        controls.appendChild(wheel);
        controls.appendChild(inherit);
        controls.appendChild(input);
        actions.appendChild(history);
        actions.appendChild(apply);
        actions.appendChild(clear);

        row.appendChild(label);
        row.appendChild(controls);
        row.appendChild(actions);

        return row;
      };

      const buildGroupRow = (group) => {
        const row = document.createElement('div');
        row.className = 'compact-row';
        row.dataset.groupId = group.id;
        row.dataset.section = group.section;
        row.dataset.override = group.color ? '1' : '0';
        row.dataset.inherit = group.inherit ? '1' : '0';

        const getEffective = () => {
          if (row.dataset.inherit === '1') {
            return getSectionEffectiveColor(group.section);
          }
          if (row.dataset.override === '1') {
            return input.value;
          }
          return getSectionEffectiveColor(group.section);
        };

        const label = document.createElement('div');
        label.className = 'label';
        const labelText = document.createElement('span');
        labelText.textContent = group.label;
        const groupEye = createEyeButton();
        const previewGroup = (value) => {
          vscode.postMessage({ type: 'previewGroup', group: group.id, value: value || '' });
        };
        const previewOn = () => {
          const inverted = getBlinkColor(getEffective());
          if (inverted) {
            previewGroup(inverted);
          }
        };
        const previewOff = () => {
          previewGroup('');
        };
        groupEye.addEventListener('mousedown', previewOn);
        groupEye.addEventListener('mouseup', previewOff);
        groupEye.addEventListener('mouseleave', previewOff);
        label.appendChild(labelText);
        label.appendChild(groupEye);
        // Inherit is now handled via the toggle button, so no badge here.

        const controls = document.createElement('div');
        controls.className = 'controls inherit-controls';

        const wheel = document.createElement('input');
        wheel.type = 'color';
        wheel.value = group.color ? group.color : getDefaultBaseColor();

        const input = document.createElement('input');
        input.type = 'text';
        input.value = group.color ? group.color : getDefaultBaseColor();

        bindColorPair(wheel, input, 'group:' + group.id);

        const actions = document.createElement('div');
        actions.className = 'actions';

        const history = buildHistoryDropdown(group.history || [], (value) => {
          input.value = value;
          wheel.value = value;
        });

        const keySelect = document.createElement('select');
        const keyPlaceholder = document.createElement('option');
        keyPlaceholder.value = '';
        keyPlaceholder.textContent = 'Override key...';
        keySelect.appendChild(keyPlaceholder);
        (group.keys || []).forEach((key) => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = key;
          keySelect.appendChild(option);
        });
        keySelect.addEventListener('change', () => {
          if (!keySelect.value) return;
          const overrideValue = overrides[keySelect.value];
          if (overrideValue) {
            input.value = overrideValue;
            wheel.value = overrideValue;
          }
        });

        const inherit = document.createElement('button');
        inherit.type = 'button';
        inherit.className = 'inherit-toggle';
        inherit.textContent = 'Inherit';
        if (row.dataset.inherit === '1') {
          inherit.classList.add('active');
        }
        inherit.addEventListener('click', () => {
          const next = row.dataset.inherit !== '1';
          row.dataset.inherit = next ? '1' : '0';
          inherit.classList.toggle('active', next);
          vscode.postMessage({ type: 'inheritGroup', group: group.id, enabled: next });
        });

        const apply = document.createElement('button');
        apply.textContent = 'Apply';
        apply.addEventListener('click', () => {
          if (keySelect.value) {
            vscode.postMessage({ type: 'applyOverride', key: keySelect.value, value: input.value });
            return;
          }
          row.dataset.override = '1';
          row.dataset.inherit = '0';
          inherit.classList.remove('active');
          vscode.postMessage({ type: 'applyGroup', group: group.id, value: input.value });
        });

        const clear = document.createElement('button');
        clear.textContent = 'Clear';
        clear.addEventListener('click', () => {
          if (keySelect.value) {
            vscode.postMessage({ type: 'clearOverride', key: keySelect.value });
            return;
          }
          row.dataset.override = '0';
          row.dataset.inherit = '1';
          inherit.classList.add('active');
          input.value = getDefaultBaseColor();
          wheel.value = getDefaultBaseColor();
          vscode.postMessage({ type: 'clearGroup', group: group.id });
        });


        controls.appendChild(wheel);
        controls.appendChild(inherit);
        controls.appendChild(input);
        actions.appendChild(history);
        actions.appendChild(keySelect);
        actions.appendChild(apply);
        actions.appendChild(clear);

        row.appendChild(label);
        row.appendChild(controls);
        row.appendChild(actions);

        return row;
      };

      const updateInheritedInputs = () => {
        const fallback = getDefaultBaseColor();
        document.querySelectorAll('.row[data-section-id]').forEach((row) => {
          if (row.dataset.inherit !== '1') return;
          if (row.dataset.override === '1') return;
          const inputs = row.querySelectorAll('input');
          inputs.forEach((input) => {
            if (input.type === 'text') input.value = fallback;
            if (input.type === 'color') input.value = fallback;
          });
        });
        document.querySelectorAll('.compact-row[data-group-id]').forEach((row) => {
          if (row.dataset.inherit !== '1') return;
          if (row.dataset.override === '1') return;
          const group = groupById.get(row.dataset.groupId);
          if (group && groupHasOverride(group)) return;
          const inputs = row.querySelectorAll('input');
          inputs.forEach((input) => {
            if (input.type === 'text') input.value = fallback;
            if (input.type === 'color') input.value = fallback;
          });
        });
      };

      const applyThemeDefaults = () => {
        if (baseExplicit || baseDirty) return;
        const fallback = getDefaultBaseColor();
        baseInput.value = fallback;
        baseWheel.value = fallback;
        updateInheritedInputs();
      };

      if (!normalize(baseInput.value)) {
        applyThemeDefaults();
      }

      if (backButton) {
        backButton.addEventListener('click', () => {
          vscode.postMessage({ type: 'navigateHome' });
        });
      }

      window.addEventListener('message', (event) => {
        const message = event.data;
        if (!message || typeof message !== 'object') return;
        if (message.type === 'themeDefaults') {
          applyThemeDefaults();
        }
      });

      clearAll.addEventListener('click', () => {
        vscode.postMessage({ type: 'clearAll' });
      });

      clearAllButBase.addEventListener('click', () => {
        vscode.postMessage({ type: 'clearAllButBase' });
      });

      if (swapBackup) {
        swapBackup.addEventListener('click', () => {
          vscode.postMessage({ type: 'swapBackup' });
        });
      }

      if (savePreset) {
        savePreset.addEventListener('click', () => {
          vscode.postMessage({ type: 'savePreset' });
        });
      }

      if (applyPreset) {
        applyPreset.addEventListener('click', () => {
          vscode.postMessage({ type: 'applyPreset' });
        });
      }

      if (highlightBoost && highlightBoostValue) {
        let boostTimer = null;
        let lastSent = null;
        let pendingValue = null;
        const sendBoost = (value, preview) => {
          if (lastSent === value && preview) return;
          lastSent = value;
          vscode.postMessage({ type: 'setHighlightBoost', value, preview });
        };
        const scheduleBoost = (value) => {
          pendingValue = value;
          if (boostTimer) return;
          boostTimer = setInterval(() => {
            if (pendingValue === null) {
              clearInterval(boostTimer);
              boostTimer = null;
              return;
            }
            const next = pendingValue;
            pendingValue = null;
            sendBoost(next, true);
          }, 250);
        };
        const readBoost = () => {
          const next = Number(highlightBoost.value);
          if (!Number.isFinite(next)) return null;
          highlightBoostValue.textContent = next + '%';
          return next / 100;
        };
        highlightBoost.addEventListener('input', () => {
          const value = readBoost();
          if (value === null) return;
          scheduleBoost(value);
        });
        const flush = () => {
          const value = readBoost();
          if (value === null) return;
          pendingValue = null;
          if (boostTimer) {
            clearInterval(boostTimer);
            boostTimer = null;
          }
          sendBoost(value, false);
        };
        highlightBoost.addEventListener('change', flush);
        highlightBoost.addEventListener('mouseup', flush);
        highlightBoost.addEventListener('touchend', flush);
      }

      sections.forEach((section) => {
        const block = document.createElement('div');
        block.className = 'section-block';
        block.appendChild(buildSectionRow(section));

        const details = document.createElement('details');
        details.dataset.sectionId = section.id;
        if (openSections.has(section.id)) {
          details.open = true;
        }
        const summary = document.createElement('summary');
        summary.className = 'section-toggle';
        summary.textContent = section.label + ' groups';
        const hasOverrides = groups
          .filter((group) => group.section === section.id)
          .some((group) => groupHasOverride(group));
        if (hasOverrides) {
          summary.appendChild(createBadge('OVR', 'override'));
        }
        details.addEventListener('toggle', () => {
          if (details.open) {
            openSections.add(section.id);
          } else {
            openSections.delete(section.id);
          }
          vscode.setState({ ...viewState, openSections: Array.from(openSections) });
        });
        details.appendChild(summary);

        groups.filter((group) => group.section === section.id).forEach((group) => {
          details.appendChild(buildGroupRow(group));
        });

        block.appendChild(details);
        sectionsRoot.appendChild(block);
      });
    </script>
  </body>
</html>`;
}
