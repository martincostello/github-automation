// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import { error, setFailed } from '@actions/core';

export function handle(err: any): void {
  error(err);
  if (err instanceof Error) {
    if (err.stack) {
      error(err.stack);
    }
    setFailed(err.message);
  }
}
