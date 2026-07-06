import * as fs from 'fs/promises';
import * as path from 'path';

const LOCK_STALE_MS = 30_000;
const LOCK_RETRY_MS = 25;
const LOCK_ATTEMPTS = 200;

export async function withFileLock<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
  const lockPath = `${filePath}.lock`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
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
  throw new Error(`Timed out waiting for file lock: ${filePath}`);
}

export async function writeTextAtomic(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await writeTextAtomic(filePath, JSON.stringify(value, null, 2) + '\n');
}

async function removeStaleLock(lockPath: string): Promise<void> {
  try {
    const stat = await fs.stat(lockPath);
    if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) await fs.rmdir(lockPath);
  } catch {
    // Another process released the lock between checks.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

