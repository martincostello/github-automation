// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { handle } from '../shared/errors';
import { fetch, Headers } from 'undici';

const tokenEndpoint = 'https://costellobot.martincostello.com/github-token';

export async function run(): Promise<void> {
  try {
    const profile = core.getInput('profile-name', { required: true });

    // Get the OIDC token for the current workflow run
    const idToken = await core.getIDToken();

    if (!idToken) {
      throw new Error('Failed to get GitHub OIDC token.');
    }

    // Request a GitHub token from the broker using the OIDC token and profile name
    const request: TokenRequest = {
      profile,
    };

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: new Headers({
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'martincostello/github-automation',
      }),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to get GitHub token from broker. Status: ${response.status}, Body: ${await response.text()}`);
    }

    const githubToken = (await response.json()) as TokenResponse;

    if (!githubToken) {
      throw new Error('Failed to get GitHub token from broker.');
    }

    core.setSecret(githubToken.token);
    core.setOutput('token', githubToken.token);
  } catch (error) {
    handle(error);
  }
}

if (require.main === module) {
  run();
}

type TokenRequest = {
  profile: string;
};

type TokenResponse = {
  token: string;
};
