// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { handle } from '../shared/errors';
import { getDotNetSdk, getReposForCurrentUser } from '../shared/github';

type DotNetRepository = {
  ref: string;
  repo: string;
};

export async function run(): Promise<void> {
  try {
    const branch = core.getInput('branch', { required: false });
    const token = core.getInput('github-token', { required: false });
    const github = getOctokit(token);

    const ref = branch;
    const repositories = await getReposForCurrentUser(github, 'member');

    let singleRepository = core.getInput('repository', { required: false });

    if (singleRepository && !singleRepository.includes('/')) {
      singleRepository = `${context.repo.owner}/${singleRepository}`;
    }

    const result: DotNetRepository[] = [];

    for (const repository of repositories) {
      const full_name = repository.full_name;

      if (singleRepository && singleRepository !== full_name) {
        core.debug(`Skipping repository ${full_name}.`);
        continue;
      }

      const owner = repository.owner;
      const repo = repository.repo;

      try {
        // eslint-disable-next-line no-console
        console.log(`Fetching data for ${full_name}.`);

        if (!(await getDotNetSdk(github, owner, repo, branch))) {
          core.debug(`The ${branch} branch of ${full_name} does not exist or does not have a global.json file.`);
          continue;
        }

        const config: DotNetRepository = {
          ref,
          repo: full_name,
        };

        result.push(config);
      } catch (err) {
        core.debug(`Failed to get data for ${full_name}: ${err}`);
      }
    }

    core.setOutput('repositories', JSON.stringify(result));
  } catch (error) {
    handle(error);
  }
}

if (require.main === module) {
  run();
}
