// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

// Update the schema in .github\update-dotnet-sdk-schema.json if this type changes
export type UpdateDotNetSdkConfig = {
  'ignore'?: boolean | undefined;
  'exclude-nuget-packages'?: string | undefined;
  'include-nuget-packages'?: string | undefined;
  'update-nuget-packages'?: boolean | undefined;
};

export type WorkflowConfig = {
  checksOfInterest: string[];
};
