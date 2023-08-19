// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, jest, test, xdescribe } from '@jest/globals';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/dotnet-version-report/main';

describe('dotnet-version-report', () => {
  xdescribe('generating a report', () => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      fixture = new ActionFixture(run, () => {});
      await fixture.initialize({
        'github-token': 'fake-token',
      });
      await fixture.run();
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
