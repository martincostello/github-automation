# Onboarding

## Introduction

This repository contains a set of GitHub Actions workflows that can be used to
automate common tasks in GitHub repositories. These are based on workflows that
I have found useful for the purposes of patching and orchestration of the same
updates across dozens of repositories.

The workflows are built around a number of conventions on approaches that I have
applied to these repositories to make them homogenous. Following similar patterns
in your repositories will make it easier to apply the same workflows to them.

You can of course change these conventions to suit your own needs, but you will
need to update the workflows to match any differences you may have or wish to apply.

## Workflows

### Rebase Branch

The `rebase` workflow relies on the following conventions:

1. The GitHub Personal Access Token (PAT) stored in the secret with the name `ACCESS_TOKEN` has push access to the configured repositories.
1. The default branch of each repository is `main`.
1. The branch being rebased allows being force pushed to by the user/bot associated with the GitHub PAT.

### Update .NET SDKs

The `update-dotnet-sdks` workflow relies on the following conventions:

1. The GitHub Personal Access Token (PAT) used by the workflow has push access to the configured repositories and can create pull requests.
1. The default branch of each repository is `main`.
1. Each repository contains a `global.json` file in the root of the repository for the branch being updated.
