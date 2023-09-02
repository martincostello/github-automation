// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/is-dotnet-change-available/main';
import { setup } from '../fixtures';

describe('is-dotnet-change-available', () => {
  describe.each([
    ['aspnetcore', '50019'],
    ['efcore', '31453'],
    ['installer', '17295'],
    ['runtime', '90349'],
    ['runtime', '91218'],
    ['runtime', '91359'],
    ['sdk', '35087'],
  ])('for dotnet/%s#%s', (repository: string, pull: string) => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup(`is-dotnet-change-available/${repository}-${pull}`);
      fixture = new ActionFixture(run);
      await fixture.run({
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
