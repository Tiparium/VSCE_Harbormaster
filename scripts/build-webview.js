const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');
const prod = process.env.NODE_ENV === 'production';

const options = {
  entryPoints: ['src/webview/index.tsx'],
  bundle: true,
  outfile: 'out/webview.js',
  platform: 'browser',
  jsx: 'automatic',
  minify: prod,
  sourcemap: !prod,
};

if (watch) {
  esbuild.context(options).then((ctx) => ctx.watch());
} else {
  esbuild.build(options).catch(() => process.exit(1));
}
