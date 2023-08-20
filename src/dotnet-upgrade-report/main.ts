// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { Context } from '@actions/github/lib/context';
import fetch from 'node-fetch';
import { getBadge } from '../shared/badges';
import { ReleasesIndex } from '../shared/dotnet';
import { handle } from '../shared/errors';
import { getDotNetSdk, getFileContents, getPull, getReposForCurrentUser, getWorkflowConfig } from '../shared/github';

export async function run(): Promise<void> {
  try {
    const default_branch = 'dotnet-vnext';

    const branch = (core.getInput('branch', { required: false }) || default_branch).trim();
    const gist_id = core.getInput('gist-id', { required: false });
    const token = core.getInput('github-token', { required: false });
    const channel = core.getInput('channel', { required: false });

    const context = new Context();
    const github = getOctokit(token);

    const repositories = (await getReposForCurrentUser({ octokit: github }, 'owner')).map((repo) => repo.full_name);
    const { checksOfInterest } = await getWorkflowConfig(github, context);

    let latestVersion: string;

    if (branch === default_branch || !channel) {
      const releasesIndex = await getFileContents(github, 'dotnet', 'core', 'release-notes/releases-index.json', 'main');
      const releases: ReleasesIndex = JSON.parse(releasesIndex);
      if (releases['releases-index']?.length < 0) {
        throw new Error('No releases found in releases-index.json.');
      }
      latestVersion = releases['releases-index'][0]['latest-sdk'];
    } else {
      const quality = core.getInput('quality', { required: false }) || 'daily';
      const versionsFile = await fetch(`https://aka.ms/dotnet/${channel}/${quality}/sdk-productVersion.txt`);
      const versions = await versionsFile.text();
      latestVersion = versions.trim();
    }

    const report = [
      '# .NET vNext Upgrade Report',
      '',
      '| Pull Request | SDK Version | Build Status | Conflicts? |',
      '| :----------- | :---------- | :----------- | :--------: |',
    ];

    let count = 0;

    for (const slug of repositories) {
      // eslint-disable-next-line no-console
      console.log(`Fetching data for ${slug}.`);

      const [owner, repo] = slug.split('/');
      let commit_sha;
      try {
        const response = await github.rest.repos.getBranch({
          owner,
          repo,
          branch,
        });
        commit_sha = response.data.commit.sha;
      } catch (err) {
        core.debug(`The ${branch} branch of ${slug} does not exist or does not have an open pull request.`);
        continue;
      }

      const dotnetSdk = await getDotNetSdk(github, owner, repo, branch);

      if (!dotnetSdk) {
        core.debug(`The ${branch} branch of ${slug} does not have a global.json file.`);
        continue;
      }

      let base_ref;

      if (branch === default_branch) {
        const { data: repository } = await github.rest.repos.get({
          owner,
          repo,
        });
        base_ref = repository.default_branch;
      } else {
        base_ref = default_branch;
      }

      const { data: prs } = await github.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha,
      });

      if (prs.length < 1) {
        continue;
      }

      const pull_for_ref = prs.find((pull) => pull.base.ref === base_ref);
      if (!pull_for_ref) {
        core.debug(`The ${branch} branch of ${slug} does not have an open pull request targeting ${base_ref}.`);
        continue;
      }

      const pull = await getPull(github, owner, repo, pull_for_ref.number);
      const hasConflicts = pull.mergeable_state === 'dirty';

      const { data: checkStatuses } = await github.rest.checks.listForRef({
        owner,
        repo,
        ref: commit_sha,
      });

      const statusesOfInterest = checkStatuses.check_runs
        .filter((check) => checksOfInterest.includes(check.name))
        .map((check) => ({
          status: check.status,
          conclusion: check.conclusion,
        }));

      let combinedStatus = 'success';

      for (const status of statusesOfInterest) {
        if (status.conclusion === 'failure') {
          combinedStatus = 'failure';
          break;
        } else if (status.status !== 'completed') {
          combinedStatus = 'pending';
        }
      }

      const sdkVersion = dotnetSdk.version;

      const buildColor = combinedStatus === 'success' ? 'brightgreen' : combinedStatus === 'pending' ? 'yellow' : 'red';
      const buildBadge = getBadge('build', combinedStatus, buildColor, 'github');
      const buildUrl = pull.html_url;

      const purple = '512BD4';
      const sdkColor = sdkVersion === latestVersion ? purple : 'yellow';
      const sdkBadge = getBadge('SDK', sdkVersion, sdkColor, 'dotnet');
      const sdkUrl = `${context.serverUrl}/${slug}/blob/${branch}/global.json#L${dotnetSdk.line}`;

      const conflictsColor = hasConflicts ? 'red' : 'brightgreen';
      const conflictsBadge = getBadge('Conflicts', hasConflicts ? 'Yes' : 'No', conflictsColor, 'git');
      const conflictsUrl = pull.html_url;

      count++;
      report.push(
        `| [${slug}#${pull.number}](${pull.html_url}) | [![.NET SDK version](${sdkBadge})](${sdkUrl}) | [![Build: ${combinedStatus}](${buildBadge})](${buildUrl}) | [![Merge conflicts?](${conflictsBadge})](${conflictsUrl}) |`
      );
    }

    if (count === 0) {
      return;
    }

    report.push('');
    report.push(
      `Generated by [GitHub Actions](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId})`
    );

    const reportText = report.join('\n');

    await core.summary.addRaw(reportText).write();

    if (gist_id && branch === default_branch) {
      const { data: gist } = await github.rest.gists.update({
        gist_id,
        files: {
          'summary.md': {
            content: reportText,
          },
        },
      });
      if (gist.html_url) {
        core.notice(gist.html_url);
      }
    }
  } catch (error: any) {
    handle(error);
  }
}

if (require.main === module) {
  run();
}
