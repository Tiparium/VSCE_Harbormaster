import * as vscode from 'vscode';
import * as path from 'path';
import type { AiTool } from '../types/global';
import type { SettingsStore } from '../store/settings';
import {
  MCP_SUPPORTED_TOOLS,
  isToolInstalled,
  registerMcpServer,
  getToolLabel,
} from '../mcp/registration';

type ToolDef = {
  tool: AiTool;
  label: string;
  inDevelopment: boolean;
};

const ALL_TOOLS: ToolDef[] = [
  { tool: 'claude', label: 'Claude Code', inDevelopment: false },
  { tool: 'cursor', label: 'Cursor', inDevelopment: false },
  { tool: 'codex', label: 'Codex (OpenAI)', inDevelopment: false },
  { tool: 'copilot', label: 'GitHub Copilot', inDevelopment: true },
  { tool: 'windsurf', label: 'Windsurf', inDevelopment: true },
];

export class SetupManager {
  constructor(
    private readonly settings: SettingsStore,
    private readonly extensionPath: string
  ) {}

  private get standalonePath(): string {
    return path.join(this.extensionPath, 'out', 'mcp', 'standalone.js');
  }

  async hasPendingSteps(): Promise<boolean> {
    const s = await this.settings.read();
    if (s.activeAiTools.length === 0) return true;
    return s.activeAiTools.some(
      (tool) => MCP_SUPPORTED_TOOLS.includes(tool) && !s.registeredMcpTools.includes(tool)
    );
  }

  /** Run all pending setup steps. Returns true if setup completed fully. */
  async run(): Promise<boolean> {
    const s = await this.settings.read();

    // ── Step 1: AI tool selection ─────────────────────────────────────────────
    let activeTools = s.activeAiTools;
    if (activeTools.length === 0) {
      const selected = await promptAiTools();
      if (selected === undefined) return false; // user cancelled
      await this.settings.setActiveAiTools(selected);
      activeTools = selected;
    }

    // ── Step 2: MCP registration for unregistered tools ───────────────────────
    const registered = s.registeredMcpTools;
    const needsRegistration = activeTools.filter(
      (tool) => MCP_SUPPORTED_TOOLS.includes(tool) && !registered.includes(tool)
    );

    for (const tool of needsRegistration) {
      const installed = await isToolInstalled(tool);
      if (!installed) {
        // Tool not detected on this machine — skip silently.
        continue;
      }

      const label = getToolLabel(tool);
      const answer = await vscode.window.showInformationMessage(
        `Register Harbormaster's MCP server for ${label}? This enables context tools (harbormaster_full_context_get, branch_get, etc.) in your ${label} sessions.`,
        { modal: false },
        'Register',
        'Skip'
      );

      if (answer === 'Register') {
        try {
          await registerMcpServer(tool, this.standalonePath);
          await this.settings.addRegisteredMcpTool(tool);
          void vscode.window.showInformationMessage(
            `Harbormaster: MCP server registered for ${label}. Restart ${label} to apply.`
          );
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          void vscode.window.showWarningMessage(
            `Harbormaster: could not register MCP server for ${label}. ${detail}`
          );
        }
      }
    }

    return true;
  }

  /** Re-run AI tool selection only, keeping existing MCP registrations. */
  async reconfigureAiTools(): Promise<void> {
    const s = await this.settings.read();
    const selected = await promptAiTools(s.activeAiTools);
    if (selected === undefined) return;
    await this.settings.setActiveAiTools(selected);

    // Offer MCP registration for any newly added tools.
    const registered = s.registeredMcpTools;
    const newlyAdded = selected.filter(
      (tool) => MCP_SUPPORTED_TOOLS.includes(tool) && !registered.includes(tool)
    );

    for (const tool of newlyAdded) {
      const installed = await isToolInstalled(tool);
      if (!installed) continue;
      const label = getToolLabel(tool);
      const answer = await vscode.window.showInformationMessage(
        `Register Harbormaster's MCP server for ${label}?`,
        'Register',
        'Skip'
      );
      if (answer === 'Register') {
        try {
          await registerMcpServer(tool, this.standalonePath);
          await this.settings.addRegisteredMcpTool(tool);
          void vscode.window.showInformationMessage(
            `Harbormaster: MCP server registered for ${label}. Restart ${label} to apply.`
          );
        } catch {
          void vscode.window.showWarningMessage(`Harbormaster: could not register MCP server for ${label}.`);
        }
      }
    }
  }

  /** Re-run MCP registration for all active tools that support it. */
  async reconfigureMcp(): Promise<void> {
    const s = await this.settings.read();
    const eligible = s.activeAiTools.filter((tool) => MCP_SUPPORTED_TOOLS.includes(tool));

    if (eligible.length === 0) {
      void vscode.window.showInformationMessage(
        'No MCP-capable tools configured. Run "Manage AI Tools" first.'
      );
      return;
    }

    for (const tool of eligible) {
      const installed = await isToolInstalled(tool);
      const label = getToolLabel(tool);
      const alreadyRegistered = s.registeredMcpTools.includes(tool);
      const prompt = alreadyRegistered
        ? `Re-register Harbormaster's MCP server for ${label}? (already registered)`
        : `Register Harbormaster's MCP server for ${label}?`;

      if (!installed) {
        void vscode.window.showWarningMessage(
          `Harbormaster: ${label} does not appear to be installed — skipping MCP registration.`
        );
        continue;
      }

      const answer = await vscode.window.showInformationMessage(prompt, 'Register', 'Skip');
      if (answer === 'Register') {
        try {
          await registerMcpServer(tool, this.standalonePath);
          await this.settings.addRegisteredMcpTool(tool);
          void vscode.window.showInformationMessage(
            `Harbormaster: MCP server registered for ${label}. Restart ${label} to apply.`
          );
        } catch {
          void vscode.window.showWarningMessage(`Harbormaster: could not register MCP server for ${label}.`);
        }
      }
    }
  }
}

async function promptAiTools(current: AiTool[] = []): Promise<AiTool[] | undefined> {
  type PickItem = vscode.QuickPickItem & { tool?: AiTool; inDevelopment?: boolean };

  const items: PickItem[] = [
    { label: 'Available', kind: vscode.QuickPickItemKind.Separator },
    ...ALL_TOOLS.filter((t) => !t.inDevelopment).map((t) => ({
      label: t.label,
      tool: t.tool,
      picked: current.includes(t.tool),
    })),
    { label: 'Support in development', kind: vscode.QuickPickItemKind.Separator },
    ...ALL_TOOLS.filter((t) => t.inDevelopment).map((t) => ({
      label: `$(watch) ${t.label}`,
      description: 'Coming soon',
      tool: t.tool,
      inDevelopment: true,
      picked: false,
    })),
  ];

  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: 'Harbormaster: AI Tool Setup',
    placeHolder: 'Select the AI coding tools you use',
    ignoreFocusOut: true,
  });

  if (!picked) return undefined;

  // Filter out in-development tools even if the user managed to select them.
  return picked
    .filter((item): item is PickItem & { tool: AiTool } => !!item.tool && !item.inDevelopment)
    .map((item) => item.tool);
}
