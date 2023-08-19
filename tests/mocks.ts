// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import { jest } from '@jest/globals';

type ContentResponse = {
  encoding: string;
};

export function getOctokitForContent(response: ContentResponse | any): any {
  let result: any;

  if ('encoding' in response) {
    result = {
      data: response,
    };
  } else {
    const json = JSON.stringify(response);
    result = {
      data: {
        content: Buffer.from(json).toString('base64'),
        encoding: 'base64',
      },
    };
  }

  return {
    rest: {
      repos: {
        getContent: jest.fn().mockReturnValueOnce(result),
      },
    },
  };
}
