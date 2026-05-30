import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import type { WebviewMessage } from './types';

declare global {
  interface Window {
    __hm_send?: (msg: WebviewMessage) => void;
  }
}

// Acquire the VS Code API and expose a typed send function globally
// so any component can post messages without prop-drilling the API.
const vscode = acquireVsCodeApi();
window.__hm_send = (msg: WebviewMessage) => vscode.postMessage(msg);

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
