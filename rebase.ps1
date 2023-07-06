#! /usr/bin/env pwsh

#Requires -PSEdition Core
#Requires -Version 7

param(
    [Parameter(Mandatory = $true)][string] $RepoPath
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

dotnet run --project .\src\Rebaser\Rebaser.csproj -- $RepoPath --interactive
