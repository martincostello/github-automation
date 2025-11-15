// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/get-rebase-repos/main';
import { setup } from '../fixtures';

describe('get-rebase-repos', () => {
  describe.each([
    ['false', '', '', 'dotnet-vnext'],
    ['true', '', '', 'dotnet-vnext'],
    ['false', '', 'some-other-branch', 'dotnet-vnext'],
    ['true', '', 'some-other-branch', 'dotnet-vnext'],
    ['false', '', 'main', 'dotnet-vnext'],
    ['true', '', 'main', 'dotnet-vnext'],
    ['false', 'martincostello/website', 'main', 'dotnet-vnext'],
    ['true', 'martincostello/website', 'main', 'dotnet-vnext'],
  ])('force=%s for repository "%s" with base=%s', (force: string, repository: string, base: string, branch: string) => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup('get-rebase-repos/scenario');

      fixture = new ActionFixture(run);
      await fixture.run({
        'base': base,
        'branch': branch,
        'force': force,
        'github-token': 'fake-token',
        'repository': repository,
      });
    });

    afterAll(async () => {
      await fixture?.destroy();
    });

    test('generates no errors', () => {
      expect(core.error).toHaveBeenCalledTimes(0);
      expect(core.setFailed).toHaveBeenCalledTimes(0);
    });

    test('outputs the correct repositories', () => {
      expect(fixture.getOutput('repositories')).toMatchSnapshot();
    });
  });
});
