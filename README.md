# GitHub Automation

GitHub automation for my repositories.

## Workflows

The following workflows are available.

| **Workflow**                                                     | **Description**                                                                                   |
| :--------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| [dotnet-dependencies-updated][dotnet-dependencies-updated]       | Runs the `rebase` workflow for a repository when its dependencies are determined to have changed. |
| [dotnet-release][dotnet-release]                                 | Runs every 15 minutes to check for new official releases of the .NET SDK.                         |
| [dotnet-upgrade-report][dotnet-upgrade-report]                   | Runs daily to produce a report for a specified branch used for testing .NET vNext.                |
| [dotnet-version-report][dotnet-version-report]                   | Generates a report of the .NET SDK versions used by the default branch of my repositories.        |
| [issue-metrics][issue-metrics]                                   | Runs monthly to generate a report of metrics for issues and pull requests for my repositories.    |
| [rebase][rebase]                                                 | Rebases a branch of one or more repositories onto a specified base branch.                        |
| [update-dotnet-sdks][update-dotnet-sdks]                         | Runs the `update-dotnet-sdk` workflow for the configured repositories for a specified branch.     |
| [update-dotnet-sdks-for-nightly][update-dotnet-sdks-for-nightly] | Runs the `update-dotnet-sdks` workflow daily for the `dotnet-nightly` branch.                     |

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
generates a markdown report that finds all of the repositories in the configured
owner and shows which .NET SDK versions are used by the default branch of each of
the repositories and whether that version is the latest official release.

### Issue Metrics

The [issue-metrics][issue-metrics] workflow runs monthly and generates a markdown
report about the issues and pull requests for the repositories for the configured
owner using the [github/issue-metrics][issue-metrics-action] action.

### Rebase

The [rebase][rebase] workflow rebases a branch of the
configured repositories onto the default branch of the repository.

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

# Clone this repository to build and run the Rebaser tool.
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

The [update-dotnet-sdks][update-dotnet-sdks] workflow creates
a manual workflow dispatch for the `update-dotnet-sdk` workflow
on the specified branch for each of the configured respositories.

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

[costellobot]: https://github.com/martincostello/costellobot
[dotnet-core]: https://github.com/dotnet/core
[dotnet-dependencies-updated]: ./.github/workflows/dotnet-dependencies-updated.yml
[dotnet-release]: ./.github/workflows/dotnet-release.yml
[dotnet-upgrade-report]: ./.github/workflows/dotnet-upgrade-report.yml
[dotnet-version-report]: ./.github/workflows/dotnet-version-report.yml
[issue-metrics]: ./.github/workflows/issue-metrics.yml
[issue-metrics-action]: https://github.com/github/issue-metrics#readme
[issues]: https://github.com/martincostello/github-automation/issues "Issues for this project on GitHub.com"
[license]: http://www.apache.org/licenses/LICENSE-2.0.txt "The Apache 2.0 license"
[onboarding]: ./docs/onboarding.md
[rebase]: ./.github/workflows/rebase.yml
[rebaser]: https://github.com/martincostello/rebaser
[repository]: https://github.com/martincostello/github-automation "This project on GitHub.com"
[update-dotnet-sdks]: ./.github/workflows/update-dotnet-sdks.yml
[update-dotnet-sdks-for-nightly]: ./.github/workflows/update-dotnet-sdks-for-nightly.yml
[upgrade-report-gist]: https://gist.github.com/martincostello/2083bcc83f30a5038175e4f31e0fc59f
