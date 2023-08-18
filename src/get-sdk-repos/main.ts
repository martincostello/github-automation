// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { getDotNetSdk, getReposForCurrentUser, getUpdateConfiguration } from '../shared/github';
import { UpdateDotNetSdkConfig } from '../shared/config';

type UpdateConfiguration = {
  'channel': string;
  'include-nuget-packages': string | undefined;
  'labels': string;
  'quality': string;
  'ref': string;
  'repo': string;
  'update-nuget-packages': boolean;
};

function getConfiguration(overrides: UpdateDotNetSdkConfig | null): UpdateDotNetSdkConfig {
  const config: UpdateDotNetSdkConfig = {};

  const updateIfDefined = (candidate: UpdateDotNetSdkConfig, key: string): void => {
    const value = candidate[key];
    if (value !== undefined) {
      config[key] = value;
    }
  };

  if (overrides) {
    core.debug(`Baseline configuration: ${JSON.stringify(config)}`);
    core.debug(`Repository configuration: ${JSON.stringify(overrides)}`);

    updateIfDefined(overrides, 'channel');
    updateIfDefined(overrides, 'exclude-nuget-packages');
    updateIfDefined(overrides, 'include-nuget-packages');
    updateIfDefined(overrides, 'labels');
    updateIfDefined(overrides, 'quality');
    updateIfDefined(overrides, 'update-nuget-packages');

    core.debug(`Merged configuration: ${JSON.stringify(config)}`);
  }

  return config;
}

export async function run(): Promise<void> {
  try {
    const branch = core.getInput('branch', { required: false });
    const token = core.getInput('github-token', { required: false });
    const github = getOctokit(token);

    const repositories = await getReposForCurrentUser({ octokit: github }, 'member');

    const includePackages = 'Microsoft.AspNetCore.,Microsoft.EntityFrameworkCore.,Microsoft.Extensions.,System.Text.Json';
    const labels = 'dependencies,.NET';
    const ref = branch || '';
    const channel = branch === 'dotnet-nightly' ? '8.0.1xx-rc1' : '';
    const quality = branch === 'dotnet-nightly' ? 'daily' : '';

    const result: UpdateConfiguration[] = [];

    for (const repository of repositories) {
      const owner = repository.owner;
      const repo = repository.repo;
      const full_name = repository.full_name;

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
    core.error(error);
    if (error instanceof Error) {
      if (error.stack) {
        core.error(error.stack);
      }
      core.setFailed(error.message);
    }
  }
}

if (require.main === module) {
  run();
}
