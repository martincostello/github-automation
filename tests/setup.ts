// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import { vi } from 'vitest';

const setFailedMock = vi.fn();
const debugMock = vi.fn();
const infoMock = vi.fn();
const noticeMock = vi.fn();
const warningMock = vi.fn();
const errorMock = vi.fn();
const addRawMock = vi.fn();
const writeMock = vi.fn();

vi.mock('@actions/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@actions/core')>();
  return {
    ...actual,
    setFailed: setFailedMock,
    debug: debugMock,
    info: infoMock,
    notice: noticeMock,
    warning: warningMock,
    error: errorMock,
    summary: {
      ...actual.summary,
      addRaw: addRawMock.mockReturnValue(actual.summary),
      write: writeMock.mockResolvedValue(actual.summary),
    },
  };
});

vi.mock('@actions/github', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@actions/github')>();

  const contextProxy = new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === 'sha') {
          return process.env.GITHUB_SHA || 'unknown';
        }
        if (prop === 'ref') {
          return process.env.GITHUB_REF || 'unknown';
        }
        if (prop === 'repo') {
          const repo = process.env.GITHUB_REPOSITORY || 'owner/repo';
          const [owner, repoName] = repo.split('/');
          return { owner, repo: repoName };
        }
        if (prop === 'runId') {
          return parseInt(process.env.GITHUB_RUN_ID || '0', 10);
        }
        if (prop === 'serverUrl') {
          return process.env.GITHUB_SERVER_URL || 'https://github.com';
        }
        return actual.context[prop as keyof typeof actual.context];
      },
    }
  );

  return {
    ...actual,
    context: contextProxy,
  };
});
