# GitHub Automation

GitHub automation for my repositories.

## Workflows

The following workflows are available.

| **Workflow**                           | **Description**                                                        |
| :------------------------------------- | :--------------------------------------------------------------------- |
| [Rebase Branch][rebase-branch]         | Rebases a branch of the configured repositories onto `main`.           |
| [Update .NET SDKs][update-dotnet-sdks] | Runs the `update-dotnet-sdk` workflow for the configured repositories. |

### Rebase Branch

The [`rebase-branch`][rebase-branch] workflow rebases a branch of the
configured repositories onto the default branch of the repository.

The [Rebaser][rebaser] tool is used to rebase the branch with
[libgit2sharp][libgit2sharp]. Rebaser will attempt to resolve
conflicts for versions of the .NET SDK, NuGet packages and npm
packages automatically by always preferring the highest version
number.

If the conflicts in a rebase cannot be automatically resolved,
then it will be aborted and it will need to be manually dealt with.

To manually resolve the conflicts, you can checkout this repository
locally and run the following commands to interatively rebase the
branch using Rebaser and Visual Studio Code.

```powershell
# First checkout the repository you wish to rebase locally, and then checkout
# the branch you wish to rebase and ensure it is in sync with the remote.

$repositoryPath = "my-repository"

# The default branch parameter is optional and defaults to "main".
$defaultBranch = "main"

# Clone this repository to build and run the Rebaser tool.
git clone https://github.com/martincostello/github-automation
cd ../github-automation

# Run rebaser interactively.
dotnet run --project ./src/Rebaser/Rebaser.csproj -- $repositoryPath $defaultBranch --interactive

# Rebaser will open Visual Studio Code for each file that needs a merge
# conflict to be resolved. Once you have resolved the conflicts, save the
# file and close Visual Studio Code. Rebaser will then continue the rebase.

# Assuming you are happy with the results of the rebase,
# you can then force push the changes to your remote to finish.
# If you don't like the results, then you can reset the branch.
```

### Update .NET SDK

The [`update-dotnet-sdks`][update-dotnet-sdks] workflow creates
a manual workflow dispatch for the `update-dotnet-sdk` workflow
on the specified branch for each of the configured respositories.

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

[issues]: https://github.com/martincostello/github-automation/issues "Issues for this project on GitHub.com"
[libgit2sharp]: https://github.com/libgit2/libgit2sharp#readme
[license]: http://www.apache.org/licenses/LICENSE-2.0.txt "The Apache 2.0 license"
[onboarding]: ./docs/onboarding.md
[rebase-branch]: ./.github/workflows/rebase.yml
[rebaser]: ./src/Rebaser/Program.cs
[repository]: https://github.com/martincostello/github-automation "This project on GitHub.com"
[update-dotnet-sdks]: .github/workflows/update-dotnet-sdks.yml
