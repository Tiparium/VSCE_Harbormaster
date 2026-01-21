import * as vscode from 'vscode';

import { getAccentBreakpointPickerHtml } from './breakpointPicker';

export async function setAccentPickerBreakpoint(current: number, defaultValue: number): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'harbormasterAccentBreakpoint',
    'Accent Picker Breakpoint',
    vscode.ViewColumn.Active,
    { enableScripts: true }
  );

  panel.webview.html = getAccentBreakpointPickerHtml(current, defaultValue);
  panel.webview.onDidReceiveMessage(async (message) => {
    if (!message || typeof message !== 'object') {
      return;
    }
    if (message.type === 'setBreakpoint' && typeof message.value === 'number') {
      const value = Math.round(message.value);
      if (!Number.isFinite(value)) {
        return;
      }
      const targetConfig = vscode.workspace.getConfiguration('projectWindowTitle');
      await targetConfig.update('accentPickerBreakpoint', value, vscode.ConfigurationTarget.Workspace);
    }
    if (message.type === 'resetBreakpoint') {
      const targetConfig = vscode.workspace.getConfiguration('projectWindowTitle');
      await targetConfig.update('accentPickerBreakpoint', defaultValue, vscode.ConfigurationTarget.Workspace);
    }
  });
}
