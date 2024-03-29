// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/get-sdk-repos/main';
import { setup } from '../fixtures';

describe('get-sdk-repos', () => {
  describe.each([
    ['custom-config', 'dotnet-vnext', 'website'],
    ['custom-config', 'dotnet-vnext', 'martincostello/website'],
    ['empty-custom-config', 'dotnet-vnext', 'martincostello/website'],
    ['ignored', 'dotnet-vnext', 'martincostello/website'],
    ['multiple', 'dotnet-vnext', ''],
    ['multiple', 'dotnet-vnext', 'martincostello/website'],
    ['nightly', 'dotnet-nightly', ''],
  ])('%s on %s for repository "%s"', (name: string, branch: string, repository: string) => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup(`get-sdk-repos/${name}`);
      await setup('get-sdk-repos/member-repos');

      fixture = new ActionFixture(run);
      await fixture.run({
        'branch': branch,
        'github-token': 'fake-token',
        'nightly-channel': '8.0.1xx',
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
      expect(fixture.getOutput('updates')).toMatchSnapshot();
    });
  });
});
