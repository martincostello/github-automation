// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

/* eslint-disable import/no-unresolved */

import { Context } from '@actions/github/lib/context';
import { HttpClient } from '@actions/http-client';
import { Octokit } from '@octokit/core';
import { OctokitOptions, OctokitPlugin } from '@octokit/core/dist-types/types';
import { paginateRest } from '@octokit/plugin-paginate-rest';
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods';
import { Api } from '@octokit/plugin-rest-endpoint-methods/dist-types/types';

const baseUrl = new Context().apiUrl;
const agent = new HttpClient().getAgent(baseUrl);

const defaults: OctokitOptions = {
  baseUrl,
  request: {
    agent,
  },
};

const GitHub = Octokit.plugin(restEndpointMethods, paginateRest).defaults(defaults);

export function getOctokit(token: string): InstanceType<typeof GitHub> {
  const additionalPlugins: OctokitPlugin[] = [];
  const GitHubWithPlugins = GitHub.plugin(...additionalPlugins);
  return new GitHubWithPlugins({
    auth: `token ${token}`,
  });
}

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
