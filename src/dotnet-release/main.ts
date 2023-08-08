// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { Context } from '@actions/github/lib/context';
import { getFileContents } from '../shared/github';
import { isPreview, ReleaseChannel } from '../shared/dotnet';

/* eslint-disable no-console */

export async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('github-token', { required: false });
    const previousSha = core.getInput('ref', { required: false });

    const context = new Context();
    let github = getOctokit(githubToken);

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
    const releaseNotes: ReleaseChannel[] = [];

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

    if (releaseNotesUpdated) {
      const branchesToDispatch: string[] = [];
      if (releaseNotes.some((release) => !isPreview(release))) {
        branchesToDispatch.push('main');
      }
      if (releaseNotes.some((release) => isPreview(release))) {
        branchesToDispatch.push('dotnet-vnext');
      }

      const event_type = 'dotnet_release';

      for (const name of branchesToDispatch) {
        type dotnet_release = {
          branch: string;
        };
        const client_payload: dotnet_release = {
          branch: name,
        };

        await github.rest.repos.createDispatchEvent({
          owner: context.repo.owner,
          repo: context.repo.repo,
          event_type,
          client_payload,
        });
        core.notice(`Dispatched ${event_type} for branch ${name}`);
      }
    }

    if (updatedSha) {
      const stateToken = core.getInput('state-token', { required: false });
      github = getOctokit(stateToken);

      await github.request('PATCH /repos/{owner}/{repo}/actions/variables/{name}', {
        owner: context.repo.owner,
        repo: context.repo.repo,
        name: 'DOTNET_CORE_SHA',
        value: updatedSha,
      });

      core.notice(`dotnet/core SHA updated to ${updatedSha}`);
    }
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
