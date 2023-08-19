// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as fs from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export async function createEmptyFile(fileName: string) {
  await fs.promises.writeFile(fileName, '');
}

export async function createTemporaryDirectory(): Promise<string> {
  return await fs.promises.mkdtemp(join(tmpdir(), 'github-automation-'));
}
