/**
 * Wraps view body HTML in the standard Harbormaster webview shell.
 * Every sidebar view goes through this so the base structure is consistent.
 */
export function shell(cssUri: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${cssUri}" />
  <script>
    const vscode = acquireVsCodeApi();
    function send(type, payload) {
      vscode.postMessage({ type, ...(payload ?? {}) });
    }
  </script>
</head>
<body>
  ${body}
</body>
</html>`;
}
