import { shell } from '../shell';

type HomeProps = {
  projectName?: string;
  hasGit: boolean;
};

export function renderHomeView(cssUri: string, props: HomeProps): string {
  const { projectName, hasGit } = props;
  const title = projectName ?? '(No project config)';

  const body = `
    <div class="view-shell">
      <div class="view-top">
        <span class="project-name">${esc(title)}</span>
      </div>
      <div class="view-canvas">
        <div class="action-group">
          <button onclick="send('command', { command: 'harbormaster.openConfig' })">Open config</button>
          <button onclick="send('command', { command: 'harbormaster.rebuildState' })">Rebuild state</button>
        </div>
        <div class="action-group">
          <button onclick="send('navigate', { view: 'catalog' })">Project catalog</button>
          <button onclick="send('navigate', { view: 'accent' })">Color settings</button>
        </div>
        ${hasGit ? `
        <div class="action-group">
          <button onclick="send('command', { command: 'harbormaster.snapshotState' })">Snapshot Harbormaster state</button>
        </div>` : ''}
      </div>
    </div>
  `;

  return shell(cssUri, body);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
