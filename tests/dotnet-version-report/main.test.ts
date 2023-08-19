// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/dotnet-version-report/main';
import { setup } from '../fixtures';

describe('dotnet-version-report', () => {
  describe('generating a report', () => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup('get-repos-owner');
      await setup('dotnet-releases-index');
      await setup('advent-of-code-global');
      await setup('alexa-london-travel-global');
      await setup('github-automation-global');
      await setup('website-global');

      fixture = new ActionFixture(run);
      await fixture.run({
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
