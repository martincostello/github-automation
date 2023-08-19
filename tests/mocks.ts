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

export function getOctokitForPulls(responses: any | any[]): any {
  let mock = jest.fn();

  if (!Array.isArray(responses)) {
    responses = [responses];
  }

  for (const data of responses) {
    mock = mock.mockReturnValueOnce({
      data,
      headers: {
        'Etag': '42',
        'Last-Modified': new Date().toUTCString(),
      },
    });
  }

  return {
    rest: {
      pulls: {
        get: mock,
      },
    },
  };
}

export function getOctokitForRepos(data: any[]): any {
  return {
    octokit: {
      paginate: (...args: any[]) => args[0](args.slice(1)),
      rest: {
        repos: {
          listForAuthenticatedUser: jest.fn().mockReturnValueOnce(data),
        },
      },
    },
  };
}
