import * as fs from 'fs/promises';
import * as path from 'path';
import type * as vscode from 'vscode';
import type { GlobalData } from '../types/global';
import { migrateGlobalData } from './migration';

export interface GlobalStoreApi {
  read(): Promise<GlobalData>;
  write(data: GlobalData): Promise<void>;
  update<T>(mutator: (data: GlobalData) => T | Promise<T>): Promise<T>;
}

const GLOBAL_FILE = 'harbormaster.global.json';
const DEV_GLOBAL_FILE = 'harbormaster.global.dev.json';
const LEGACY_CATALOG_FILE = 'projects.json';
const LEGACY_TAGS_FILE = 'tags.json';
const LEGACY_PRESETS_FILE = 'color-presets.json';
const LOCK_STALE_MS = 30_000;
const LOCK_RETRY_MS = 25;
const LOCK_ATTEMPTS = 200;

/**
 * File-backed global store shared by the extension host and standalone MCP
 * processes. Mutations are serialized with a cross-process lock and committed
 * through an atomic rename so independent feature writes cannot clobber each
 * other or leave a partially written database.
 */
export class GlobalStore implements GlobalStoreApi {
  private readonly filePath: string;

  constructor(
    private readonly storagePath: string,
    private readonly devMode: boolean
  ) {
    this.filePath = path.join(storagePath, devMode ? DEV_GLOBAL_FILE : GLOBAL_FILE);
  }

  async read(): Promise<GlobalData> {
    const existing = await readJson(this.filePath);
    if (existing !== undefined) return migrateGlobalData(existing);
    if (this.devMode) return migrateGlobalData(null);

    const legacy = {
      catalog: await readJson(path.join(this.storagePath, LEGACY_CATALOG_FILE)),
      tags: await readJson(path.join(this.storagePath, LEGACY_TAGS_FILE)),
      colorPresets: await readJson(path.join(this.storagePath, LEGACY_PRESETS_FILE)),
    };
    return migrateGlobalData(null, legacy);
  }

  async write(data: GlobalData): Promise<void> {
    await this.withLock(async () => {
      await this.writeUnlocked(data);
    });
  }

  async update<T>(mutator: (data: GlobalData) => T | Promise<T>): Promise<T> {
    return this.withLock(async () => {
      const data = await this.read();
      const result = await mutator(data);
      await this.writeUnlocked(data);
      return result;
    });
  }

  private async writeUnlocked(data: GlobalData): Promise<void> {
    await fs.mkdir(this.storagePath, { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    await fs.rename(tempPath, this.filePath);

    if (!this.devMode) {
      await Promise.allSettled([
        writeJsonAtomic(path.join(this.storagePath, LEGACY_CATALOG_FILE), data.catalog),
        writeJsonAtomic(path.join(this.storagePath, LEGACY_TAGS_FILE), { tags: data.tags }),
        writeJsonAtomic(path.join(this.storagePath, LEGACY_PRESETS_FILE), data.colorPresets),
      ]);
    }
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const lockPath = `${this.filePath}.lock`;
    await fs.mkdir(this.storagePath, { recursive: true });

    for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt++) {
      try {
        await fs.mkdir(lockPath);
        try {
          return await operation();
        } finally {
          await fs.rmdir(lockPath).catch(() => undefined);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        await removeStaleLock(lockPath);
        await delay(LOCK_RETRY_MS);
      }
    }

    throw new Error(`Timed out waiting for Harbormaster global store lock: ${lockPath}`);
  }
}

export function createGlobalStore(context: vscode.ExtensionContext): GlobalStore {
  return new GlobalStore(
    context.globalStorageUri.fsPath,
    context.extensionMode === 2 // vscode.ExtensionMode.Development
  );
}

async function readJson(filePath: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new Error(`Unable to read Harbormaster data at ${filePath}: ${String(error)}`);
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await fs.rename(tempPath, filePath);
}

async function removeStaleLock(lockPath: string): Promise<void> {
  try {
    const stat = await fs.stat(lockPath);
    if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
      await fs.rmdir(lockPath);
    }
  } catch {
    // Another process released the lock between checks.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
