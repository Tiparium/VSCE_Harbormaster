import type { GlobalSettings, AiTool } from '../types/global';
import type { GlobalStoreApi as GlobalStore } from './globalStore';

export class SettingsStore {
  constructor(private readonly store: GlobalStore) {}

  async read(): Promise<GlobalSettings> {
    const data = await this.store.read();
    return {
      activeAiTools: data.settings.activeAiTools ?? [],
      registeredMcpTools: data.settings.registeredMcpTools ?? [],
      projectCreateDefaultFolder: data.settings.projectCreateDefaultFolder ?? '',
    };
  }

  async setActiveAiTools(tools: AiTool[]): Promise<void> {
    await this.store.update((data) => { data.settings.activeAiTools = tools; });
  }

  async addAiTool(tool: AiTool): Promise<void> {
    await this.store.update((data) => {
      if (!data.settings.activeAiTools.includes(tool)) data.settings.activeAiTools.push(tool);
    });
  }

  async removeAiTool(tool: AiTool): Promise<void> {
    await this.store.update((data) => {
      data.settings.activeAiTools = data.settings.activeAiTools.filter((t) => t !== tool);
    });
  }

  async addRegisteredMcpTool(tool: AiTool): Promise<void> {
    await this.store.update((data) => {
      if (!data.settings.registeredMcpTools) data.settings.registeredMcpTools = [];
      if (!data.settings.registeredMcpTools.includes(tool)) data.settings.registeredMcpTools.push(tool);
    });
  }

  async setProjectCreateDefaultFolder(path: string): Promise<void> {
    await this.store.update((data) => { data.settings.projectCreateDefaultFolder = path; });
  }
}
