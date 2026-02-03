// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import * as fs from 'fs';
import * as io from '@actions/io';
import * as os from 'os';
import * as path from 'path';
import { vi } from 'vitest';
import { createEmptyFile, createTemporaryDirectory } from './helpers';

export class ActionFixture {
  public stepSummary: string = '';
  private tempDir: string = '';
  private outputPath: string = '';
  private outputs: Record<string, string> = {};

  constructor(private readonly sut: () => Promise<void>) {}

  async run(inputs: Record<string, string> = {}): Promise<void> {
    this.tempDir = await createTemporaryDirectory();
    this.outputPath = path.join(this.tempDir, 'github-outputs');

    await createEmptyFile(this.outputPath);

    this.setupEnvironment(inputs);
    this.setupMocks();

    await this.sut();

    const content = await fs.promises.readFile(this.outputPath, 'utf8');

    const lines = content.split(os.EOL);
    for (let index = 0; index < lines.length; index += 3) {
      const key = lines[index].split('<<')[0];
      const value = lines[index + 1];
      this.outputs[key] = value;
    }
  }

  async destroy(): Promise<void> {
    try {
      await io.rmRF(this.tempDir);
    } catch {
      console.log(`Failed to remove fixture directory '${this.tempDir}'.`);
    }
  }

  getOutput(name: string): string {
    return this.outputs[name];
  }

  private setupEnvironment(inputs: Record<string, string>): void {
    const environment = {
      GITHUB_OUTPUT: this.outputPath,
      GITHUB_REPOSITORY: 'martincostello/github-automation',
      GITHUB_RUN_ID: '42',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_SHA: 'fake-sha',
      RUNNER_DEBUG: '1',
    };

    for (const key in inputs) {
      environment[`INPUT_${key.toUpperCase()}`] = inputs[key];
    }

    for (const key in environment) {
      process.env[key] = environment[key as keyof typeof inputs];
    }
  }

  private setupMocks(): void {
    // Mocks are already set up in tests/setup.ts for ESM compatibility
    // Clear mock call counts before setting up implementations
    const coreMock = core as unknown as {
      setFailed: ReturnType<typeof vi.fn>;
      debug: ReturnType<typeof vi.fn>;
      info: ReturnType<typeof vi.fn>;
      notice: ReturnType<typeof vi.fn>;
      warning: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      summary: {
        addRaw: ReturnType<typeof vi.fn>;
        write: ReturnType<typeof vi.fn>;
      };
    };
    
    // Clear call counts
    coreMock.setFailed.mockClear();
    coreMock.debug.mockClear();
    coreMock.info.mockClear();
    coreMock.notice.mockClear();
    coreMock.warning.mockClear();
    coreMock.error.mockClear();
    coreMock.summary.addRaw.mockClear();
    coreMock.summary.write.mockClear();
    
    this.setupLogging();
  }

  private setupLogging(): void {
    const self = this;
    const logger = (level: string, arg: string | Error) => {
      console.debug(`[${level}] ${arg}`);
    };

    // Get the mocked functions and set up their implementation
    const coreMock = core as unknown as {
      debug: ReturnType<typeof vi.fn>;
      info: ReturnType<typeof vi.fn>;
      notice: ReturnType<typeof vi.fn>;
      warning: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      summary: {
        addRaw: ReturnType<typeof vi.fn>;
        write: ReturnType<typeof vi.fn>;
      };
    };

    coreMock.debug.mockImplementation((arg) => {
      logger('debug', arg);
    });
    coreMock.info.mockImplementation((arg) => {
      logger('info', arg);
    });
    coreMock.notice.mockImplementation((arg) => {
      logger('notice', arg);
    });
    coreMock.warning.mockImplementation((arg) => {
      logger('warning', arg);
    });
    coreMock.error.mockImplementation((arg) => {
      logger('error', arg);
    });

    coreMock.summary.addRaw.mockImplementation((text: string) => {
      self.stepSummary += text;
      return core.summary;
    });
  }
}
