// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import nock from 'nock';
import { join } from 'path';
import * as fs from 'fs';

type Scenario = {
  path: string;
  status: number;
  response: any;
};

const github = nock('https://api.github.com');

export async function setup(name: string): Promise<void> {
  const fileName = join(__dirname, 'fixtures', `${name}.json`);
  const json = await fs.promises.readFile(fileName, 'utf8');
  const scenario: Scenario = JSON.parse(json);
  github.get(scenario.path).reply(scenario.status, scenario.response);
}
