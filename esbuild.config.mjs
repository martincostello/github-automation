// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import esbuild from 'esbuild';

// esbuild esbuild.config.mjs dotnet-release
// node esbuild.config.mjs dotnet-release

const options = {
  bundle: true,
  minify: true,
  packages: 'bundle',
  platform: 'node',
  sourcemap: true,
  target: 'node24.0.0',
};

const targets = {
  'get-github-token': {
    entryPoints: ['lib/get-github-token/main.js', 'lib/get-github-token/post.js'],
    outdir: `actions/get-github-token/dist`,
  },
};

const target = process.argv[2];
let targetOptions = targets[target];

if (!targetOptions) {
  targetOptions = {
    entryPoints: [`lib/${target}/main.js`],
    outdir: `actions/${target}/dist`,
  };
}

await esbuild.build({
  ...options,
  ...targetOptions,
});
