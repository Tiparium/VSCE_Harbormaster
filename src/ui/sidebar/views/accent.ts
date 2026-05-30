import { shell } from '../shell';
import type { ProjectAccent } from '../../../types/project';

export function renderAccentView(cssUri: string, accent?: ProjectAccent): string {
  const zones = [
    { id: 'frame', label: 'Frame', hint: 'Title bar & activity bar background' },
    { id: 'accent', label: 'Accent', hint: 'Highlights, badges, buttons, cursor' },
    { id: 'surface', label: 'Surface', hint: 'Sidebar & panel background' },
  ] as const;

  const rows = zones.map(({ id, label, hint }) => {
    const current = accent?.[id] ?? '';
    return `
      <div class="zone-row">
        <div class="zone-label">
          <span>${label}</span>
          <small>${hint}</small>
        </div>
        <div class="zone-controls">
          <input
            type="color"
            value="${current || '#1e1e1e'}"
            oninput="preview('${id}', this.value)"
            onchange="setZone('${id}', this.value)"
          />
          ${current ? `<button class="clear-btn" onclick="clearZone('${id}')">✕</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const script = `
    function send(type, payload) {
      vscode.postMessage({ type, ...payload });
    }
    function preview(zone, value) {
      // Preview fires on every color picker move — committed on change
    }
    function setZone(zone, value) {
      send('setAccentZone', { zone, value });
    }
    function clearZone(zone) {
      send('setAccentZone', { zone, value: null });
    }
    function clearAll() {
      send('clearAccent', {});
    }
  `;

  const body = `
    <div class="view-shell">
      <div class="view-top">
        <button class="back-btn" onclick="send('navigate', { view: 'home' })">← Back</button>
        <span>Color settings</span>
      </div>
      <div class="view-canvas">
        <div class="zones">${rows}</div>
        <div class="action-group">
          <button onclick="clearAll()">Clear all</button>
        </div>
      </div>
    </div>
    <script>${script}</script>
  `;

  return shell(cssUri, body);
}
