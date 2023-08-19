// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import { describe, expect, test } from '@jest/globals';
import { getBadge } from '../../src/shared/badges';

describe('getBadge', () => {
  test('encodes the label and message', () => {
    const label = 'this-is my_label';
    const message = 'this_is my-message';
    const color = '512BD4';
    const logo = 'dotnet';
    const actual = getBadge(label, message, color, logo);
    expect(actual).toBe('https://img.shields.io/badge/this--is_my__label-this__is_my--message-512BD4?logo=dotnet');
  });
});
