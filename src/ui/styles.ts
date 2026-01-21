export const BASE_WEBVIEW_STYLES = `
  :root {
    color-scheme: light dark;
  }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    padding: 14px 14px 24px;
    color: var(--vscode-foreground);
    background: radial-gradient(circle at top, rgba(255,255,255,0.05), transparent 45%),
      var(--vscode-sideBar-background);
  }
  h2 {
    margin: 0 0 12px 0;
  }
  .panel-card {
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--hm-border, rgba(127, 127, 127, 0.2));
    background: var(--hm-card-bg, rgba(0, 0, 0, 0.12));
  }
  .section-title {
    margin: 0 0 8px 0;
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .pill {
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--hm-pill-bg, rgba(127, 127, 127, 0.2));
  }
  button {
    text-align: left;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--hm-border, rgba(127, 127, 127, 0.2));
    background: var(--hm-button-bg, var(--vscode-button-secondaryBackground));
    color: var(--vscode-button-secondaryForeground);
    cursor: pointer;
  }
  button:hover {
    background: var(--hm-button-hover, var(--vscode-button-secondaryHoverBackground));
  }
  input[type="text"],
  select {
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(127, 127, 127, 0.2);
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
  }
  input[type="color"] {
    width: 42px;
    height: 32px;
    padding: 0;
    border: none;
    background: transparent;
  }
`;
