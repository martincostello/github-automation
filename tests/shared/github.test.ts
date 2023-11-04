// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import { getOctokit as getClient } from '@actions/github';
import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
  getDotNetSdk,
  getFileContents,
  getPull,
  getReposForCurrentUser,
  getUpdateConfiguration,
  getWorkflowConfig,
} from '../../src/shared/github';
import { setup } from '../fixtures';

const owner = 'owner';
const repo = 'repo';
const ref = 'main';

const getOctokit = (token: string = 'fake-token') => getClient(token);

describe('getFileContents', () => {
  const path = 'some/file';

  describe('when the content is base64 encoded', () => {
    let octokit;

    beforeEach(async () => {
      await setup('getFileContents/base64');
      octokit = getOctokit();
    });

    test('returns the decoded contents', async () => {
      const actual = await getFileContents(octokit, owner, repo, path, ref);
      expect(actual).toBe('Hello world!');
    });
  });

  describe('when the content is a URL', () => {
    let octokit;

    beforeEach(async () => {
      await setup('getFileContents/url');
      octokit = getOctokit();
    });

    test('returns the contents', async () => {
      const actual = await getFileContents(octokit, owner, repo, path, ref);
      expect(actual).toBe('Hello world!');
    });
  });

  describe('when the content has an unknown encoding', () => {
    let octokit;

    beforeEach(async () => {
      await setup('getFileContents/unknown');
      octokit = getOctokit();
    });

    test('throws an error', async () => {
      await expect(getFileContents(octokit, owner, repo, path, ref)).rejects.toThrow('Unexpected encoding for some/file: foo');
    });
  });
});

describe('getUpdateConfiguration', () => {
  describe('when the file exists', () => {
    let octokit;

    beforeEach(async () => {
      await setup('getUpdateConfiguration/exists');
      octokit = getOctokit();
    });

    test('returns the configuration', async () => {
      const actual = await getUpdateConfiguration(octokit, owner, repo, ref);
      expect(actual).not.toBeUndefined();
      expect(actual).not.toBeNull();
      expect(actual?.ignore).toBe(true);
      expect(actual?.['exclude-nuget-packages']).toBe('excluded');
      expect(actual?.['include-nuget-packages']).toBe('included');
      expect(actual?.['update-nuget-packages']).toBe(true);
    });
  });

  describe('when the file does not exist', () => {
    let octokit;

    beforeEach(async () => {
      await setup('getUpdateConfiguration/not-found');
      octokit = getOctokit();
    });

    test('returns null', async () => {
      const actual = await getUpdateConfiguration(octokit, owner, repo, ref);
      expect(actual).toBeNull();
    });
  });
});

describe('getWorkflowConfig', () => {
  let octokit;

  beforeEach(async () => {
    await setup('getWorkflowConfig/exists');
    octokit = getOctokit();
  });

  test('returns the configuration', async () => {
    const context = {
      repo: {
        owner,
        repo,
      },
      sha: ref,
    };
    const actual = await getWorkflowConfig(octokit, context as any);
    expect(actual).not.toBeUndefined();
    expect(actual).not.toBeNull();
    expect(actual?.checksOfInterest).toStrictEqual(['a', 'b']);
  });
});

describe('getDotNetSdk', () => {
  describe('when the file exists', () => {
    let actual;

    beforeAll(async () => {
      await setup('getDotNetSdk/exists');
      const octokit = getOctokit();
      actual = await getDotNetSdk(octokit, owner, repo, ref);
    });

    test('returns the version', () => {
      expect(actual?.version).toBe('7.0.400');
    });

    test('returns the line number', () => {
      expect(actual?.line).toBe(3);
    });
  });

  describe('when there is no SDK version', () => {
    let actual;

    beforeAll(async () => {
      await setup('getDotNetSdk/no-version');
      const octokit = getOctokit();
      actual = await getDotNetSdk(octokit, owner, repo, ref);
    });

    test('returns no version', () => {
      expect(actual?.version).toBeUndefined();
    });

    test('returns no line number', () => {
      expect(actual?.line).toBe(-1);
    });
  });

  describe('when the file does not exist', () => {
    let octokit;

    beforeEach(async () => {
      await setup('getDotNetSdk/not-found');
      octokit = getOctokit();
    });

    test('returns null', async () => {
      const actual = await getDotNetSdk(octokit, owner, repo, ref);
      expect(actual).toBeNull();
    });
  });
});

describe('getReposForCurrentUser', () => {
  describe.each([['all'], ['member'], ['owner']])('when there are repositories for %s', (type: string) => {
    let actual;

    beforeAll(async () => {
      await setup('getReposForCurrentUser/some');
      const octokit = getOctokit(`${type}-token`);
      actual = await getReposForCurrentUser(octokit, type as any);
    });

    test('returns the correct repositories', async () => {
      expect(actual).not.toBeNull();
      expect(actual.length).not.toBe(0);
      expect(actual).toMatchSnapshot();
    });
  });

  describe.each([['all'], ['member'], ['owner']])('when there are no repositories for %s', (type: string) => {
    let actual;

    beforeAll(async () => {
      await setup('getReposForCurrentUser/none');
      const octokit = getOctokit();
      actual = await getReposForCurrentUser(octokit, type as any);
    });

    test('returns an empty array', async () => {
      expect(actual).not.toBeNull();
      expect(actual.length).toBe(0);
    });
  });
});

describe('getPull', () => {
  const getOctokitForPulls = (responses: any | any[]): any => {
    let mock = jest.fn();

    if (!Array.isArray(responses)) {
      responses = [responses];
    }

    for (const data of responses) {
      mock = mock.mockReturnValueOnce({
        data,
        headers: {
          'Etag': '42',
          'Last-Modified': new Date().toUTCString(),
        },
      });
    }

    return {
      rest: {
        pulls: {
          get: mock,
        },
      },
    };
  };

  describe.each([
    [[false], false],
    [[true], true],
    [[null, false], false],
    [[null, true], true],
  ])('when mergeable is %s', (mergeables: any[], expected: boolean) => {
    let actual;

    beforeEach(async () => {
      const octokit = getOctokitForPulls(mergeables.map((mergeable) => ({ mergeable })));
      actual = await getPull(octokit, owner, repo, 42);
    }, 15000);

    test('returns mergeable', async () => {
      expect(actual).not.toBeNull();
      expect(actual['mergeable']).toBe(expected);
    });
  });
});
