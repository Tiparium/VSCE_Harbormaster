const esbuild = require('esbuild');
const fs = require('fs');

const watch = process.argv.includes('--watch');
const prod = process.env.NODE_ENV === 'production';

const builds = [
  {
    entryPoints: ['src/extension.ts'],
    outfile: 'out/extension.js',
    external: ['vscode'],
  },
  {
    entryPoints: ['src/mcp/standalone.ts'],
    outfile: 'out/mcp/standalone.js',
    external: [],
  },
];

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  minify: prod,
  sourcemap: !prod,
};

async function run() {
  if (!watch) fs.rmSync('out', { recursive: true, force: true });
  if (watch) {
    const contexts = await Promise.all(builds.map((build) => esbuild.context({ ...common, ...build })));
    await Promise.all(contexts.map((context) => context.watch()));
    return;
  }
  await Promise.all(builds.map((build) => esbuild.build({ ...common, ...build })));
}

run().catch(() => process.exit(1));

