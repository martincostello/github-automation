// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import { vi } from 'vitest';

// Mock @actions/core to allow spying on its methods
// We need to create the mocks in a way that allows them to be reconfigured in tests
const setFailedMock = vi.fn();
const debugMock = vi.fn();
const infoMock = vi.fn();
const noticeMock = vi.fn();
const warningMock = vi.fn();
const errorMock = vi.fn();
const addRawMock = vi.fn();
const writeMock = vi.fn();

vi.mock('@actions/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@actions/core')>();
  return {
    ...actual,
    setFailed: setFailedMock,
    debug: debugMock,
    info: infoMock,
    notice: noticeMock,
    warning: warningMock,
    error: errorMock,
    summary: {
      ...actual.summary,
      addRaw: addRawMock.mockReturnValue(actual.summary),
      write: writeMock.mockResolvedValue(actual.summary),
    },
  };
});
