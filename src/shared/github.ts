// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import { debug } from '@actions/core';
import { context as githubContext } from '@actions/github';
import { fetch } from 'undici';
import { UpdateDotNetSdkConfig, WorkflowConfig } from './config';

type Context = typeof githubContext;

export async function getFileContents(octokit: Octokit, owner: string, repo: string, path: string, ref: string): Promise<string> {
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

export async function getPull(
  octokit: Octokit,
  owner: string,
  repo: string,
  pull_number: number
): Promise<{
  html_url: string;
  mergeable: boolean | null;
  number: number;
}> {
  let pr = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number,
  });

  const logIfMergeable = (): void => {
    debug(`${owner}/${repo}#${pull_number} mergeable: ${pr.data.mergeable}.`);
  };

  logIfMergeable();

  // Poll for changes if the mergeable state is not yet known if a push just occurred.
  // The first read above will start a background job to re-calcuate the mergeability, but it may not be ready immediately.
  // See https://docs.github.com/rest/guides/using-the-rest-api-to-interact-with-your-git-database#checking-mergeability-of-pull-requests
  // and https://github.com/pullreminders/backlog/issues/42#issuecomment-436412823.
  let pollCount = 0;
  const pollDelay = 5000;
  const timeout = 60000;
  const maxPollCount = timeout / pollDelay;

  while (pr.data.mergeable === null && pollCount < maxPollCount) {
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

    logIfMergeable();
    pollCount++;
  }

  return pr.data;
}

export type Repository = {
  full_name: string;
  repo: string;
  owner: string;
  default_branch: string;
  html_url: string;
};

export async function getReposForCurrentUser(octokit: Octokit, type: 'all' | 'owner' | 'member'): Promise<Repository[]> {
  const per_page = 100;
  const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    per_page,
    type,
  });

  debug(`Found ${repos.length} repos for ${type} before filtering.`);
  for (const repo of repos) {
    debug(`- ${repo.full_name}`);
  }

  return repos
    .filter((repo) => !repo.archived)
    .filter((repo) => !repo.fork)
    .filter((repo) => !repo.is_template)
    .filter((repo) => repo.permissions?.push)
    .map((repo) => {
      return {
        full_name: repo.full_name,
        repo: repo.name,
        owner: repo.owner.login,
        default_branch: repo.default_branch,
        html_url: repo.html_url,
      };
    });
}

export async function getUpdateConfiguration(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<UpdateDotNetSdkConfig | null> {
  let config: string;

  try {
    config = await getFileContents(octokit, owner, repo, '.github/update-dotnet-sdk.json', ref);
  } catch {
    return null;
  }

  return JSON.parse(config);
}

export async function getWorkflowConfig(octokit: Octokit, context: Context): Promise<WorkflowConfig> {
  return JSON.parse(await getFileContents(octokit, context.repo.owner, context.repo.repo, '.github/workflow-config.json', context.sha));
}

export type RepositoryDotNetSdk = {
  version: string;
  line: number;
};

type GlobalJson = {
  sdk: {
    version: string;
  };
};

export async function getDotNetSdk(octokit: Octokit, owner: string, repo: string, ref: string): Promise<RepositoryDotNetSdk | null> {
  let globalJsonString: string;

  try {
    globalJsonString = await getFileContents(octokit, owner, repo, 'global.json', ref);
  } catch {
    return null;
  }

  const globalJson: GlobalJson = JSON.parse(globalJsonString);
  const sdkVersion = globalJson.sdk?.version;

  let lineNumber = -1;

  if (sdkVersion) {
    const globalJsonLines = globalJsonString.split('\n');
    for (let i = 0; i < globalJsonLines.length; i++) {
      const line = globalJsonLines[i];
      if (line.includes(sdkVersion)) {
        lineNumber = i + 1;
        break;
      }
    }
  }

  return {
    version: sdkVersion,
    line: lineNumber,
  };
}

export type Octokit = import('@octokit/plugin-rest-endpoint-methods').Api & {
  paginate: import('@octokit/plugin-paginate-rest').PaginateInterface;
};
