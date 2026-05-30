import * as vscode from 'vscode';
import type { GlobalData } from '../types/global';
import { defaultGlobalData } from '../types/global';
import { migrateGlobalData } from './migration';

const GLOBAL_FILE = 'harbormaster.global.json';

// Legacy filenames for migration compatibility (dual-write during transition).
const LEGACY_CATALOG_FILE = 'projects.json';
const LEGACY_TAGS_FILE = 'tags.json';
const LEGACY_PRESETS_FILE = 'color-presets.json';

export class GlobalStore {
  private readonly globalUri: vscode.Uri;
  private readonly legacyCatalogUri: vscode.Uri;
  private readonly legacyTagsUri: vscode.Uri;
  private readonly legacyPresetsUri: vscode.Uri;

  constructor(private readonly storageUri: vscode.Uri) {
    this.globalUri = vscode.Uri.joinPath(storageUri, GLOBAL_FILE);
    this.legacyCatalogUri = vscode.Uri.joinPath(storageUri, LEGACY_CATALOG_FILE);
    this.legacyTagsUri = vscode.Uri.joinPath(storageUri, LEGACY_TAGS_FILE);
    this.legacyPresetsUri = vscode.Uri.joinPath(storageUri, LEGACY_PRESETS_FILE);
  }

  async read(): Promise<GlobalData> {
    const existing = await this.readJson(this.globalUri);
    if (existing !== null) {
      return migrateGlobalData(existing);
    }

    // First run — migrate from legacy files.
    const legacy = {
      catalog: await this.readJson(this.legacyCatalogUri),
      tags: await this.readJson(this.legacyTagsUri),
      colorPresets: await this.readJson(this.legacyPresetsUri),
    };

    const migrated = migrateGlobalData(null, legacy);
    await this.write(migrated);
    return migrated;
  }

  async write(data: GlobalData): Promise<void> {
    await this.ensureDirectory(this.globalUri);
    await this.writeJson(this.globalUri, data);

    // Dual-write to legacy files so the old extension version still works.
    await this.writeLegacyMirrors(data);
  }

  private async writeLegacyMirrors(data: GlobalData): Promise<void> {
    try {
      await this.ensureDirectory(this.legacyCatalogUri);
      await this.writeJson(this.legacyCatalogUri, data.catalog);
      await this.writeJson(this.legacyTagsUri, { tags: data.tags });
      await this.writeJson(this.legacyPresetsUri, data.colorPresets);
    } catch {
      // Legacy mirror writes are best-effort — never fail the main write.
    }
  }

  private async readJson(uri: vscode.Uri): Promise<unknown | null> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      return JSON.parse(Buffer.from(content).toString('utf8'));
    } catch {
      return null;
    }
  }

  private async writeJson(uri: vscode.Uri, value: unknown): Promise<void> {
    await vscode.workspace.fs.writeFile(
      uri,
      Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8')
    );
  }

  private async ensureDirectory(uri: vscode.Uri): Promise<void> {
    const segments = uri.path.split('/');
    segments.pop();
    const dirUri = uri.with({ path: segments.join('/') || '/' });
    await vscode.workspace.fs.createDirectory(dirUri);
  }
}

export function createGlobalStore(context: vscode.ExtensionContext): GlobalStore {
  return new GlobalStore(context.globalStorageUri);
}
