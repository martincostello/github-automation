// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { Context } from '@actions/github/lib/context';
import { getDotNetSdk, getReposForCurrentUser, getWorkflowConfig } from '../shared/github';

export async function run(): Promise<void> {
  try {
    const branch = core.getInput('branch', { required: false });
    const token = core.getInput('github-token', { required: false });
    const github = getOctokit(token);

    const context = new Context();
    const updatesConfig = (await getWorkflowConfig(github, context))['update-dotnet-sdks'][context.repo.owner];

    const repositories = await getReposForCurrentUser({ octokit: github }, 'member');

    const labels = 'dependencies,.NET';
    const ref = branch || '';
    const channel = branch === 'dotnet-nightly' ? '8.0.1xx-rc1' : '';
    const quality = branch === 'dotnet-nightly' ? 'daily' : '';

    type UpdateConfiguration = {
      'channel': string;
      'include-nuget-packages': string | undefined;
      'labels': string;
      'quality': string;
      'ref': string;
      'repo': string;
      'update-nuget-packages': boolean;
    };

    const result: UpdateConfiguration[] = [];
    for (const repository of repositories) {
      const repoConfig = updatesConfig[repository.repo];
      if (repoConfig?.ignore) {
        core.debug(`Ignoring ${repository.full_name}.`);
        continue;
      }

      // eslint-disable-next-line no-console
      console.log(`Fetching data for ${repository.full_name}.`);
      try {
        if (!(await getDotNetSdk(github, repository.owner, repository.repo, branch))) {
          core.debug(`The ${branch} branch of ${repository.full_name} does not exist or does not have a global.json file.`);
          continue;
        }

        const config: UpdateConfiguration = {
          channel,
          'include-nuget-packages': undefined,
          labels,
          quality,
          ref,
          'repo': repository.full_name,
          'update-nuget-packages': true,
        };

        if (repoConfig) {
          config['include-nuget-packages'] = repoConfig['include-nuget-packages'];
          const updatePackages = repoConfig['update-nuget-packages'];
          if (updatePackages !== undefined) {
            config['update-nuget-packages'] = updatePackages;
          }
        }

        result.push(config);
      } catch (err) {
        core.debug(`Could not get branch ${branch}: ${err}`);
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
