// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

export type UpdateDotNetSdkConfig = {
  'include-nuget-packages': string | undefined;
  'update-nuget-packages': boolean | undefined;
};

export type WorkflowConfig = {
  'checksOfInterest': string[];
  'repositories': string[];
  'update-dotnet-sdks': Record<string, Record<string, UpdateDotNetSdkConfig>>;
};
