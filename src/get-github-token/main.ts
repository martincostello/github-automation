// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { handle } from '../shared/errors';
import { fetch, Headers } from 'undici';

const maxAttempts = 4;
const initialRetryDelayMilliseconds = 1_000;
const maxRetryDelayMilliseconds = 10_000;
const tokenEndpoint = 'https://costellobot.martincostello.com/github-token';

export async function run(): Promise<void> {
  try {
    const profile = core.getInput('profile-name', { required: true });

    // Get the OIDC token for the current workflow run
    const idToken = await core.getIDToken();

    if (!idToken) {
      throw new Error('Failed to get GitHub OIDC token.');
    }

    const githubToken = await requestGitHubToken(profile, idToken);

    if (typeof githubToken?.token !== 'string' || !githubToken.token) {
      throw new Error('Failed to get GitHub token from broker. No token was returned.');
    }

    core.setSecret(githubToken.token);

    core.setOutput('token', githubToken.token);
    core.setOutput('token-type', githubToken.type);

    if (githubToken.type === 'app') {
      // Make token accessible to post function to invalidate if needed
      core.saveState('token', githubToken.token);
    }
  } catch (error) {
    handle(error);
  }
}

if (require.main === module) {
  run();
}

async function requestGitHubToken(profile: string, idToken: string): Promise<Partial<TokenResponse> | null> {
  const request: TokenRequest = {
    profile,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
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
        const error = new Error(`Failed to get GitHub token from broker. Status: ${response.status}, Body: ${await response.text()}`);

        if (!shouldRetryResponse(response.status) || attempt === maxAttempts) {
          throw error;
        }

        await delayBeforeRetry(attempt, error.message);
        continue;
      }

      return (await response.json()) as Partial<TokenResponse> | null;
    } catch (error) {
      if (!(error instanceof Error) || !shouldRetryError(error) || attempt === maxAttempts) {
        throw error;
      }

      await delayBeforeRetry(attempt, error.message);
    }
  }

  throw new Error('Failed to get GitHub token from broker.');
}

function shouldRetryError(error: Error): boolean {
  return error.name === 'TypeError';
}

function shouldRetryResponse(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function calculateRetryDelay(attempt: number): number {
  const maximumDelay = Math.min(initialRetryDelayMilliseconds * 2 ** (attempt - 1), maxRetryDelayMilliseconds);
  return Math.round(maximumDelay / 2 + Math.random() * (maximumDelay / 2));
}

async function delayBeforeRetry(attempt: number, reason: string): Promise<void> {
  const delay = calculateRetryDelay(attempt);
  core.warning(`Attempt ${attempt} to get GitHub token failed: ${reason} Retrying in ${delay}ms.`);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

type TokenRequest = {
  profile: string;
};

type TokenResponse = {
  token: string;
  type: 'app' | 'user';
};
