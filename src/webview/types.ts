/** Data the extension host pushes to the sidebar webview. */
export type SidebarData = {
  projectName: string;
  version: string;
  tags: string[];
  isHarbormasterProject: boolean;
};

/** Messages the extension host sends to the webview. */
export type ExtensionMessage =
  | { type: 'update'; data: SidebarData };

/** Messages the webview sends back to the extension host. */
export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'command'; command: string };
