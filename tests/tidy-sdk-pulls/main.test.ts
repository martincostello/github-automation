// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/tidy-sdk-pulls/main';
import { setup } from '../fixtures';

describe('tidy-sdk-pulls', () => {
  describe.each([
    ['no-pull-requests', ''],
    ['no-pull-requests', 'costellobot'],
    ['one-pull-request', ''],
    ['one-pull-request', 'costellobot'],
    ['multiple-pull-requests', ''],
    ['multiple-pull-requests', 'costellobot'],
    ['no-pull-requests-for-login', 'costellobot'],
  ])('%s for user "%s"', (name: string, user: string) => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup(`tidy-sdk-pulls/${name}`);

      fixture = new ActionFixture(run);
      await fixture.run({
        'base': 'dotnet-nightly',
        'github-token': 'fake-token',
        'repository': 'martincostello/website',
        'user': user,
      });
    });

    afterAll(async () => {
      await fixture?.destroy();
    });

    test('generates no errors', () => {
      expect(core.error).toHaveBeenCalledTimes(0);
      expect(core.setFailed).toHaveBeenCalledTimes(0);
    });

    test('outputs the correct pull request numbers', () => {
      expect(fixture.getOutput('pulls')).toMatchSnapshot();
    });
  });
});
