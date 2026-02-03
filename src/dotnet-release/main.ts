// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { isPreview, ReleaseChannel } from '../shared/dotnet.js';
import { handle } from '../shared/errors.js';
import { getFileContents } from '../shared/github.js';

/* eslint-disable no-console */

export async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('github-token', { required: false });
    const previousSha = core.getInput('ref', { required: false });

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
        basehead: `${previousSha || 'main'}...${currentSha}`,
      });
      updatedSha = currentSha;
      if (diff.files) {
        releaseNotesFiles = diff.files
          .filter((file) => file.status !== 'removed')
          .map((file) => file.filename)
          .filter((file) => file.startsWith('release-notes/') && file.endsWith('/releases.json'));
      }

      console.log(`${releaseNotesFiles.length} release notes file(s) were updated:`);
      for (const path of releaseNotesFiles) {
        console.log(` - ${path}`);
      }
    }

    const packages: string[] = [];
    const releaseNotesUpdated = releaseNotesFiles.length > 0;
    const releaseNotes: ReleaseChannel[] = [];

    if (releaseNotesUpdated) {
      for (const path of releaseNotesFiles) {
        const release = await getFileContents(github, owner, repo, path, currentSha);

        const notes: ReleaseChannel = JSON.parse(release);
        const latest = notes.releases?.find((r) => r['release-version'] === notes['latest-release']);

        if (latest) {
          const runtimeVersion = latest['runtime'].version;
          const aspnetcoreVersion = latest['aspnetcore-runtime'].version;

          const rids = ['linux-x64', 'osx-arm64', 'win-x64'];

          for (const rid of rids) {
            packages.push(`runtime.${rid}.Microsoft.DotNet.ILCompiler@${runtimeVersion}`);
          }

          packages.push(`Microsoft.NET.ILLink.Tasks@${runtimeVersion}`);

          for (const rid of rids) {
            packages.push(`Microsoft.NETCore.App.Runtime.${rid}@${runtimeVersion}`);
          }

          for (const rid of rids) {
            packages.push(`Microsoft.AspNetCore.App.Runtime.${rid}@${aspnetcoreVersion}`);
          }

          packages.push(`Microsoft.AspNetCore.Mvc.Testing@${aspnetcoreVersion}`);

          const supportPhase = notes['support-phase'];

          if (supportPhase === 'preview' || supportPhase === 'go-live' || parseFloat(notes['channel-version']) >= 9.0) {
            packages.push(`System.Text.Json@${runtimeVersion}`);
          }
        }

        // Remove the releases array from the release notes
        // otherwise the JSON is too large to use as an output.
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

      // Only dispatch for dotnet-vnext if only a preview was released.
      // Otherwise changes to main will just end up creating merge conflicts.
      if (releaseNotes.every((release) => isPreview(release))) {
        branchesToDispatch.push('dotnet-vnext');
      }

      const event_type = 'dotnet_release';

      for (const name of branchesToDispatch) {
        type dotnet_release = {
          branch: string;
          packages: string;
        };
        const client_payload: dotnet_release = {
          branch: name,
          packages: packages.join(','),
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

      await github.rest.actions.updateRepoVariable({
        owner: context.repo.owner,
        repo: context.repo.repo,
        name: 'DOTNET_CORE_SHA',
        value: updatedSha,
      });

      core.notice(`dotnet/core SHA updated to ${updatedSha}`);
    }

    core.setOutput('sdk-versions', JSON.stringify(releaseNotes.map((r) => r['latest-sdk'])));
  } catch (error) {
    handle(error);
  }
}

if (require.main === module) {
  run();
}
