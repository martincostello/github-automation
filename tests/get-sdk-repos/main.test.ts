// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/get-sdk-repos/main';
import { setup } from '../fixtures';

describe('get-sdk-repos', () => {
  describe.each([
    ['custom-config', 'dotnet-vnext', 'main', 'false', 'martincostello/website'],
    ['empty-custom-config', 'dotnet-vnext', 'main', 'false', 'martincostello/website'],
    ['ignored', 'dotnet-vnext', 'main', 'false', 'martincostello/website'],
    ['multiple', 'dotnet-vnext', '', 'false', ''],
    ['multiple', 'dotnet-vnext', 'main', 'false', ''],
    ['nightly', 'dotnet-nightly', '', 'false', ''],
    ['single', 'dotnet-vnext', 'main', 'false', 'martincostello/website'],
  ])(
    '%s',
    (name: string, branch: string, base: string, force: string, repository: string) => {
      let fixture: ActionFixture;

      beforeAll(async () => {
        await setup(`get-sdk-repos/${name}`);
        await setup('get-sdk-repos/member-repos');

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
        expect(fixture.getOutput('updates')).toMatchSnapshot();
      });
    }
  );
});
