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
      await setup(`dotnet/${channel}/sdk-product-version`);
      await setup('repos/dotnet/core/contents/main/releases-index');
      await setup('repos/martincostello/github-automation/contents/main/.github/workflow-config');

      // No branch
      await setup(`repos/martincostello/adventofcode/branch/${branch}`);

      // No global.json
      await setup(`repos/martincostello/alexa-london-travel/branch/${branch}`);

      // No pull request
      await setup(`repos/martincostello/api/branch/${branch}`);
      await setup('repos/martincostello/api/commits/8257951/pulls');
      await setup(`repos/martincostello/api/contents/${branch}/global`);
      await setup('repos/martincostello/api/repo');

      // No pull request targeting the branch
      await setup(`repos/martincostello/apple-fitness-workout-mapper/branch/${branch}`);
      await setup('repos/martincostello/apple-fitness-workout-mapper/commits/aa895b3/pulls');
      await setup(`repos/martincostello/apple-fitness-workout-mapper/contents/${branch}/global`);
      await setup('repos/martincostello/apple-fitness-workout-mapper/repo');

      // Failing build
      await setup(`repos/martincostello/costellobot/branch/${branch}`);
      await setup('repos/martincostello/costellobot/commits/3ca5b65/check-runs');
      await setup('repos/martincostello/costellobot/commits/3ca5b65/pulls');
      await setup(`repos/martincostello/costellobot/contents/${branch}/global`);
      await setup('repos/martincostello/costellobot/pulls/583');
      await setup('repos/martincostello/costellobot/repo');

      // Merge conflicts
      await setup(`repos/martincostello/dependabot-helper/branch/${branch}`);
      await setup('repos/martincostello/dependabot-helper/commits/12655a7/check-runs');
      await setup('repos/martincostello/dependabot-helper/commits/12655a7/pulls');
      await setup(`repos/martincostello/dependabot-helper/contents/${branch}/global`);
      await setup('repos/martincostello/dependabot-helper/pulls/607');
      await setup('repos/martincostello/dependabot-helper/repo');

      // Out-of-date SDK version
      await setup(`repos/martincostello/sqllocaldb/branch/${branch}`);
      await setup('repos/martincostello/sqllocaldb/commits/a6245b1/check-runs');
      await setup('repos/martincostello/sqllocaldb/commits/a6245b1/pulls');
      await setup(`repos/martincostello/sqllocaldb/contents/${branch}/global`);
      await setup('repos/martincostello/sqllocaldb/pulls/653');
      await setup('repos/martincostello/sqllocaldb/repo');

      // Up-to-date
      await setup(`repos/martincostello/website/branch/${branch}`);
      await setup('repos/martincostello/website/commits/adae44d/check-runs');
      await setup('repos/martincostello/website/commits/adae44d/pulls');
      await setup(`repos/martincostello/website/contents/${branch}/global`);
      await setup('repos/martincostello/website/pulls/1398');
      await setup('repos/martincostello/website/repo');

      await setup('update-gist');

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
