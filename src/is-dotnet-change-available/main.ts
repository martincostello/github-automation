// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { handle } from '../shared/errors';
import { XMLParser } from 'fast-xml-parser';
import { Octokit, getFileContents } from '../shared/github';
import { fetch } from 'undici';

const defaultVersion = '9.0';
const owner = 'dotnet';
const repositoryNames = ['aspnetcore', 'efcore', 'installer', 'runtime', 'sdk'];

function getDependencyGraph(): DependencyGraph {
  const createRepository = (repo: string, dependencies: string[], packageName: string | null = null): ProductRepository => {
    return {
      dependencies,
      full_name: `dotnet/${repo}`,
      owner,
      packageName,
      repo,
      sha: '',
    };
  };

  const runtime = createRepository('runtime', [], 'Microsoft.NETCore.App.Ref');
  const efcore = createRepository('efcore', [runtime.full_name], 'Microsoft.EntityFrameworkCore');
  const aspnetcore = createRepository('aspnetcore', [runtime.full_name, efcore.full_name], 'Microsoft.AspNetCore.App.Ref');
  const sdk = createRepository('sdk', [runtime.full_name, aspnetcore.full_name], 'Microsoft.NET.Sdk');
  const installer = createRepository('installer', [sdk.full_name]);

  return {
    root: installer.full_name,
    nodes: {
      [runtime.full_name]: runtime,
      [efcore.full_name]: efcore,
      [aspnetcore.full_name]: aspnetcore,
      [sdk.full_name]: sdk,
      [installer.full_name]: installer,
    },
  };
}

function getDependencySha(name: string, xml: string): string | null {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });
  const versionDetails = parser.parse(xml);

  const dependencies = versionDetails?.Dependencies?.ProductDependencies?.Dependency;

  if (dependencies && 'find' in dependencies) {
    const dependency = dependencies.find((element: any) => element['@Name'] === name);
    if (dependency && 'Sha' in dependency) {
      return dependency.Sha;
    }
  }

  return null;
}

async function getLatestSdkVersion(channel: string): Promise<LatestInstallerVersion | null> {
  const quality = 'daily';
  const versionUrl = `https://aka.ms/dotnet/${channel}/${quality}/sdk-productVersion.txt`;

  const init = {
    headers: new Headers([['User-Agent', 'martincostello/github-automation']]),
  };

  let response = await fetch(versionUrl, init);

  if (response.status && response.status >= 400) {
    return null;
  }

  const contentType = response.headers.get('content-type');

  if (!(contentType === 'text/plain' || contentType === 'application/octet-stream')) {
    return null;
  }

  const versionRaw = await response.text();
  const version = versionRaw.trim();

  const platform = 'win-x64';
  const commitsUrl = `https://dotnetbuilds.azureedge.net/public/Sdk/${version}/productCommit-${platform}.json`;

  response = await fetch(commitsUrl, init);

  const commitsJson = await response.json();
  const commits = commitsJson as SdkProductCommits;

  if (!commits) {
    return null;
  }

  return {
    version,
    commits,
  };
}

async function findDependencySha(
  octokit: Octokit,
  root: ProductRepository,
  target: ProductRepository,
  graph: DependencyGraph
): Promise<string | null> {
  if (root.full_name === target.full_name) {
    return root.sha;
  }

  if (!target.packageName) {
    return null;
  }

  const xml = await getFileContents(octokit, owner, root.repo, 'eng/Version.Details.xml', root.sha);
  let sha = getDependencySha(target.packageName, xml);

  if (!sha) {
    for (const name of root.dependencies) {
      const dependency = graph.nodes[name];
      if (!dependency) {
        continue;
      }

      sha = await findDependencySha(octokit, dependency, target, graph);

      if (sha) {
        break;
      }
    }
  }

  return sha;
}

export async function run(): Promise<void> {
  try {
    const repo = core.getInput('repository-name', { required: true });
    const pull_number = Number.parseInt(core.getInput('pull-request', { required: true }), 10);
    const token = core.getInput('github-token', { required: false });

    if (!repositoryNames.includes(repo)) {
      throw new Error(`The ${repo} repository is not supported.`);
    }

    const github = getOctokit(token);

    const { data: pull } = await github.rest.pulls.get({
      owner,
      repo,
      pull_number,
    });

    let isAvailable = false;
    let installerVersion = '';

    if (pull.merged && pull.merge_commit_sha && pull.merged_at) {
      const branch = pull.base.ref;
      const merge_commit_sha = pull.merge_commit_sha;

      const releasePrefix = 'release/';
      const channel = branch.startsWith(releasePrefix) ? branch.slice(releasePrefix.length) : defaultVersion;

      const sdkVersion = await getLatestSdkVersion(channel.slice(0, 3));

      if (!sdkVersion) {
        throw new Error(`The SDK version could not be determined for the ${branch} branch of the ${repo} repository.`);
      }

      const graph = getDependencyGraph();

      let repository: ProductRepository | null = null;
      if (sdkVersion) {
        for (const [, dependency] of Object.entries(graph.nodes)) {
          dependency.sha = sdkVersion?.commits[dependency.repo]?.commit;
          if (dependency.repo === repo) {
            repository = dependency;
          }
        }
      }

      if (!repository) {
        throw new Error(`The ${repo} repository is not supported.`);
      }

      const installer = graph.nodes[graph.root];
      const sha = await findDependencySha(github, installer, repository, graph);

      if (sha) {
        const mergedAt = new Date(pull.merged_at);
        mergedAt.setMinutes(mergedAt.getMinutes() - 1);

        const since = mergedAt.toISOString();

        const commits = await github.paginate(github.rest.repos.listCommits, {
          owner,
          repo,
          sha,
          since,
          per_page: 100,
        });

        if (commits.find((commit) => commit.sha === merge_commit_sha)) {
          isAvailable = true;
          installerVersion = sdkVersion.version;
        }
      }
    }

    let report: string;
    if (isAvailable) {
      report = `The changes from [${owner}/${repo}#${pull_number}](${pull.html_url}) are available in version \`${installerVersion}\` of the .NET SDK.`;
    } else {
      report = `The changes from [${owner}/${repo}#${pull_number}](${pull.html_url}) are not yet available in a daily build of the .NET SDK.`;
    }

    await core.summary.addRaw(report).write();

    core.setOutput('is-available', isAvailable);
    core.setOutput('installer-version', installerVersion);
  } catch (error: any) {
    handle(error);
  }
}

if (require.main === module) {
  run();
}

type ProductRepository = {
  full_name: string;
  owner: string;
  repo: string;
  dependencies: string[];
  packageName: string | null;
  sha: string;
};

type ProductCommit = {
  commit: string;
  version: string;
};

type SdkProductCommits = {
  installer: ProductCommit;
  runtime: ProductCommit;
  aspnetcore: ProductCommit;
  windowsdesktop: ProductCommit;
  sdk: ProductCommit;
};

type DependencyGraph = {
  root: string;
  nodes: Record<string, ProductRepository>;
};

type LatestInstallerVersion = {
  version: string;
  commits: SdkProductCommits;
};
