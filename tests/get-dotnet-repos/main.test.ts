// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/get-dotnet-repos/main';
import { setup } from '../fixtures';

describe('get-dotnet-repos', () => {
  describe.each([
    ['multiple', 'main', ''],
    ['multiple', 'main', 'martincostello/website'],
  ])('%s on %s for repository "%s"', (name: string, branch: string, repository: string) => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup(`get-dotnet-repos/${name}`);
      await setup('get-dotnet-repos/member-repos');

      fixture = new ActionFixture(run);
      await fixture.run({
        'branch': branch,
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
