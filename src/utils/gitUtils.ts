import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function isGitRepo(folderPath: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --is-inside-work-tree', { cwd: folderPath });
    return true;
  } catch {
    return false;
  }
}

export async function snapshotHarbormaster(folderPath: string): Promise<{ success: boolean; message: string }> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await execAsync('git add -f .harbormaster/', { cwd: folderPath });
    await execAsync(`git commit -m "Harbormaster state snapshot ${timestamp}"`, { cwd: folderPath });
    return { success: true, message: `Snapshot committed: ${timestamp}` };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { success: false, message: detail };
  }
}
