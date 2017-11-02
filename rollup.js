const fs = require('fs');
const rollup = require('rollup');
const pkg = require('./package.json');

const banner = `/**
 * @module ${ pkg.name }
 * @author ${ pkg.author.name }
 * @license ${ pkg.license }
 * @version ${ pkg.version }
 * @description ${ pkg.description }
 * @see ${ pkg.homepage }
 */
`;

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
    strict: false,
    interop: false,
    banner: banner
  });
}).catch(function(error) {
  console.error(error);
});
