// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { getPull, getReposForCurrentUser } from '../shared/github';

export async function run(): Promise<void> {
  try {
    const headBranch = core.getInput('branch', { required: true });
    const baseBranch = core.getInput('base', { required: false });
    const force = core.getInput('force', { required: false }) === 'true';
    const specificRepo = core.getInput('repository', { required: false }) || '';
    const token = core.getInput('github-token', { required: false });

    const github = getOctokit(token);

    let repositories: string[];

    if (specificRepo) {
      repositories = [specificRepo];
    } else {
      repositories = (await getReposForCurrentUser({ octokit: github }, 'owner')).map((repo) => repo.full_name);
    }

    const result: string[] = [];
    for (const slug of repositories) {
      // eslint-disable-next-line no-console
      console.log(`Fetching data for ${slug}.`);

      const [owner, repo] = slug.split('/');

      let commit_sha;
      try {
        const { data: branch } = await github.rest.repos.getBranch({
          owner,
          repo,
          branch: headBranch,
        });
        commit_sha = branch.commit.sha;
      } catch (err) {
        core.debug(`Could not get branch ${headBranch}: ${err}`);
        continue;
      }

      const { data: prs } = await github.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha,
      });

      if (prs.length < 1) {
        continue;
      }

      let baseRef = baseBranch;
      if (baseRef === '') {
        const { data: repository } = await github.rest.repos.get({
          owner,
          repo,
        });
        baseRef = repository.default_branch;
      }

      let rebaseBranch = force;
      if (!rebaseBranch) {
        const pull_for_ref = prs.find((pull) => pull.base.ref === baseRef);
        if (!pull_for_ref) {
          core.debug(`No pull request found targeting ${baseRef}.`);
          continue;
        }

        rebaseBranch = (await getPull(github, owner, repo, pull_for_ref.number)).mergeable_state === 'dirty';
        if (rebaseBranch) {
          core.notice(`${slug}:${headBranch} needs rebasing.`);
        }
      }

      if (rebaseBranch) {
        result.push(slug);
      }
    }

    core.setOutput('repositories', JSON.stringify(result));
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
