// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/get-rebase-repos/main';
import { setup } from '../fixtures';

describe('get-rebase-repos', () => {
  describe.each([
    ['false', '', 'dotnet-vnext', 'main'],
    ['true', '', 'dotnet-vnext', 'main'],
    ['false', 'martincostello/website', 'dotnet-vnext', 'main'],
    ['true', 'martincostello/website', 'dotnet-vnext', 'main'],
  ])('force=%s for repository "%s"', (force: string, repository: string, branch: string, base: string) => {
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
