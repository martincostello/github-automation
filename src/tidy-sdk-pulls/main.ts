// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { handle } from '../shared/errors';

export async function run(): Promise<void> {
  try {
    const base = core.getInput('base', { required: true });
    const repository = core.getInput('repository', { required: true });
    const token = core.getInput('github-token', { required: false });
    const login = core.getInput('user', { required: false });

    const github = getOctokit(token);

    const [owner, repo] = repository.split('/');

    let pulls = await github.paginate(github.rest.pulls.list, {
      owner,
      repo,
      base,
      direction: 'desc',
      state: 'open',
    });

    let prs: number[] = [];

    if (login) {
      pulls = pulls.filter((pull) => pull.user?.login === login);
    }

    if (pulls.length < 2) {
      // eslint-disable-next-line no-console
      console.log('No superseded pull requests found.');
    } else {
      // Filter out the latest open pull request, which may have just been created
      const latest = pulls[0];

      const superseded = pulls.slice(1);
      superseded.reverse();

      const body = `Superseded by #${latest.number}.`;

      for (const pull of superseded) {
        core.debug(`Closing pull request ${pull.number}.`);

        await github.rest.issues.createComment({
          owner,
          repo,
          issue_number: pull.number,
          body,
        });
        await github.rest.pulls.update({
          owner,
          repo,
          pull_number: pull.number,
          state: 'closed',
        });
        await github.rest.git.deleteRef({
          owner,
          repo,
          ref: `heads/${pull.head.ref}`,
        });
      }

      prs = superseded.map((p) => p.number);
    }

    core.setOutput('pulls', JSON.stringify(prs));
  } catch (error: any) {
    handle(error);
  }
}

if (require.main === module) {
  run();
}
