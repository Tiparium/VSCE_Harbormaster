import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { afterEach, describe, expect, it } from 'vitest';
import { GlobalStore } from '../../src/store/globalStore';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('GlobalStore', () => {
  it('serializes concurrent mutations from separate instances', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'harbormaster-global-'));
    tempDirs.push(dir);
    const first = new GlobalStore(dir, true);
    const second = new GlobalStore(dir, true);

    await Promise.all([
      first.update((data) => { data.tags.push('one'); }),
      second.update((data) => { data.tags.push('two'); }),
    ]);

    expect((await first.read()).tags.sort()).toEqual(['one', 'two']);
  });
});
