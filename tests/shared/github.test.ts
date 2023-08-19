// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

jest.mock('node-fetch');

import fetch from 'node-fetch';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { getDotNetSdk, getFileContents, getReposForCurrentUser, getUpdateConfiguration, getWorkflowConfig } from '../../src/shared/github';
import { getOctokitForContent, getOctokitForRepos } from '../mocks';

const owner = 'owner';
const repo = 'repo';
const ref = 'main';

describe('getFileContents', () => {
  const path = 'some/file';

  describe('when the content is base64 encoded', () => {
    let octokit;

    beforeEach(async () => {
      octokit = getOctokitForContent({
        content: 'SGVsbG8gd29ybGQh',
        encoding: 'base64',
      });
    });

    test('returns the decoded contents', async () => {
      const actual = await getFileContents(octokit, owner, repo, path, ref);
      expect(actual).toBe('Hello world!');
    });
  });

  describe('when the content is a URL', () => {
    let octokit;

    beforeEach(async () => {
      octokit = getOctokitForContent({
        download_url: 'https://raw.githubusercontent.com/owner/repo/main/some/file',
        encoding: 'none',
      });
      fetch.mockResolvedValueOnce({
        text: () => Promise.resolve('Hello world!'),
      });
    });

    test('returns the contents', async () => {
      const actual = await getFileContents(octokit, owner, repo, path, ref);
      expect(actual).toBe('Hello world!');
    });
  });

  describe('when the content has an unknown encoding', () => {
    let octokit;

    beforeEach(async () => {
      octokit = getOctokitForContent({
        encoding: 'potato',
      });
    });

    test('throws an error', async () => {
      await expect(getFileContents(octokit, owner, repo, path, ref)).rejects.toThrow(
        'Unexpected encoding for some/file: potato'
      );
    });
  });
});

describe('getUpdateConfiguration', () => {

  describe('when the file exists', () => {
    let octokit;

    beforeEach(async () => {
      octokit = getOctokitForContent({
        'ignore': true,
        'exclude-nuget-packages':'excluded',
        'include-nuget-packages': 'included',
        'update-nuget-packages': true,
      });
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
      const err = new Error('Not found');
      octokit = {
        rest: {
          repos: {
            getContent: jest.fn().mockRejectedValueOnce(err as never),
          },
        },
      };
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
    octokit = getOctokitForContent({
      checksOfInterest: ['check'],
      repositories: ['a/b', 'c/d']
    });
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
    expect(actual?.checksOfInterest).toStrictEqual(['check']);
    expect(actual?.repositories).toStrictEqual(['a/b', 'c/d']);
  });
});

describe('getDotNetSdk', () => {

  describe.each([[undefined, 1], [2, 3]])('when there is an SDK version with %s spaces', (space, line) => {
    let octokit;
    let actual;

    beforeEach(async () => {
      const json = JSON.stringify({
        sdk: {
          version: '7.0.400'
        }
      }, null, space);
      octokit = getOctokitForContent({
        content: Buffer.from(json).toString('base64'),
        encoding: 'base64',
      });
      actual = await getDotNetSdk(octokit, owner, repo, ref);
    });

    test('returns the version', () => {
      expect(actual?.version).toBe('7.0.400');
    });

    test('returns the line number', () => {
      expect(actual?.line).toBe(line);
    });
  });

  describe('when there is no SDK version', () => {
    let octokit;
    let actual;

    beforeEach(async () => {
      octokit = getOctokitForContent({});
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
      const err = new Error('Not found');
      octokit = {
        rest: {
          repos: {
            getContent: jest.fn().mockRejectedValueOnce(err as never),
          },
        },
      };
    });

    test('returns null', async () => {
      const actual = await getDotNetSdk(octokit, owner, repo, ref);
      expect(actual).toBeNull();
    });
  });
});

describe('getReposForCurrentUser', () => {
  describe('when there are no repositories', () => {
    let octokit;

    beforeEach(async () => {
      octokit = getOctokitForRepos([]);
    });

    test('returns an empty array', async () => {
      const actual = await getReposForCurrentUser(octokit, 'member');
      expect(actual).not.toBeNull();
      expect(actual.length).toBe(0);
    });
  });
  describe('when there are repositories', () => {
    let octokit;

    beforeEach(async () => {
      octokit = getOctokitForRepos([
        {
          full_name: 'org/name',
          name: 'name',
          owner: {
            login: 'org',
          },
          default_branch: 'main',
          html_url: 'https://github.com/org/name',
          archived: false,
          fork: false,
          is_template: false,
        },
        {
          full_name: 'org/archived',
          name: 'archived',
          owner: {
            login: 'org',
          },
          default_branch: 'main',
          html_url: 'https://github.com/org/archived',
          archived: true,
          fork: false,
          is_template: false,
        },
        {
          full_name: 'org/forked',
          name: 'forked',
          owner: {
            login: 'org',
          },
          default_branch: 'main',
          html_url: 'https://github.com/org/forked',
          archived: false,
          fork: true,
          is_template: false,
        },
        {
          full_name: 'org/template',
          name: 'template',
          owner: {
            login: 'org',
          },
          default_branch: 'main',
          html_url: 'https://github.com/org/template',
          archived: false,
          fork: false,
          is_template: true,
        },
        {
          full_name: 'org2/name2',
          name: 'name2',
          owner: {
            login: 'org2',
          },
          default_branch: 'develop',
          html_url: 'https://github.com/org2/name2',
          archived: false,
          fork: false,
          is_template: false,
        }
      ]);
    });

    test('returns the correct repositories', async () => {
      const actual = await getReposForCurrentUser(octokit, 'member');
      expect(actual).toMatchSnapshot();
    });
  });
});
