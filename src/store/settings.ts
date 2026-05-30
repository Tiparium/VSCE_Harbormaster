import type { GlobalSettings, AiTool } from '../types/global';
import type { GlobalStore } from './globalStore';

export class SettingsStore {
  constructor(private readonly store: GlobalStore) {}

  async read(): Promise<GlobalSettings> {
    const data = await this.store.read();
    return data.settings;
  }

  async setActiveAiTools(tools: AiTool[]): Promise<void> {
    const data = await this.store.read();
    data.settings.activeAiTools = tools;
    await this.store.write(data);
  }

  async addAiTool(tool: AiTool): Promise<void> {
    const data = await this.store.read();
    if (!data.settings.activeAiTools.includes(tool)) {
      data.settings.activeAiTools.push(tool);
      await this.store.write(data);
    }
  }

  async removeAiTool(tool: AiTool): Promise<void> {
    const data = await this.store.read();
    data.settings.activeAiTools = data.settings.activeAiTools.filter((t) => t !== tool);
    await this.store.write(data);
  }

  async setProjectCreateDefaultFolder(path: string): Promise<void> {
    const data = await this.store.read();
    data.settings.projectCreateDefaultFolder = path;
    await this.store.write(data);
  }
}
