type ViewShellOptions = {
  backButtonHtml?: string;
};

export function renderViewShell(contentHtml: string, options: ViewShellOptions = {}): string {
  const backButton = options.backButtonHtml ?? '';
  return `
    <div class="view-shell">
      ${backButton}
      <div class="view-canvas">
        ${contentHtml}
      </div>
    </div>
  `;
}
