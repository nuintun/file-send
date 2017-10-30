const fs = require('fs');
const rollup = require('rollup');

const banner = `/**
 * @module file-send
 * @license MIT
 * @version 2017/10/25
 */
`

rollup.rollup({
  input: 'index.js',
  external: [
    'fs', 'path', 'http', 'url', 'stream', 'ms', 'etag', 'fresh',
    'destroy', 'mime-types', 'encodeurl', 'micromatch',
    'on-finished', 'escape-html', 'range-parser', 'events'
  ]
}).then(function(bundle) {
  let stat;

  try {
    stat = fs.statSync('dist')
  } catch (e) {
    // no such file or directory
  }

  if (!stat) {
    fs.mkdirSync('dist');
  }

  bundle.write({
    file: 'dist/index.js',
    format: 'cjs',
    indent: true,
    strict: true,
    interop: false,
    banner: banner
  });
}).catch(function(error) {
  console.error(error);
});
