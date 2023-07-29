#! /usr/bin/env pwsh

#Requires -PSEdition Core
#Requires -Version 7

param(
    [Parameter(Mandatory = $true)][string] $RepoPath,
    [Parameter(Mandatory = $false)][string] $BaseBranch = ""
)

$ErrorActionPreference = "Stop"

$arguments = @(
    "--project",
    ".\src\Rebaser\Rebaser.csproj",
    "--",
    $RepoPath
)

if (-Not [string]::IsNullOrWhiteSpace($BaseBranch)) {
    $arguments += $BaseBranch
}

$arguments += "--interactive"

dotnet run $arguments
