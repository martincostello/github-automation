// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import { debug } from '@actions/core';
/* eslint-disable import/no-unresolved */
import { Api } from '@octokit/plugin-rest-endpoint-methods/dist-types/types';

export async function getFileContents(octokit: Api, owner: string, repo: string, path: string, ref: string): Promise<string> {
  const { data: contents } = await octokit.rest.repos.getContent({
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
}

export async function getPullMergeableState(octokit: Api, owner: string, repo: string, pull_number: number): Promise<string> {
  let pr = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number,
  });

  const logMergeableState = (): void => {
    debug(`${owner}/${repo}#${pull_number} mergeable_state: ${pr.data.mergeable_state}.`);
  };

  logMergeableState();

  // Poll for changes if the mergeable state is not yet known if a push just occurred.
  // The first read above will start a background job to re-calcuate the mergeability, but it may not be ready immediately.
  // See https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-your-git-database?apiVersion=2022-11-28#checking-mergeability-of-pull-requests
  // and https://github.com/pullreminders/backlog/issues/42#issuecomment-436412823.
  let pollCount = 0;
  const pollDelay = 5000;
  const timeout = 60000;
  const maxPollCount = timeout / pollDelay;

  while ((pr.data.mergeable_state === null || pr.data.mergeable_state === 'unknown') && pollCount < maxPollCount) {
    await new Promise((resolve) => setTimeout(resolve, pollDelay));
    pr = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number,
      // Specify cache headers to make the most of the GitHub API's rate limits.
      // See https://jamiemagee.co.uk/blog/making-the-most-of-github-rate-limits/.
      headers: {
        'If-Modified-Since': pr.headers['Last-Modified'],
        'If-None-Match': pr.headers['Etag'],
      },
    });

    logMergeableState();
    pollCount++;
  }

  return pr.data.mergeable_state;
}
