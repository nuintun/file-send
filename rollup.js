const fs = require('fs');
const rollup = require('rollup');

rollup.rollup({
  input: 'index.js',
  external: [
    'fs', 'path', 'events', 'http', 'url',
    'stream', 'ms', 'etag', 'fresh', 'destroy',
    'mime-types', 'encodeurl', 'micromatch',
    'on-finished', 'escape-html', 'range-parser'
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
    strict: true
  });
}).catch(function(error) {
  console.error(error);
});
