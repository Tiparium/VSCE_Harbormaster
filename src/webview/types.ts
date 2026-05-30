/** Data the extension host pushes to the sidebar webview. */
export type SidebarData = {
  projectName: string;
  version: string;
  tags: string[];
  isHarbormasterProject: boolean;
  activeAiTools: string[];
  registeredMcpTools: string[];
};

/** Messages the extension host sends to the webview. */
export type ExtensionMessage =
  | { type: 'update'; data: SidebarData };

/** Messages the webview sends back to the extension host. */
export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'command'; command: string };

export type HarbormasterCommand =
  | 'harbormaster.openCatalog'
  | 'harbormaster.createProject'
  | 'harbormaster.setAccent'
  | 'harbormaster.manageAiTools'
  | 'harbormaster.manageMcp'
  | 'harbormaster.runSetup'
  | 'harbormaster.snapshotState';
