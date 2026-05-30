// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import { getState, info, warning } from '@actions/core';
import { getOctokit } from '@actions/github';

export async function run(): Promise<void> {
  try {
    const token = getState('token');

    if (!token) {
      info('No token is set for revocation.');
      return;
    }

    const octokit = getOctokit(token);
    await octokit.request('DELETE /installation/token');

    info('Token revoked');
  } catch (error) {
    if (error instanceof Error) {
      warning(`Failed to revoke token: ${error.message}`);
      if (error.stack) {
        warning(error.stack);
      }
    } else {
      warning(`Failed to revoke token: ${error}`);
    }
  }
}

if (require.main === module) {
  run();
}
