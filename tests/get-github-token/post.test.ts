// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/get-github-token/post';
import { setup } from '../fixtures';

describe('get-github-token post', () => {
  describe('when no token was saved', () => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      delete process.env.STATE_token;

      fixture = new ActionFixture(run);
      await fixture.run();
    });

    afterAll(async () => {
      delete process.env.STATE_token;
      await fixture?.destroy();
    });

    test('generates no errors', () => {
      expect(core.error).toHaveBeenCalledTimes(0);
      expect(core.setFailed).toHaveBeenCalledTimes(0);
    });

    test('logs that revocation is skipped', () => {
      expect(core.info).toHaveBeenCalledTimes(1);
      expect(core.info).toHaveBeenCalledWith('No token is set for revocation.');
    });
  });

  describe('when a saved token can be revoked', () => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup('get-github-token/revoke');
      process.env.STATE_token = 'fake-github-token';

      fixture = new ActionFixture(run);
      await fixture.run();
    });

    afterAll(async () => {
      delete process.env.STATE_token;
      await fixture?.destroy();
    });

    test('generates no errors', () => {
      expect(core.error).toHaveBeenCalledTimes(0);
      expect(core.setFailed).toHaveBeenCalledTimes(0);
    });

    test('logs that the token was revoked', () => {
      expect(core.info).toHaveBeenCalledTimes(1);
      expect(core.info).toHaveBeenCalledWith('Token revoked');
    });
  });

  describe('when token revocation fails', () => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup('get-github-token/revoke-failure');
      process.env.STATE_token = 'fake-github-token';

      fixture = new ActionFixture(run);
      await fixture.run();
    });

    afterAll(async () => {
      delete process.env.STATE_token;
      await fixture?.destroy();
    });

    test('logs a warning without failing the action', () => {
      expect(core.error).toHaveBeenCalledTimes(0);
      expect(core.setFailed).toHaveBeenCalledTimes(0);
      expect(core.warning).toHaveBeenCalledTimes(2);
      expect(core.warning).toHaveBeenCalledWith('Failed to revoke token: Bad credentials');
    });
  });
});
