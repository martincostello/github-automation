// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { Context } from '@actions/github/lib/context';
import { UpdateDotNetSdkConfig } from '../shared/config';
import { handle } from '../shared/errors';
import { getDotNetSdk, getReposForCurrentUser, getUpdateConfiguration } from '../shared/github';

type UpdateConfiguration = {
  'channel': string;
  'exclude-nuget-packages': string | undefined;
  'include-nuget-packages': string | undefined;
  'labels': string;
  'quality': string;
  'ref': string;
  'repo': string;
  'update-nuget-packages': boolean;
};

function getConfiguration(overrides: UpdateDotNetSdkConfig | null): UpdateDotNetSdkConfig {
  const config: UpdateDotNetSdkConfig = {};

  if (overrides) {
    core.debug(`Baseline configuration: ${JSON.stringify(config)}`);
    core.debug(`Repository configuration: ${JSON.stringify(overrides)}`);

    const keys = ['channel', 'exclude-nuget-packages', 'include-nuget-packages', 'labels', 'quality', 'update-nuget-packages'];

    for (const key of keys) {
      const value = overrides[key];
      if (value !== undefined) {
        config[key] = value;
      }
    }

    core.debug(`Merged configuration: ${JSON.stringify(config)}`);
  }

  return config;
}

export async function run(): Promise<void> {
  try {
    const branch = core.getInput('branch', { required: false });
    const token = core.getInput('github-token', { required: false });
    const nightlyChannel = core.getInput('nightly-channel', { required: false });
    const github = getOctokit(token);

    const repositories = await getReposForCurrentUser(github, 'member');

    const excludePackages = '';
    const includePackages = 'Microsoft.AspNetCore.,Microsoft.EntityFrameworkCore.,Microsoft.Extensions.,System.Text.Json';
    const labels = 'dependencies,.NET';
    const ref = branch;
    const channel = branch === 'dotnet-nightly' && nightlyChannel ? nightlyChannel : '';
    const quality = branch === 'dotnet-nightly' ? 'daily' : '';

    let singleRepository = core.getInput('repository', { required: false });

    if (singleRepository && !singleRepository.includes('/')) {
      const context = new Context();
      singleRepository = `${context.repo.owner}/${singleRepository}`;
    }

    const result: UpdateConfiguration[] = [];

    for (const repository of repositories) {
      const full_name = repository.full_name;

      if (singleRepository && singleRepository !== full_name) {
        core.debug(`Skipping repository ${full_name}.`);
        continue;
      }

      const owner = repository.owner;
      const repo = repository.repo;

      const repoConfig = await getUpdateConfiguration(github, owner, repo, ref);
      if (repoConfig?.ignore) {
        core.debug(`Ignoring ${full_name}.`);
        continue;
      }

      try {
        // eslint-disable-next-line no-console
        console.log(`Fetching data for ${full_name}.`);

        if (!(await getDotNetSdk(github, owner, repo, branch))) {
          core.debug(`The ${branch} branch of ${full_name} does not exist or does not have a global.json file.`);
          continue;
        }

        const updateConfig = getConfiguration(repoConfig);

        const valueOrDefault = <T>(value: T | undefined, defaultValue: T): T => {
          return value !== undefined ? value : defaultValue;
        };

        const config: UpdateConfiguration = {
          channel,
          'exclude-nuget-packages': valueOrDefault(updateConfig['exclude-nuget-packages'], excludePackages),
          'include-nuget-packages': valueOrDefault(updateConfig['include-nuget-packages'], includePackages),
          labels,
          quality,
          ref,
          'repo': full_name,
          'update-nuget-packages': valueOrDefault(updateConfig['update-nuget-packages'], true),
        };

        result.push(config);
      } catch (err) {
        core.debug(`Failed to get data for ${full_name}: ${err}`);
      }
    }

    core.setOutput('updates', JSON.stringify(result));
  } catch (error: any) {
    handle(error);
  }
}

if (require.main === module) {
  run();
}
