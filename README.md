# GitHub Automation

GitHub automation for my repositories.

[![Build status](https://github.com/martincostello/github-automation/actions/workflows/build.yml/badge.svg?branch=main&event=push)](https://github.com/martincostello/github-automation/actions/workflows/build.yml?query=branch%3Amain+event%3Apush)
[![codecov](https://codecov.io/gh/martincostello/github-automation/branch/main/graph/badge.svg)](https://codecov.io/gh/martincostello/github-automation)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/martincostello/github-automation/badge)](https://securityscorecards.dev/viewer/?uri=github.com/martincostello/github-automation)

## Workflows

The following workflows are available.

| **Workflow**                                                                 | **Description**                                                                                                            |
| :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| [acr-housekeeping][acr-housekeeping]                                         | Deletes old container images in [Azure Container Registry][acr].                                                           |
| [dotnet-dependencies-updated][dotnet-dependencies-updated]                   | Runs the `rebase` workflow for a repository when its dependencies are determined to have changed.                          |
| [dotnet-bumper][dotnet-bumper]                                               | Runs [_.NET Bumper_][dotnet-bumper-tool] and generates a pull request to update the .NET version used in a repository.     |
| [dotnet-release][dotnet-release]                                             | Runs every 15 minutes to check for new official releases of the .NET SDK.                                                  |
| [dotnet-upgrade-report][dotnet-upgrade-report]                               | Runs daily to produce a report for a specified branch used for testing .NET vNext.                                         |
| [dotnet-upgrade-report-for-nightly][dotnet-upgrade-report-for-nightly]       | Runs daily to produce a report for a specified branch used for testing .NET vNext using [.NET daily builds][dotnet-daily]. |
| [dotnet-version-report][dotnet-version-report]                               | Generates a report of the .NET SDK versions used by the default branch of my repositories.                                 |
| [is-dotnet-change-available][is-dotnet-change-available]                     | Determines whether the changes from a pull request are available in a .NET installer build                                 |
| [issue-metrics][issue-metrics]                                               | Runs monthly to generate a report of metrics for issues and pull requests for my repositories.                             |
| [nuget-packages-published][nuget-packages-published]                         | Waits for one or more NuGet packages to be published and then comments on issues/PRs associated with their milestone.      |
| [rebase][rebase]                                                             | Rebases a branch of one or more repositories onto a specified base branch.                                                 |
| [rebase-pull-request][rebase-pull-request]                                   | Rebases a pull request onto the default branch of a repository in response to a comment on the pull request.               |
| [update-dotnet-sdks][update-dotnet-sdks]                                     | Runs the `update-dotnet-sdk` workflow for one or more repositories for a specified branch.                                 |
| [update-dotnet-sdks-for-nightly][update-dotnet-sdks-for-nightly]             | Runs the `update-dotnet-sdks` workflow daily for the `dotnet-nightly` branch.                                              |
| [update-github-dependencies][update-github-dependencies]                     | Checks for new versions of GitHub projects and updates environment variables containing their version.                     |
| [update-static-assets][update-static-assets]                                 | Checks for new releases of static HTML assets served from [cdnjs][cdnjs] and generates pull requests to update them.       |

### .NET Dependencies Updated

The [dotnet-dependencies-updated][dotnet-dependencies-updated] workflow
is triggered when a `repository_dispatch` event is received for the `dotnet_dependencies_updated`
event type. The workflow then runs the [rebase][rebase] workflow for the
repository specified in the payload.

```json
{
  "event_type": "dotnet_dependencies_updated",
  "client_payload": {
    "repository": "owner/repository",
    "ref": "main",
    "sha": "{git commit sha}"
  }
}
```

The `repository_dispatch` events are created by [Costellobot][costellobot].

### .NET Release

The [dotnet-release][dotnet-release] workflow runs every 15 minutes to
check if any changes have been made to the `release-notes/**/*.json` files
in the [dotnet/core][dotnet-core] repository.

If changes are detected that may signify a new release of the .NET SDK is available,
then the workflow will create a `repository_dispatch` event for the `dotnet_release`
event type.

```json
{
  "event_type": "dotnet_release",
  "client_payload": {
    "branch": "(main|dotnet-vnext)"
  }
}
```

The event is only dispatched for the `dotnet-vnext` branch if the `support-phase` of
any new SDK released for a given release channel is either `preview` or `go-live`.

### .NET Upgrade Report

The [dotnet-upgrade-report][dotnet-upgrade-report] workflow runs daily and generates
a markdown report that finds all of the open pull requests against a given branch,
by default the `dotnet-vnext` branch, and then checks if the pull request is using the
latest version of the .NET SDK for the relevant .NET release, whether the CI is passing
and whether the pull request has any merge conflicts.

For the `dotnet-vnext` branch, the report content will also be updated [in this Gist][upgrade-report-gist].

### .NET Version Report

The [dotnet-version-report][dotnet-version-report] workflow runs on-demand and
generates a markdown report that finds all of the repositories owned by the
configured GitHub Personal Access Token (PAT) and shows which .NET SDK versions
are used by the default branch of each of the repositories and whether that version
is the latest official release.

### Is .NET Change Available?

The [is-dotnet-change-available][is-dotnet-change-available] workflow is run manually
to determine whether the changes from a pull request to a .NET repository have flowed
into a daily build of the .NET SDK from the [dotnet/sdk][dotnet-installer] repository.

### Issue Metrics

The [issue-metrics][issue-metrics] workflow runs monthly and generates a markdown
report about the issues and pull requests for the repositories owned by the
configured GitHub Personal Access Token (PAT) using the
[github/issue-metrics][issue-metrics-action] action.

### Rebase

The [rebase][rebase] workflow rebases a branch of all of the repositories in the
configured owner onto the default branch of the repository.

The [Rebaser][rebaser] action is used to rebase the branch.
Rebaser will attempt to resolve conflicts for versions of the
.NET SDK, NuGet packages and npm packages automatically by always
preferring the highest version number.

If the conflicts in a rebase cannot be automatically resolved,
then it will be aborted and it will need to be manually dealt with.

#### Manually Rebasing

To manually resolve the conflicts, you can checkout the [rebaser][rebaser]
repository locally and run the following commands to interatively rebase the
branch locally using the action using Node.js and Visual Studio Code.

```powershell
# First checkout the repository you wish to rebase locally, and then checkout
# the branch you wish to rebase and ensure it is in sync with the remote.

$repositoryPath = "my-repository"

# The default branch parameter is optional and defaults to "main".
$defaultBranch = "main"

# Clone the martincostello/rebaser repository.
git clone https://github.com/martincostello/rebaser
cd ./rebaser

# Run martincostello/rebaser interactively via the helper script.
./rebase.ps1 $repositoryPath $defaultBranch

# Rebaser will open Visual Studio Code for each file that needs a merge
# conflict to be resolved. Once you have resolved the conflicts, save the
# file and close Visual Studio Code. Rebaser will then continue the rebase.

# Assuming you are happy with the results of the rebase,
# you can then force push the changes to your remote to finish.
# If you don't like the results, then you can reset the branch.
```

### Update .NET SDKs

The [update-dotnet-sdks][update-dotnet-sdks] workflow runs the
[update-dotnet-sdk][update-dotnet-sdk] workflow for all of the repositories
accessible to the configured GitHub Personal Access Token (PAT) that contain
a `global.json` file in the repository's root directory.

The behaviour of the `update-dotnet-sdk` workflow for a given repository
can be configured through a `.github/update-dotnet-sdk.json` file in the
repository to which updates are being performed.

The schema for the configuration file can be found [here][update-dotnet-sdk-schema].

### Update .NET SDKs for Nightly

The [update-dotnet-sdks-for-nightly][update-dotnet-sdks-for-nightly]
workflow runs the update-dotnet-sdks workflow daily for the `dotnet-nightly` branch.

## Onboarding

The workflows above are based on a number of conventions to make the same
approach easy to apply to multiple repositories. For more information
about these conventions and how to apply the ideas in this repository to
your own GitHub repositories, see the [onboarding documentation][onboarding].

## Feedback

Any feedback or issues can be added to the issues for this project in
[GitHub][issues].

## Repository

The repository is hosted in [GitHub][repository]: <https://github.com/martincostello/github-automation.git>

## License

This project is licensed under the [Apache 2.0][license] license.

[acr]: https://azure.microsoft.com/products/container-registry "Azure Container Registry"
[acr-housekeeping]: ./.github/workflows/acr-housekeeping.yml
[cdnjs]: https://cdnjs.com/
[costellobot]: https://github.com/martincostello/costellobot
[dotnet-core]: https://github.com/dotnet/core
[dotnet-bumper]: ./.github/workflows/dotnet-bumper.yml
[dotnet-bumper-tool]: https://github.com/martincostello/dotnet-bumper
[dotnet-daily]: https://github.com/dotnet/sdk/blob/main/documentation/package-table.md
[dotnet-dependencies-updated]: ./.github/workflows/dotnet-dependencies-updated.yml
[dotnet-installer]: https://github.com/dotnet/sdk
[dotnet-release]: ./.github/workflows/dotnet-release.yml
[dotnet-upgrade-report]: ./.github/workflows/dotnet-upgrade-report.yml
[dotnet-upgrade-report-for-nightly]: ./.github/workflows/dotnet-upgrade-report-for-nightly.yml
[dotnet-version-report]: ./.github/workflows/dotnet-version-report.yml
[is-dotnet-change-available]: ./.github/workflows/is-dotnet-change-available.yml
[issue-metrics]: ./.github/workflows/issue-metrics.yml
[issue-metrics-action]: https://github.com/github/issue-metrics#readme
[issues]: https://github.com/martincostello/github-automation/issues "Issues for this project on GitHub.com"
[license]: http://www.apache.org/licenses/LICENSE-2.0.txt "The Apache 2.0 license"
[nuget-packages-published]: ./.github/workflows/nuget-packages-published.yml
[onboarding]: ./docs/onboarding.md
[rebase]: ./.github/workflows/rebase.yml
[rebase-pull-request]: ./.github/workflows/rebase-pull-request.yml
[rebaser]: https://github.com/martincostello/rebaser
[repository]: https://github.com/martincostello/github-automation "This project on GitHub.com"
[update-dotnet-sdk]: https://github.com/martincostello/update-dotnet-sdk/blob/main/.github/workflows/update-dotnet-sdk.yml
[update-dotnet-sdk-schema]: ./.github/update-dotnet-sdk-schema.json
[update-dotnet-sdks]: ./.github/workflows/update-dotnet-sdks.yml
[update-dotnet-sdks-for-nightly]: ./.github/workflows/update-dotnet-sdks-for-nightly.yml
[update-github-dependencies]: ./.github/workflows/update-github-dependencies.yml
[update-static-assets]: ./.github/workflows/update-static-assets.yml
[upgrade-report-gist]: https://gist.github.com/martincostello/2083bcc83f30a5038175e4f31e0fc59f
