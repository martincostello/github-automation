// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/dotnet-upgrade-report/main';
import { setup } from '../fixtures';

describe('dotnet-upgrade-report', () => {
  describe.each([
    ['failing-build', 'dotnet-vnext', '8.0'],
    ['merge-conflicts', 'dotnet-vnext', '8.0'],
    ['no-branch', 'dotnet-vnext', '8.0'],
    ['no-global-json', 'dotnet-vnext', '8.0'],
    ['no-pull-request', 'dotnet-vnext', '8.0'],
    ['no-pull-request-for-ref', 'dotnet-vnext', '8.0'],
    ['out-of-date-dotnet-vnext', 'dotnet-vnext', '8.0'],
    ['pending-checks', 'dotnet-vnext', '8.0'],
    ['up-to-date-dotnet-vnext', 'dotnet-vnext', '8.0'],
    ['out-of-date-dotnet-nightly', 'dotnet-nightly', '8.0.1xx-rc1'],
    ['up-to-date-dotnet-nightly', 'dotnet-nightly', '8.0.1xx-rc1'],
  ])('%s for %s', (name: string, branch: string, channel: string) => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup(`sdk-versions`);
      await setup(`dotnet-upgrade-report/${name}`);
      await setup('dotnet-upgrade-report/update-gist');

      fixture = new ActionFixture(run);
      await fixture.run({
        'branch': branch,
        'channel': channel,
        'gist-id': 'fake-gist',
        'github-token': 'fake-token',
      });
    });

    afterAll(async () => {
      await fixture?.destroy();
    });

    test('generates no errors', () => {
      expect(core.error).toHaveBeenCalledTimes(0);
      expect(core.setFailed).toHaveBeenCalledTimes(0);
    });

    test('outputs the Markdown report', () => {
      expect(fixture.stepSummary).toMatchSnapshot();
    });
  });
});
