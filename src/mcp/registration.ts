import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { AiTool } from '../types/global';

export const MCP_SUPPORTED_TOOLS: AiTool[] = ['claude', 'cursor', 'codex'];

type ToolConfig = {
  label: string;
  configPath: string;
  format: 'json' | 'toml';
  /** Directory that exists when the tool is installed. */
  installDir: string;
};

const TOOL_CONFIGS: Partial<Record<AiTool, ToolConfig>> = {
  claude: {
    label: 'Claude Code',
    configPath: path.join(os.homedir(), '.claude', 'mcp.json'),
    installDir: path.join(os.homedir(), '.claude'),
    format: 'json',
  },
  cursor: {
    label: 'Cursor',
    configPath: path.join(os.homedir(), '.cursor', 'mcp.json'),
    installDir: path.join(os.homedir(), '.cursor'),
    format: 'json',
  },
  codex: {
    label: 'Codex (OpenAI)',
    configPath: path.join(os.homedir(), '.codex', 'config.toml'),
    installDir: path.join(os.homedir(), '.codex'),
    format: 'toml',
  },
};

/** Returns true if the tool's config directory exists on this machine. */
export async function isToolInstalled(tool: AiTool): Promise<boolean> {
  const config = TOOL_CONFIGS[tool];
  if (!config) return false;
  try {
    await fs.access(config.installDir);
    return true;
  } catch {
    return false;
  }
}

export function getToolLabel(tool: AiTool): string {
  return TOOL_CONFIGS[tool]?.label ?? tool;
}

/** Writes or updates the Harbormaster MCP server entry in the tool's config. */
export async function registerMcpServer(tool: AiTool, standalonePath: string): Promise<void> {
  const config = TOOL_CONFIGS[tool];
  if (!config) throw new Error(`MCP registration not supported for ${tool}`);

  await fs.mkdir(path.dirname(config.configPath), { recursive: true });

  if (config.format === 'json') {
    await registerJsonMcp(config.configPath, standalonePath);
  } else {
    await registerTomlMcp(config.configPath, standalonePath);
  }
}

async function registerJsonMcp(configPath: string, standalonePath: string): Promise<void> {
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(configPath, 'utf8'));
  } catch {
    // File doesn't exist or is invalid — start fresh.
  }
  if (!existing.mcpServers || typeof existing.mcpServers !== 'object') {
    existing.mcpServers = {};
  }
  (existing.mcpServers as Record<string, unknown>).harbormaster = {
    command: 'node',
    args: [standalonePath],
  };
  await fs.writeFile(configPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
}

async function registerTomlMcp(configPath: string, standalonePath: string): Promise<void> {
  let content = '';
  try {
    content = await fs.readFile(configPath, 'utf8');
  } catch {
    // File doesn't exist — start fresh.
  }

  const escapedPath = standalonePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const sectionHeader = '[mcp_servers.harbormaster]';
  const newSection = `${sectionHeader}\ncommand = "node"\nargs = ["${escapedPath}"]\n`;

  if (content.includes(sectionHeader)) {
    // Replace the existing section (everything up to the next section header or EOF).
    const start = content.indexOf(sectionHeader);
    const nextSection = content.indexOf('\n[', start + 1);
    const end = nextSection === -1 ? content.length : nextSection;
    const before = content.slice(0, start).trimEnd();
    const after = content.slice(end).trimStart();
    const parts = [before, newSection, after].filter(Boolean);
    content = parts.join('\n');
  } else {
    const base = content.trimEnd();
    content = base ? `${base}\n\n${newSection}` : newSection;
  }

  await fs.writeFile(configPath, content, 'utf8');
}
