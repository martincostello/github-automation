// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { HttpClient } from '@actions/http-client';
import { handle } from '../shared/errors';
import { XMLParser } from 'fast-xml-parser';
import { Octokit, getFileContents } from '../shared/github';

const owner = 'dotnet';
const repositoryNames = ['aspnetcore', 'efcore', 'installer', 'runtime', 'sdk'];

function createDependency(name: string, packageName: string | null, dependencies: string[] = []): ProductRepository {
  return {
    dependencies,
    name: `dotnet/${name}`,
    owner,
    packageName,
    repo: name,
    sha: '',
  };
}

function getDependencyGraph(): DependencyGraph {
  const runtime = createDependency('runtime', 'Microsoft.NETCore.App.Ref');
  const efcore = createDependency('efcore', 'Microsoft.EntityFrameworkCore', [runtime.name]);
  const aspnetcore = createDependency('aspnetcore', 'Microsoft.AspNetCore.App.Ref', [runtime.name, efcore.name]);
  const sdk = createDependency('sdk', 'Microsoft.NET.Sdk', [runtime.name, aspnetcore.name]);
  const installer = createDependency('installer', null, [sdk.name]);

  return {
    root: installer.name,
    graph: {
      [runtime.name]: runtime,
      [efcore.name]: efcore,
      [aspnetcore.name]: aspnetcore,
      [sdk.name]: sdk,
      [installer.name]: installer,
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
    const dependency = dependencies.find((x: any) => x['@Name'] === name);
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
  const sdkVersion = versionRaw.trim();

  const platform = 'win-x64';
  const commitsUrl = `https://dotnetbuilds.azureedge.net/public/Sdk/${sdkVersion}/productCommit-${platform}.json`;

  const commits = (await httpClient.getJson<SdkProductCommits>(commitsUrl)).result;

  if (!commits) {
    return null;
  }

  return {
    version: sdkVersion,
    commits,
  };
}

async function findDependencySha(
  github: Octokit,
  root: ProductRepository,
  target: ProductRepository,
  ref: string,
  graph: DependencyGraph
): Promise<string | null> {
  if (root.name === target.name) {
    return root.sha;
  }

  const xml = await getFileContents(github, owner, root.repo, 'eng/Version.Details.xml', ref);

  for (const dependency of root.dependencies) {
    const repository = graph.graph[dependency];
    if (!repository || !target.packageName) {
      continue;
    }

    let dependencySha = getDependencySha(target.packageName, xml);

    if (!dependencySha) {
      dependencySha = await findDependencySha(github, repository, target, repository.sha, graph);
    }

    if (dependencySha) {
      return dependencySha;
    }
  }

  return null;
}

export async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: false });
    const pull_number = Number.parseInt(core.getInput('pull-request', { required: true }), 10);
    const repo = core.getInput('repository-name', { required: true });

    if (!repositoryNames.includes(repo)) {
      throw new Error(`The ${repo} repository is not supported.`);
    }

    const github: Octokit = getOctokit(token);

    const { data: pull } = await github.rest.pulls.get({
      owner,
      pull_number,
      repo,
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

    if (pull.merged && pull.merge_commit_sha) {
      const branch = pull.base.ref;
      const merge_commit_sha = pull.merge_commit_sha;

      const installer = graph.graph[graph.root];
      let repository: ProductRepository | null = null;

      for (const [, dependency] of Object.entries(graph.graph)) {
        if (dependency.repo === repo) {
          repository = dependency;
        }
      }

      if (!repository) {
        throw new Error(`The ${repo} repository is not supported.`);
      }

      const releasePrefix = 'release/';
      const channel = branch.startsWith(releasePrefix) ? branch.slice(releasePrefix.length) : '9.0';

      const sdkVersion = await getLatestSdkVersion(channel.slice(0, 3));

      if (sdkVersion) {
        for (const [, dependency] of Object.entries(graph.graph)) {
          dependency.sha = sdkVersion?.commits[dependency.repo]?.commit;
        }
      }

      const product = sdkVersion?.commits[repo];

      if (product) {
        const latest_sha = await findDependencySha(github, installer, repository, installer.sha, graph);

        if (latest_sha) {
          const commits = await github.paginate(github.rest.repos.listCommits, {
            owner,
            repo,
            sha: branch,
            since: pull.created_at,
            per_page: 100,
          });

          const exists = commits.find((commit) => commit.sha === merge_commit_sha);

          if (exists) {
            isAvailable = true;
            installerVersion = sdkVersion.version;
          }
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
  name: string;
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
  graph: Record<string, ProductRepository>;
};

type LatestInstallerVersion = {
  version: string;
  commits: SdkProductCommits;
};
