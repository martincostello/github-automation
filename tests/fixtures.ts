// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import nock from 'nock';
import { join } from 'path';
import * as fs from 'fs';

type Fixture = {
  scenarios: Scenario[];
};

type Scenario = {
  basePath: string;
  method?: 'GET' | 'PATCH';
  path: string;
  status?: number;
  response: any;
};

nock.disableNetConnect();

export async function setup(name: string): Promise<void> {
  const fileName = join(__dirname, 'fixtures', `${name}.json`);
  const json = await fs.promises.readFile(fileName, 'utf8');
  const fixture: Fixture = JSON.parse(json);

  for (const scenario of fixture.scenarios) {
    const scope = nock(scenario.basePath);

    let interceptor;

    if (scenario.method === 'PATCH') {
      interceptor = scope.patch(scenario.path);
    } else {
      interceptor = scope.get(scenario.path);
    }

    interceptor.reply(scenario.status ?? 200, scenario.response);
  }
}
