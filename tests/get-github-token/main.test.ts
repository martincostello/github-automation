// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { ActionFixture } from '../ActionFixture';
import { run } from '../../src/get-github-token/main';
import { setup } from '../fixtures';

function invokeTimerImmediately(callback: Parameters<typeof setTimeout>[0]): ReturnType<typeof setTimeout> {
  if (typeof callback === 'function') {
    callback();
  }

  return 0 as ReturnType<typeof setTimeout>;
}

describe('get-github-token', () => {
  describe('when the broker returns a token', () => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup('get-github-token/success');

      vi.spyOn(core, 'getIDToken').mockResolvedValue('fake-oidc-token');
      vi.spyOn(core, 'saveState').mockImplementation(() => {});
      vi.spyOn(core, 'setSecret').mockImplementation(() => {});

      fixture = new ActionFixture(run);
      await fixture.run({
        'profile-name': 'costellobot',
      });
    });

    afterAll(async () => {
      vi.restoreAllMocks();
      await fixture?.destroy();
    });

    test('generates no errors', () => {
      expect(core.error).toHaveBeenCalledTimes(0);
      expect(core.setFailed).toHaveBeenCalledTimes(0);
    });

    test('masks the token', () => {
      expect(core.setSecret).toHaveBeenCalledTimes(1);
      expect(core.setSecret).toHaveBeenCalledWith('fake-github-token');
    });

    test('saves the app token for the post action', () => {
      expect(core.saveState).toHaveBeenCalledTimes(1);
      expect(core.saveState).toHaveBeenCalledWith('token', 'fake-github-token');
    });

    test.each(['token', 'token-type'])('the %s output is correct', (name: string) => {
      expect(fixture.getOutput(name)).toMatchSnapshot();
    });
  });

  describe('when the broker returns a user token', () => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup('get-github-token/success-user');

      vi.spyOn(core, 'getIDToken').mockResolvedValue('fake-oidc-token');
      vi.spyOn(core, 'saveState').mockImplementation(() => {});
      vi.spyOn(core, 'setSecret').mockImplementation(() => {});

      fixture = new ActionFixture(run);
      await fixture.run({
        'profile-name': 'costellobot',
      });
    });

    afterAll(async () => {
      vi.restoreAllMocks();
      await fixture?.destroy();
    });

    test('generates no errors', () => {
      expect(core.error).toHaveBeenCalledTimes(0);
      expect(core.setFailed).toHaveBeenCalledTimes(0);
    });

    test('masks the token', () => {
      expect(core.setSecret).toHaveBeenCalledTimes(1);
      expect(core.setSecret).toHaveBeenCalledWith('fake-github-token');
    });

    test('does not save the token for revocation', () => {
      expect(core.saveState).toHaveBeenCalledTimes(0);
    });

    test('outputs the user token details', () => {
      expect(fixture.getOutput('token')).toBe('fake-github-token');
      expect(fixture.getOutput('token-type')).toBe('user');
    });
  });

  describe('when the OIDC token cannot be obtained', () => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      vi.spyOn(core, 'getIDToken').mockResolvedValue('');

      fixture = new ActionFixture(run);
      await fixture.run({
        'profile-name': 'costellobot',
      });
    });

    afterAll(async () => {
      vi.restoreAllMocks();
      await fixture?.destroy();
    });

    test('fails the action', () => {
      expect(core.error).toHaveBeenCalledTimes(2);
      expect(core.setFailed).toHaveBeenCalledTimes(1);
      expect(core.setFailed).toHaveBeenCalledWith('Failed to get GitHub OIDC token.');
    });

    test('does not output a token', () => {
      expect(fixture.getOutput('token')).toBeUndefined();
    });
  });

  describe('when the broker request fails', () => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup('get-github-token/failure');

      vi.spyOn(core, 'getIDToken').mockResolvedValue('fake-oidc-token');
      vi.spyOn(core, 'setSecret').mockImplementation(() => {});

      fixture = new ActionFixture(run);
      await fixture.run({
        'profile-name': 'costellobot',
      });
    });

    afterAll(async () => {
      vi.restoreAllMocks();
      await fixture?.destroy();
    });

    test('fails the action', () => {
      expect(core.error).toHaveBeenCalledTimes(2);
      expect(core.setFailed).toHaveBeenCalledTimes(1);
      expect(core.setFailed).toHaveBeenCalledWith(
        'Failed to get GitHub token from broker. Status: 401, Body: {"type":"https://tools.ietf.org/html/rfc9110#section-15.5.2","title":"Unauthorized","status":401,"detail":"The supplied OIDC token is invalid."}'
      );
    });

    test('does not mask the token', () => {
      expect(core.setSecret).toHaveBeenCalledTimes(0);
    });

    test('does not output a token', () => {
      expect(fixture.getOutput('token')).toBeUndefined();
    });
  });

  describe('when the broker request succeeds after a retry', () => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup('get-github-token/retry-then-success');

      vi.spyOn(Math, 'random').mockReturnValue(0);
      vi.spyOn(globalThis, 'setTimeout').mockImplementation(invokeTimerImmediately);
      vi.spyOn(core, 'getIDToken').mockResolvedValue('fake-oidc-token');
      vi.spyOn(core, 'saveState').mockImplementation(() => {});
      vi.spyOn(core, 'setSecret').mockImplementation(() => {});

      fixture = new ActionFixture(run);
      await fixture.run({
        'profile-name': 'costellobot-retry-success',
      });
    });

    afterAll(async () => {
      vi.restoreAllMocks();
      await fixture?.destroy();
    });

    test('retries the request and succeeds', () => {
      expect(core.warning).toHaveBeenCalledTimes(1);
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 1 to get GitHub token failed: Failed to get GitHub token from broker. Status: 503')
      );
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Retrying in 500ms.'));
      expect(core.setFailed).toHaveBeenCalledTimes(0);
      expect(fixture.getOutput('token')).toBe('fake-github-token');
      expect(fixture.getOutput('token-type')).toBe('app');
    });
  });

  describe('when transient broker failures exhaust the retries', () => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup('get-github-token/retry-exhausted');

      vi.spyOn(Math, 'random').mockReturnValue(0);
      vi.spyOn(globalThis, 'setTimeout').mockImplementation(invokeTimerImmediately);
      vi.spyOn(core, 'getIDToken').mockResolvedValue('fake-oidc-token');
      vi.spyOn(core, 'setSecret').mockImplementation(() => {});

      fixture = new ActionFixture(run);
      await fixture.run({
        'profile-name': 'costellobot-retry-exhausted',
      });
    });

    afterAll(async () => {
      vi.restoreAllMocks();
      await fixture?.destroy();
    });

    test('fails after the final attempt', () => {
      expect(core.warning).toHaveBeenCalledTimes(3);
      expect(core.error).toHaveBeenCalledTimes(2);
      expect(core.setFailed).toHaveBeenCalledTimes(1);
      expect(core.setFailed).toHaveBeenCalledWith(
        'Failed to get GitHub token from broker. Status: 503, Body: {"type":"https://httpstatuses.com/503","title":"Service Unavailable","status":503,"detail":"The broker is temporarily unavailable."}'
      );
    });
  });

  describe.each([
    ['missing-token', 'an object without a token'],
    ['empty-token', 'an object with an empty token'],
    ['null-token', 'a null response body'],
  ])('when the broker returns %s', (name: string) => {
    let fixture: ActionFixture;

    beforeAll(async () => {
      await setup(`get-github-token/${name}`);

      vi.spyOn(core, 'getIDToken').mockResolvedValue('fake-oidc-token');
      vi.spyOn(core, 'setSecret').mockImplementation(() => {});

      fixture = new ActionFixture(run);
      await fixture.run({
        'profile-name': 'costellobot',
      });
    });

    afterAll(async () => {
      vi.restoreAllMocks();
      await fixture?.destroy();
    });

    test('fails the action', () => {
      expect(core.error).toHaveBeenCalledTimes(2);
      expect(core.setFailed).toHaveBeenCalledTimes(1);
      expect(core.setFailed).toHaveBeenCalledWith('Failed to get GitHub token from broker. No token was returned.');
    });

    test('does not mask the token', () => {
      expect(core.setSecret).toHaveBeenCalledTimes(0);
    });

    test('does not output a token', () => {
      expect(fixture.getOutput('token')).toBeUndefined();
    });
  });
});
