// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/dotnet-upgrade-report/main';
import { setup } from '../fixtures';

describe('dotnet-upgrade-report', () => {
  describe.each([
    ['dotnet-vnext', '8.0'],
    //['dotnet-nightly', '8.0.1xx-rc1'],
  ])('generating a report for %s', (branch: string, channel: string) => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup(`sdk-versions`);
      await setup('workflow-config');

      await setup('dotnet-upgrade-report/failing-build');
      await setup('dotnet-upgrade-report/merge-conflicts');
      await setup('dotnet-upgrade-report/no-branch');
      await setup('dotnet-upgrade-report/no-global-json');
      await setup('dotnet-upgrade-report/no-pull-request');
      await setup('dotnet-upgrade-report/no-pull-request-for-ref');
      await setup(`dotnet-upgrade-report/out-of-date-${branch}`);
      await setup(`dotnet-upgrade-report/up-to-date-${branch}`);

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

    test('outputs the Markdown report', async () => {
      expect(await fixture.getStepSummary()).toMatchSnapshot();
    });
  });
});
