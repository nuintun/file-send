'use strict';

const fs = require('fs');
const rollup = require('rollup');
const uglify = require('uglify-es');
const pkg = require('./package.json');

const banner = `/**
 * @module ${pkg.name}
 * @author ${pkg.author.name}
 * @license ${pkg.license}
 * @version ${pkg.version}
 * @description ${pkg.description}
 * @see ${pkg.homepage}
 */
`;

rollup
  .rollup({
    input: 'index.js',
    external: [
      'fs',
      'path',
      'http',
      'url',
      'stream',
      'ms',
      'etag',
      'fresh',
      'destroy',
      'mime-types',
      'encodeurl',
      'micromatch',
      'on-finished',
      'escape-html',
      'range-parser',
      'events'
    ]
  })
  .then(function(bundle) {
    try {
      fs.statSync('dist');
    } catch (e) {
      // no such file or directory
      fs.mkdirSync('dist');
    }

    bundle
      .generate({
        format: 'cjs',
        strict: true,
        indent: true,
        interop: false,
        banner: banner
      })
      .then(function(result) {
        const src = 'dist/index.js';
        const min = 'dist/index.min.js';

        fs.writeFileSync(src, result.code);
        console.log(`  Build ${src} success!`);

        result = uglify.minify(result.code, { ecma: 6 });

        fs.writeFileSync(min, result.code);
        console.log(`  Build ${min} success!`);
      })
      .catch(function(error) {
        console.error(error);
      });
  })
  .catch(function(error) {
    console.error(error);
  });
