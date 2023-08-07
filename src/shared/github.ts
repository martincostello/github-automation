// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

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
