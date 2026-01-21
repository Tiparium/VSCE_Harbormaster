export function getAccentBreakpointPickerHtml(current: number, defaultValue: number): string {
  const normalized = Number.isFinite(current) ? Math.round(current) : defaultValue;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        padding: 16px;
      }
      .row {
        display: grid;
        grid-template-columns: 140px minmax(0, 1fr) 80px;
        align-items: center;
        gap: 12px;
      }
      input[type='range'] {
        width: 100%;
      }
      button {
        margin-top: 12px;
        padding: 6px 10px;
      }
    </style>
  </head>
  <body>
    <div class="row">
      <label for="breakpoint">Breakpoint</label>
      <input id="breakpoint" type="range" min="320" max="1400" step="10" value="${normalized}" />
      <div id="value">${normalized}px</div>
    </div>
    <button id="reset">Reset default</button>
    <script>
      const vscode = acquireVsCodeApi();
      const slider = document.getElementById('breakpoint');
      const value = document.getElementById('value');
      const reset = document.getElementById('reset');

      const sync = () => {
        const next = Number(slider.value);
        value.textContent = next + 'px';
        vscode.postMessage({ type: 'setBreakpoint', value: next });
      };

      slider.addEventListener('input', sync);
      reset.addEventListener('click', () => {
        slider.value = ${defaultValue};
        sync();
        vscode.postMessage({ type: 'resetBreakpoint' });
      });
    </script>
  </body>
</html>`;
}
