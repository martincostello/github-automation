// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/is-dotnet-change-available/main';
import { setup } from '../fixtures';

describe('is-dotnet-change-available', () => {
  describe.each([
    ['aspnetcore', '50019', '9.0'],
    ['aspnetcore', '56105', '9.0'],
    ['aspnetcore', '61541', '10.0'],
    ['efcore', '31453', '9.0'],
    ['installer', '17295', '9.0'],
    ['runtime', '90349', '9.0'],
    ['runtime', '91218', '9.0'],
    ['runtime', '91359', '9.0'],
    ['sdk', '35087', '9.0'],
  ])('for dotnet/%s#%s', (repository: string, pull: string, channel: string) => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup(`is-dotnet-change-available/${repository}-${pull}`);
      fixture = new ActionFixture(run);
      await fixture.run({
        'channel': channel,
        'github-token': 'github-token',
        'pull-request': pull,
        'repository-name': repository,
      });
    });

    afterAll(async () => {
      await fixture?.destroy();
    });

    test('generates no errors', () => {
      expect(core.error).toHaveBeenCalledTimes(0);
      expect(core.setFailed).toHaveBeenCalledTimes(0);
    });

    test.each(['is-available'])('the %s output is correct', (name: string) => {
      expect(fixture.getOutput(name)).toMatchSnapshot();
    });

    test('outputs the Markdown report', () => {
      expect(fixture.stepSummary).toMatchSnapshot();
    });
  });
});
