// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/dotnet-release/main';
import { setup } from '../fixtures';

describe('dotnet-release', () => {
  describe.each([
    ['no-new-commits', ''],
    ['no-new-commits', '6dc7506c307ddf3165cdd724ce1a5db4b31040a1'],
    ['no-releases', '53c167c2b0996ece03d56e20ff5977fdd16f3f9a'],
    ['stable', '02369e7047c776f8cbf06aab76a7e8a79064bef9'],
    ['preview', '02369e7047c776f8cbf06aab76a7e8a79064bef9'],
    ['multiple', '02369e7047c776f8cbf06aab76a7e8a79064bef9'],
  ])('%s for ref %s', (name: string, ref: string) => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup(`dotnet-release/${name}`);
      await setup('dotnet-release/update-sha');

      fixture = new ActionFixture(run);
      await fixture.run({
        'github-token': 'fake-token',
        'state-token': 'actions-token',
        'ref': ref,
      });
    });

    afterAll(async () => {
      await fixture?.destroy();
    });

    test('generates no errors', () => {
      expect(core.error).toHaveBeenCalledTimes(0);
      expect(core.setFailed).toHaveBeenCalledTimes(0);
    });
  });
});
