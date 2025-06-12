// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { handle } from '../../src/shared/errors';

describe('handle', () => {
  beforeEach(() => {
    jest.spyOn(core, 'error').mockImplementation(() => {});
    jest.spyOn(core, 'setFailed').mockImplementation(() => {});
  });

  test('for Error', () => {
    let err;

    try {
      throw new Error('This is my error');
    } catch (e) {
      err = e;
    }

    handle(err);

    expect(core.error).toHaveBeenCalledTimes(2);
    expect(core.error).toHaveBeenCalledWith(err);
    expect(core.error).toHaveBeenCalledWith(err.stack ?? '');
    expect(core.setFailed).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenCalledWith(err.message);
  });

  test('for Error with no stack', () => {
    const err = new Error('This is my error');

    handle(err);

    expect(core.error).toHaveBeenCalledTimes(2);
    expect(core.error).toHaveBeenCalledWith(err);
    expect(core.error).toHaveBeenCalledWith(err.stack ?? '');
    expect(core.setFailed).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenCalledWith(err.message);
  });

  test('for string', () => {
    const message = 'This is my error';

    handle(message);

    expect(core.error).toHaveBeenCalledTimes(1);
    expect(core.error).toHaveBeenCalledWith(message);
    expect(core.setFailed).toHaveBeenCalledTimes(0);
  });
});
