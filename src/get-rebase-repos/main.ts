// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { getFileContents, getOctokit, getPullMergeableState } from '../shared/github';

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
      const context = new Context();
      repositories = JSON.parse(
        await getFileContents(github, context.repo.owner, context.repo.repo, '.github/workflow-config.json', context.sha)
      ).repositories;
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

        rebaseBranch = (await getPullMergeableState(github, owner, repo, pull_for_ref.number)) === 'dirty';
        if (rebaseBranch) {
          core.notice(`${slug} needs rebasing.`);
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
      core.setFailed(error.message);
    }
  }
}

if (require.main === module) {
  run();
}
