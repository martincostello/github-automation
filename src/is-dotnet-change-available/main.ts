// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { HttpClient } from '@actions/http-client';
import { handle } from '../shared/errors';
import { XMLParser } from 'fast-xml-parser';
import { Octokit, getFileContents } from '../shared/github';

const defaultVersion = '9.0';
const owner = 'dotnet';
const repositoryNames = ['aspnetcore', 'efcore', 'installer', 'runtime', 'sdk'];

function createRepository(repo: string, dependencies: string[], packageName: string | null = null): ProductRepository {
  return {
    dependencies,
    full_name: `dotnet/${repo}`,
    owner,
    packageName,
    repo,
    sha: '',
  };
}

function getDependencyGraph(): DependencyGraph {
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

function createHttpClient(): HttpClient {
  return new HttpClient('martincostello/github-automation', [], {
    allowRetries: true,
    maxRetries: 3,
  });
}

function getDependencySha(name: string, xml: string): string | null {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });
  const versionDetails = parser.parse(xml);

  const dependencies = versionDetails?.Dependencies?.ProductDependencies?.Dependency;

  if (dependencies && 'find' in dependencies) {
    const dependency = dependencies.find((element: any) => element['@Name'] === name);
    if ('Sha' in dependency) {
      return dependency.Sha;
    }
  }

  return null;
}

async function getLatestSdkVersion(channel: string): Promise<LatestInstallerVersion | null> {
  const quality = 'Daily';
  const versionUrl = `https://aka.ms/dotnet/${channel}/${quality}/sdk-productVersion.txt`;

  const httpClient = createHttpClient();
  const response = await httpClient.get(versionUrl);

  if (response.message.statusCode && response.message.statusCode >= 400) {
    return null;
  }

  if (
    !(response.message.headers['content-type'] === 'text/plain' || response.message.headers['content-type'] === 'application/octet-stream')
  ) {
    return null;
  }

  const versionRaw = await response.readBody();
  const version = versionRaw.trim();

  const platform = 'win-x64';
  const commitsUrl = `https://dotnetbuilds.azureedge.net/public/Sdk/${version}/productCommit-${platform}.json`;

  const commits = (await httpClient.getJson<SdkProductCommits>(commitsUrl)).result;

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
  ref: string,
  graph: DependencyGraph
): Promise<string | null> {
  if (root.full_name === target.full_name) {
    return root.sha;
  }

  if (!target.packageName) {
    return null;
  }

  const xml = await getFileContents(octokit, owner, root.repo, 'eng/Version.Details.xml', ref);

  for (const name of root.dependencies) {
    const dependency = graph.nodes[name];
    if (!dependency) {
      continue;
    }

    let dependencySha = getDependencySha(target.packageName, xml);

    if (!dependencySha) {
      dependencySha = await findDependencySha(octokit, dependency, target, dependency.sha, graph);
    }

    if (dependencySha) {
      return dependencySha;
    }
  }

  return null;
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

    // - Is it possible to get a reference to a backport PR from a PR to main?
    // - From the PR, get the commit in the target branch
    //
    // dotnet/runtime#91107
    // -> dotnet/runtime#91218
    // -> dotnet/runtime@8ec6101174f841ec455180fba8f08d895e76ef2a in release/8.0
    // -> flow into dotnet/aspnetcore?
    // -> flow into dotnet/sdk?
    // -> flow into dotnet/installer?
    const graph = getDependencyGraph();

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
      const latest_sha = await findDependencySha(github, installer, repository, installer.sha, graph);

      if (latest_sha) {
        const mergedAt = new Date(pull.merged_at);
        mergedAt.setMinutes(mergedAt.getMinutes() - 5);

        const since = mergedAt.toISOString();

        const commits = await github.paginate(github.rest.repos.listCommits, {
          owner,
          repo,
          sha: latest_sha,
          since,
          per_page: 100,
        });

        if (commits.find((commit) => commit.sha === merge_commit_sha)) {
          isAvailable = true;
          installerVersion = sdkVersion.version;
        }
      }
    }

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
