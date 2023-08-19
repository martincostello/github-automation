// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import * as fs from 'fs';
import * as io from '@actions/io';
import * as os from 'os';
import * as path from 'path';
import { jest } from '@jest/globals';
import { createEmptyFile, createTemporaryDirectory } from './helpers';

export class ActionFixture {
  private tempDir: string = '';
  private githubStepSummary: string = '';
  private outputPath: string = '';
  private outputs: Record<string, string> = {};

  constructor(
    private readonly sut: () => Promise<void>,
    private readonly configureMocks: () => void = () => {}
  ) {}

  async initialize(inputs: Record<string, string> = {}): Promise<void> {
    this.tempDir = await createTemporaryDirectory();
    this.githubStepSummary = path.join(this.tempDir, 'github-step-summary.md');
    this.outputPath = path.join(this.tempDir, 'github-outputs');

    await createEmptyFile(this.githubStepSummary);
    await createEmptyFile(this.outputPath);

    this.setupEnvironment(inputs);
    this.setupMocks();
  }

  async run(): Promise<void> {
    await this.sut();

    const buffer = await fs.promises.readFile(this.outputPath);
    const content = buffer.toString();

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

  async getStepSummary(): Promise<string> {
    return await fs.promises.readFile(this.githubStepSummary, 'utf8');
  }

  private setupEnvironment(inputs: Record<string, string>): void {
    const environment = {
      GITHUB_OUTPUT: this.outputPath,
      GITHUB_STEP_SUMMARY: this.githubStepSummary,
      RUNNER_DEBUG: '1',
    };

    for (const key in inputs) {
      environment[`INPUT_${key.toUpperCase()}`] = inputs[key];
    }

    for (const key in environment) {
      process.env[key] = inputs[key as keyof typeof inputs];
    }
  }

  private setupMocks(): void {
    jest.spyOn(core, 'setFailed').mockImplementation(() => {});
    this.setupLogging();
    this.configureMocks();
  }

  private setupLogging(): void {
    const logger = (level: string, arg: string | Error) => {
      console.debug(`[${level}] ${arg}`);
    };

    jest.spyOn(core, 'debug').mockImplementation((arg) => {
      logger('debug', arg);
    });
    jest.spyOn(core, 'info').mockImplementation((arg) => {
      logger('info', arg);
    });
    jest.spyOn(core, 'notice').mockImplementation((arg) => {
      logger('notice', arg);
    });
    jest.spyOn(core, 'warning').mockImplementation((arg) => {
      logger('warning', arg);
    });
    jest.spyOn(core, 'error').mockImplementation((arg) => {
      logger('error', arg);
    });
  }
}
