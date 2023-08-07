// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { getFileContents } from '../shared/github';

/* eslint-disable no-console */

export async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: false });
    const previousSha = core.getInput('ref', { required: false });
    const github = getOctokit(token);

    const owner = 'dotnet';
    const repo = 'core';

    const { data: branch } = await github.rest.repos.getBranch({
      owner,
      repo,
      branch: 'main',
    });

    const currentSha = branch.commit.sha;

    console.log(` Current SHA: ${currentSha}`);
    console.log(`Previous SHA: ${previousSha}`);

    let releaseNotesFiles: string[] = [];
    let updatedSha = '';

    if (currentSha !== previousSha) {
      const { data: diff } = await github.rest.repos.compareCommitsWithBasehead({
        owner,
        repo,
        basehead: `${previousSha}...${currentSha}`,
      });
      updatedSha = currentSha;
      if (diff.files) {
        releaseNotesFiles = diff.files
          .map((file) => file.filename)
          .filter((file) => file.startsWith('release-notes/') && file.endsWith('/releases.json'));
      }

      console.log(`${releaseNotesFiles} release notes file(s) were updated.`);
    }

    const releaseNotesUpdated = releaseNotesFiles.length > 0;
    const releaseNotes: any[] = [];

    if (releaseNotesUpdated) {
      for (const path of releaseNotesFiles) {
        const release = await getFileContents(github, owner, repo, path, currentSha);

        // Remove the releases array from the release notes
        // otherwise the JSON is too large to use as an output.
        const notes: ReleaseChannel = JSON.parse(release);
        delete notes.releases;

        console.log(`Release notes for ${path}:\n${JSON.stringify(notes, null, 2)}`);

        releaseNotes.push(notes);
      }
    }

    core.setOutput('dotnet-core-updated-sha', updatedSha);
    core.setOutput('dotnet-release-notes', JSON.stringify(releaseNotes));
    core.setOutput('dotnet-releases-updated', releaseNotesUpdated);
  } catch (error: any) {
    core.error(error);
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

if (require.main === module) {
  run();
}

interface ReleaseChannel {
  'channel-version': string;
  'latest-release': string;
  'latest-release-date': string;
  'latest-runtime': string;
  'latest-sdk': string;
  'release-type': string;
  'support-phase': string;
  'eol-date"': string;
  'lifecycle-policy"': string;
  'releases'?: Release[];
}

interface Release {
  'release-date': string;
  'release-version': string;
  'security': boolean;
  'release-notes': string;
}
