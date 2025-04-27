// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { handle } from '../shared/errors';
import { XMLParser } from 'fast-xml-parser';
import { Octokit, getFileContents } from '../shared/github';
import { fetch } from 'undici';

const owner = 'dotnet';
const repositoryNames = ['aspnetcore', 'efcore', 'installer', 'runtime', 'sdk'];

function getDependencyGraph(version: LatestInstallerVersion): DependencyGraph {
  const createRepository = (id: string, useVmr: boolean, dependencies: string[], packageName: string | null = null): ProductRepository => {
    const repo = useVmr ? 'dotnet' : id;
    return {
      id,
      dependencies,
      owner,
      packageName,
      repo,
      sha: '',
    };
  };

  const useVmr =
    version.commits.runtime.commit === version.commits.aspnetcore.commit &&
    version.commits.runtime.commit === version.commits.windowsdesktop.commit &&
    version.commits.runtime.commit === version.commits.sdk.commit;

  const runtime = createRepository('runtime', useVmr, [], 'Microsoft.NETCore.App.Ref');
  const efcore = createRepository('efcore', useVmr, [runtime.id], 'Microsoft.EntityFrameworkCore');
  const aspnetcore = createRepository('aspnetcore', useVmr, [runtime.id, efcore.id], 'Microsoft.AspNetCore.App.Ref');
  const sdk = createRepository('sdk', useVmr, [runtime.id, aspnetcore.id], 'Microsoft.NET.Sdk');
  const installer = version.commits.installer ? createRepository('installer', false, [sdk.id]) : sdk;

  return {
    root: installer.id,
    nodes: {
      [runtime.id]: runtime,
      [efcore.id]: efcore,
      [aspnetcore.id]: aspnetcore,
      [sdk.id]: sdk,
      [installer.id]: installer,
    },
  };
}

function getDependencySha(name: string, xml: string): string | null {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });
  const versionDetails = parser.parse(xml);

  const dependencies = versionDetails?.Dependencies?.ProductDependencies?.Dependency;

  if (dependencies && 'find' in dependencies) {
    const dependency = dependencies.find((element) => element['@Name'] === name);
    if (dependency && 'Sha' in dependency) {
      return dependency.Sha;
    }
  }

  return null;
}

async function getLatestSdkVersion(channel: string): Promise<LatestInstallerVersion | null> {
  const quality = 'daily';

  const init = {
    headers: new Headers([['User-Agent', 'martincostello/github-automation']]),
  };

  const platform = 'win-x64';
  const commitsUrl = `https://aka.ms/dotnet/${channel}/${quality}/productCommit-${platform}.json`;

  const response = await fetch(commitsUrl, init);

  if (response.status && response.status >= 400) {
    return null;
  }

  const commitsJson = await response.json();
  const commits = commitsJson as SdkProductCommits;

  if (!commits) {
    return null;
  }

  return {
    version: commits.sdk.version,
    commits,
  };
}

async function findDependencySha(
  octokit: Octokit,
  root: ProductRepository,
  target: ProductRepository,
  graph: DependencyGraph
): Promise<string | null> {
  if (root.id === target.id) {
    return root.sha;
  }

  if (!target.packageName) {
    return null;
  }

  if (root.repo === 'dotnet') {
    const manifestJson = await getFileContents(octokit, owner, root.repo, 'src/source-manifest.json', root.sha);
    const manifest = JSON.parse(manifestJson) as SourceManifest;
    if (manifest) {
      const repository = manifest.repositories.find((repo) => repo.path === root.id);
      if (repository) {
        return repository.commitSha;
      }
    }
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

async function findDependencyShaForVmr(octokit: Octokit, id: string, sha: string): Promise<string | null> {
  const manifestJson = await getFileContents(octokit, 'dotnet', 'dotnet', 'src/source-manifest.json', sha);
  const manifest = JSON.parse(manifestJson) as SourceManifest;
  if (manifest) {
    const repository = manifest.repositories.find((repo) => repo.path === id);
    if (repository) {
      return repository.commitSha;
    }
  }
  return null;
}

export async function run(): Promise<void> {
  try {
    const repo = core.getInput('repository-name', { required: true });
    const defaultChannel = core.getInput('channel', { required: true });
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
      const channel = branch.startsWith(releasePrefix) ? branch.slice(releasePrefix.length) : defaultChannel;

      const majorMinor = channel.split('.').slice(0, 2).join('.');
      const sdkVersion = await getLatestSdkVersion(majorMinor);

      if (!sdkVersion) {
        throw new Error(`The SDK version could not be determined for the ${branch} branch of the ${repo} repository.`);
      }

      const graph = getDependencyGraph(sdkVersion);

      let repository: ProductRepository | null = null;
      if (sdkVersion) {
        for (const [, dependency] of Object.entries(graph.nodes)) {
          dependency.sha = sdkVersion?.commits[dependency.id]?.commit;
          if (dependency.id === repo) {
            repository = dependency;
          }
        }
      }

      if (!repository) {
        throw new Error(`The ${repo} repository is not supported.`);
      }

      const root = graph.nodes[graph.root];
      const sha =
        root.repo === 'dotnet'
          ? await findDependencyShaForVmr(github, repo, root.sha)
          : await findDependencySha(github, root, repository, graph);

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
  } catch (error) {
    handle(error);
  }
}

if (require.main === module) {
  run();
}

type ProductRepository = {
  id: string;
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
  installer: ProductCommit | null;
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

type SourceManifest = {
  repositories: SourceRepository[];
};

type SourceRepository = {
  packageVersion: string;
  barId: number | null;
  path: string;
  remoteUri: string;
  commitSha: string;
};
