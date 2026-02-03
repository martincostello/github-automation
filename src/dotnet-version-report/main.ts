// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { getBadge } from '../shared/badges.js';
import { handle } from '../shared/errors.js';
import { getFileContents, getDotNetSdk, getReposForCurrentUser } from '../shared/github.js';
import { ReleaseChannel } from '../shared/dotnet.js';

/* eslint-disable no-console */

export async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: false });
    const github = getOctokit(token);

    const repos = await getReposForCurrentUser(github, 'owner');

    const releases: ReleaseChannel[] = JSON.parse(
      await getFileContents(github, 'dotnet', 'core', 'release-notes/releases-index.json', 'main')
    );

    const report = ['# .NET SDK Version Report', '', '| Repository | SDK Version |', '| :--------- | :---------- |'];

    for (const repository of repos) {
      const slug = repository.full_name;
      const branch = repository.default_branch;

      console.log(`Fetching data for ${slug}.`);

      const dotnetSdk = await getDotNetSdk(github, repository.owner, repository.repo, branch);

      if (!dotnetSdk) {
        console.log(`No global.json found in ${slug}.`);
        continue;
      }

      const sdkVersion = dotnetSdk.version;
      const parts = sdkVersion.split('.');
      const channel = `${parts[0]}.${parts[1]}`;

      const [latestVersion] = releases['releases-index'].filter((p) => p['channel-version'] === channel).map((p) => p['latest-sdk']);

      if (!latestVersion) {
        console.info(`No latest version found for channel ${channel}`);
        continue;
      }

      const purple = '512BD4';
      const sdkColor = sdkVersion === latestVersion || sdkVersion.startsWith(latestVersion) ? purple : 'yellow';
      const sdkBadge = getBadge('SDK', sdkVersion, sdkColor, 'dotnet');
      const sdkUrl = `${context.serverUrl}/${slug}/blob/${branch}/global.json#L${dotnetSdk.line}`;

      report.push(`| [${slug}](${repository.html_url}) | [![.NET SDK version](${sdkBadge})](${sdkUrl}) |`);
    }

    await core.summary.addRaw(report.join('\n')).write();
  } catch (error) {
    handle(error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
