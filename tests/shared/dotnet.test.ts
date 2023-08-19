// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import { describe, expect, test } from '@jest/globals';
import { SupportPhase, isPreview } from '../../src/shared/dotnet';

describe('isPreview', () => {
  test.each([
    ['preview', true],
    ['go-live', true],
    ['active', false],
    ['maintenance', false],
    ['eol', false],
    ['made-up', false]
  ])('%s', (supportPhase: string, expected: boolean) => {
    const releaseChannel = {
      'support-phase': supportPhase as SupportPhase,
      'channel-version': '6.0',
      'latest-release': '6.0.21',
      'latest-release-date': '2023-08-08',
      'latest-runtime': '6.0.21',
      'latest-sdk': '6.0.413',
      'release-type': 'lts',
      'eol-date"': '2024-11-12',
      'lifecycle-policy"': 'https://dotnet.microsoft.com/platform/support/policy/',
    };

    const actual = isPreview(releaseChannel);
    expect(actual).toBe(expected);
  });
});
