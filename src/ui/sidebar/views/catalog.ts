import { shell } from '../shell';
import type { CatalogProject } from '../../../types/project';

export function renderCatalogView(cssUri: string, projects: CatalogProject[]): string {
  const items = projects.length
    ? projects.map((p) => `
        <div class="catalog-item" onclick="openProject(${JSON.stringify(p.path)})">
          <span class="catalog-name">${esc(p.name)}</span>
          ${p.tags.length ? `<span class="catalog-tags">${p.tags.map(esc).join(', ')}</span>` : ''}
          <small class="catalog-path">${esc(p.path)}</small>
        </div>
      `).join('')
    : '<p class="empty-state">No projects in catalog yet.</p>';

  const script = `
    function send(type, payload) {
      vscode.postMessage({ type, ...payload });
    }
    function openProject(path) {
      send('openProject', { path });
    }
  `;

  const body = `
    <div class="view-shell">
      <div class="view-top">
        <button class="back-btn" onclick="send('navigate', { view: 'home' })">← Back</button>
        <span>Projects</span>
        <button onclick="send('command', { command: 'harbormaster.createProject' })">+ New</button>
      </div>
      <div class="view-canvas">
        <div class="catalog-list">${items}</div>
      </div>
    </div>
    <script>${script}</script>
  `;

  return shell(cssUri, body);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
