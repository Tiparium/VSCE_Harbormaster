import * as vscode from 'vscode';

export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.text = '$(symbol-misc) Harbormaster';
    this.item.command = 'projectWindowTitle.showMenu';
    this.item.tooltip = 'Harbormaster menu';
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
