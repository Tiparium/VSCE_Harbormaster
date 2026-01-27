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


export function getAccentPickerHtml(
  baseColor: string,
  sectionColors: Record<string, string>,
  groupColors: Record<string, string>,
  sectionInherit: Record<string, boolean>,
  groupInherit: Record<string, boolean>,
  overrides: Record<string, string>,
  groupHistory: Record<string, string[]>,
  sections: AccentSectionDefinition[],
  groups: AccentGroupDefinition[],
  options: {
    showBackButton?: boolean;
    backLabel?: string;
    useThemeDefault?: boolean;
    defaultBaseColor?: string;
    themeCss?: string;
    highlightBoost?: number;
    toolkitUri?: string;
    stylesheetUri?: string;
  } = {}
): string {
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
    <script type="module">
      import {
        provideVSCodeDesignSystem,
        vsCodeBadge,
        vsCodeButton,
        vsCodeDropdown,
        vsCodeOption,
        vsCodeTextField,
      } from "${options.toolkitUri ?? ''}";

      provideVSCodeDesignSystem().register(
        vsCodeBadge(),
        vsCodeButton(),
        vsCodeDropdown(),
        vsCodeOption(),
        vsCodeTextField()
      );
    </script>
    <link rel="stylesheet" href="${options.stylesheetUri ?? ''}" />
    <style>
      ${options.themeCss ?? ''}
    </style>
  </head>
  <body>
    <div class="stack">
      ${showBackButton ? `<div class="topbar"><vscode-button id="backButton" appearance="secondary">${escapeHtml(backLabel)}</vscode-button></div>` : ''}
      <div class="section-block quick-actions">
        <div class="section-title">Quick actions</div>
        <div class="quick-actions-grid">
          <vscode-button id="clearAll" appearance="secondary">Clear all</vscode-button>
          <vscode-button id="clearAllButBase" appearance="secondary">Clear all but base</vscode-button>
          <vscode-button id="swapBackup" appearance="secondary">Swap backup</vscode-button>
        </div>
        <div class="quick-actions-presets">
          <vscode-button id="savePreset" appearance="secondary">Save preset</vscode-button>
          <vscode-button id="applyPreset" appearance="secondary">Apply preset</vscode-button>
        </div>
        <div class="boost-row">
          <label for="highlightBoost">Highlight boost</label>
          <input
            id="highlightBoost"
            type="range"
            min="0"
            max="40"
            step="1"
            value="${highlightBoostPercent}"
          />
          <div id="highlightBoostValue">${highlightBoostPercent}%</div>
        </div>
      </div>
      <div class="section-block">
        <div class="row">
          <div class="label">Base accent</div>
          <div class="controls">
            <input id="baseWheel" type="color" value="${baseColor}" />
            <vscode-text-field id="baseInput" value="${baseColor}"></vscode-text-field>
          </div>
          <div class="actions">
            <div id="baseHistory"></div>
            <vscode-button id="baseApply" appearance="secondary">Apply</vscode-button>
            <vscode-button id="baseClear" appearance="secondary">Clear base</vscode-button>
          </div>
        </div>
      </div>
      <div id="sections"></div>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      const reportError = (error) => {
        const message = error instanceof Error ? error.message : String(error);
        const banner = document.createElement('div');
        banner.className = 'error-banner';
        banner.textContent = 'Harbormaster UI error: ' + message;
        document.body.prepend(banner);
        try {
          vscode.postMessage({ type: 'uiError', message });
        } catch (err) {
          console.error(err);
        }
      };
      window.addEventListener('error', (event) => {
        reportError(event.error || event.message);
      });
      window.addEventListener('unhandledrejection', (event) => {
        reportError(event.reason);
      });

      try {
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
        if (value === null || value === undefined) return null;
        const trimmed = String(value).trim();
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
        if (value === null || value === undefined) return null;
        const trimmed = String(value).trim();
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
          targetInput.classList.remove('invalid');
          targetInput.style.removeProperty('--hm-invalid-bg');
          targetInput.style.removeProperty('--hm-invalid-fg');
          return;
        }
        const inverted = getBlinkColor(getDefaultBaseColor());
        targetInput.classList.add('invalid');
        targetInput.style.setProperty('--hm-invalid-bg', inverted || '');
        targetInput.style.setProperty('--hm-invalid-fg', getDefaultBaseColor());
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
        const dropdown = document.createElement('vscode-dropdown');
        dropdown.setAttribute('aria-label', 'Recent colors');
        const placeholder = document.createElement('vscode-option');
        placeholder.value = '';
        placeholder.textContent = 'Recent...';
        dropdown.appendChild(placeholder);
        values.forEach((value) => {
          const option = document.createElement('vscode-option');
          option.value = value;
          option.textContent = value;
          dropdown.appendChild(option);
        });
        dropdown.value = '';
        dropdown.addEventListener('change', () => {
          if (!dropdown.value) return;
          onSelect(dropdown.value);
          dropdown.value = '';
        });
        return dropdown;
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
        const badge = document.createElement('vscode-badge');
        badge.className = className;
        badge.textContent = text;
        return badge;
      };

      const createEyeButton = () => {
        const button = document.createElement('vscode-button');
        button.setAttribute('appearance', 'icon');
        button.className = 'eye-button';
        button.innerHTML = '<svg viewBox="0 0 24 24" role="img" aria-hidden="true"><path d="M2 12s4.5-7 10-7 10 7 10 7-4.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/></svg>';
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
          const input = row.querySelector('vscode-text-field');
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

        const input = document.createElement('vscode-text-field');
        input.value = section.color ? section.color : getDefaultBaseColor();

        bindColorPair(wheel, input, 'section:' + section.id);

        const actions = document.createElement('div');
        actions.className = 'actions';

        const history = buildHistoryDropdown(section.history || [], (value) => {
          input.value = value;
          wheel.value = value;
        });

        const inherit = document.createElement('vscode-button');
        inherit.className = 'inherit-toggle';
        inherit.setAttribute('appearance', 'secondary');
        inherit.textContent = 'Inherit';
        inherit.setAttribute('aria-pressed', row.dataset.inherit === '1' ? 'true' : 'false');
        inherit.addEventListener('click', () => {
          const next = row.dataset.inherit !== '1';
          row.dataset.inherit = next ? '1' : '0';
          inherit.setAttribute('aria-pressed', next ? 'true' : 'false');
          vscode.postMessage({ type: 'inheritSection', section: section.id, enabled: next });
        });

        const apply = document.createElement('vscode-button');
        apply.setAttribute('appearance', 'secondary');
        apply.textContent = 'Apply';
        apply.addEventListener('click', () => {
          row.dataset.override = '1';
          row.dataset.inherit = '0';
          inherit.setAttribute('aria-pressed', 'false');
          vscode.postMessage({ type: 'applySection', section: section.id, value: input.value });
        });

        const clear = document.createElement('vscode-button');
        clear.setAttribute('appearance', 'secondary');
        clear.textContent = 'Clear';
        clear.addEventListener('click', () => {
          row.dataset.override = '0';
          row.dataset.inherit = '1';
          inherit.setAttribute('aria-pressed', 'true');
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

        const input = document.createElement('vscode-text-field');
        input.value = group.color ? group.color : getDefaultBaseColor();

        bindColorPair(wheel, input, 'group:' + group.id);

        const actions = document.createElement('div');
        actions.className = 'actions';

        const history = buildHistoryDropdown(group.history || [], (value) => {
          input.value = value;
          wheel.value = value;
        });

        const inherit = document.createElement('vscode-button');
        inherit.className = 'inherit-toggle';
        inherit.setAttribute('appearance', 'secondary');
        inherit.textContent = 'Inherit';
        inherit.setAttribute('aria-pressed', row.dataset.inherit === '1' ? 'true' : 'false');
        inherit.addEventListener('click', () => {
          const next = row.dataset.inherit !== '1';
          row.dataset.inherit = next ? '1' : '0';
          inherit.setAttribute('aria-pressed', next ? 'true' : 'false');
          vscode.postMessage({ type: 'inheritGroup', group: group.id, enabled: next });
        });

        const apply = document.createElement('vscode-button');
        apply.setAttribute('appearance', 'secondary');
        apply.textContent = 'Apply';
        apply.addEventListener('click', () => {
          row.dataset.override = '1';
          row.dataset.inherit = '0';
          inherit.setAttribute('aria-pressed', 'false');
          vscode.postMessage({ type: 'applyGroup', group: group.id, value: input.value });
        });

        const clear = document.createElement('vscode-button');
        clear.setAttribute('appearance', 'secondary');
        clear.textContent = 'Clear';
        clear.addEventListener('click', () => {
          row.dataset.override = '0';
          row.dataset.inherit = '1';
          inherit.setAttribute('aria-pressed', 'true');
          input.value = getDefaultBaseColor();
          wheel.value = getDefaultBaseColor();
          vscode.postMessage({ type: 'clearGroup', group: group.id });
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

      const updateInheritedInputs = () => {
        const fallback = getDefaultBaseColor();
        document.querySelectorAll('.row[data-section-id]').forEach((row) => {
          if (row.dataset.inherit !== '1') return;
          if (row.dataset.override === '1') return;
          const inputs = row.querySelectorAll('input, vscode-text-field');
          inputs.forEach((input) => {
            if (input.tagName === 'VSCODE-TEXT-FIELD') input.value = fallback;
            if (input.type === 'color') input.value = fallback;
          });
        });
        document.querySelectorAll('.compact-row[data-group-id]').forEach((row) => {
          if (row.dataset.inherit !== '1') return;
          if (row.dataset.override === '1') return;
          const group = groupById.get(row.dataset.groupId);
          if (group && groupHasOverride(group)) return;
          const inputs = row.querySelectorAll('input, vscode-text-field');
          inputs.forEach((input) => {
            if (input.tagName === 'VSCODE-TEXT-FIELD') input.value = fallback;
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
        const summaryLeft = document.createElement('span');
        summaryLeft.className = 'summary-left';
        summaryLeft.textContent = section.label + ' groups';
        const chevron = document.createElement('span');
        chevron.className = 'chevron';
        chevron.textContent = '›';
        const hasOverrides = groups
          .filter((group) => group.section === section.id)
          .some((group) => groupHasOverride(group));
        if (hasOverrides) {
          summaryLeft.appendChild(createBadge('OVR', 'override'));
        }
        summary.appendChild(summaryLeft);
        summary.appendChild(chevron);
        details.addEventListener('toggle', () => {
          if (details.open) {
            openSections.add(section.id);
          } else {
            openSections.delete(section.id);
          }
          vscode.setState({ ...viewState, openSections: Array.from(openSections) });
        });
        details.appendChild(summary);

        const groupList = document.createElement('div');
        groupList.className = 'group-list';
        groups.filter((group) => group.section === section.id).forEach((group) => {
          groupList.appendChild(buildGroupRow(group));
        });
        details.appendChild(groupList);

        block.appendChild(details);
        sectionsRoot.appendChild(block);
      });
      } catch (err) {
        reportError(err);
      }
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
