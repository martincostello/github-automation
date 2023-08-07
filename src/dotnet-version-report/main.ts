// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';

/* eslint-disable no-console */

export async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: false });
    const context = new Context();
    const github = getOctokit(token);

    let page = 1;
    const per_page = 100;
    const type = 'owner';

    let { data: repos } = await github.rest.repos.listForAuthenticatedUser({
      page,
      per_page,
      type,
    });

    while (repos.length === per_page) {
      page++;
      const { data: next } = await github.rest.repos.listForAuthenticatedUser({
        page,
        per_page,
        type,
      });
      repos = repos.concat(next);
    }

    repos = repos
      .filter((repo) => !repo.archived)
      .filter((repo) => !repo.fork)
      .filter((repo) => !repo.is_template);

    const getFileContents = async (owner: string, repo: string, path: string, ref: string): Promise<string> => {
      const { data: contents } = await github.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });
      const encoding = contents['encoding'];
      if (encoding === 'base64' && contents['content']) {
        return Buffer.from(contents['content'], 'base64').toString();
      } else if (encoding === 'none') {
        const response = await fetch(contents['download_url']);
        return await response.text();
      } else {
        throw new Error(`Unexpected encoding for ${path}: ${encoding}`);
      }
    };

    const formatSlug = (value: string): string => {
      return value.replace('-', '--').replace('_', '__').replace(' ', '_');
    };

    const getBadge = (label: string, message: string, color: string, logo: string): string => {
      label = formatSlug(label);
      message = formatSlug(message);
      return `https://img.shields.io/badge/${label}-${message}-${color}?logo=${logo}`;
    };

    const releases = JSON.parse(await getFileContents('dotnet', 'core', 'release-notes/releases-index.json', 'main'));

    const report = ['# .NET SDK Version Report', '', '| Repository | SDK Version |', '| :--------- | :---------- |'];

    for (const repository of repos) {
      const slug = repository.full_name;
      const branch = repository.default_branch;

      console.log(`Fetching data for ${slug}.`);

      let globalJsonString;

      try {
        globalJsonString = await getFileContents(repository.owner.login, repository.name, 'global.json', branch);
      } catch (err) {
        console.log(`No global.json found in ${slug}.`);
        continue;
      }

      const globalJson = JSON.parse(globalJsonString);
      const sdkVersion = globalJson.sdk.version;

      let lineNumber = -1;
      const globalJsonLines = globalJsonString.split('\n');
      for (let i = 0; i < globalJsonLines.length; i++) {
        const line = globalJsonLines[i];
        if (line.includes(sdkVersion)) {
          lineNumber = i + 1;
          break;
        }
      }

      const parts = sdkVersion.split('.');
      const channel = `${parts[0]}.${parts[1]}`;

      const [latestVersion] = releases['releases-index'].filter((p) => p['channel-version'] === channel).map((p) => p['latest-sdk']);

      if (!latestVersion) {
        console.info(`No latest version found for channel ${channel}`);
        continue;
      }

      const purple = '512BD4';
      const sdkColor = sdkVersion === latestVersion ? purple : 'yellow';
      const sdkBadge = getBadge('SDK', sdkVersion, sdkColor, 'dotnet');
      const sdkUrl = `${context.serverUrl}/${slug}/blob/${branch}/global.json#L${lineNumber}`;

      report.push(`| [${slug}](${repository.html_url}) | [![.NET SDK version](${sdkBadge})](${sdkUrl}) |`);
    }

    await core.summary.addRaw(report.join('\n')).write();
  } catch (error: any) {
    core.error(error);
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

if (require.main === module) {
  run();
}
