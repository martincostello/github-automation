// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

export type SupportPhase = 'preview' | 'go-live' | 'active' | 'maintenance' | 'eol';

export interface ReleasesIndex {
  'releases-index': ReleaseChannel[];
}

export interface ReleaseChannel {
  'channel-version': string;
  'latest-release': string;
  'latest-release-date': string;
  'latest-runtime': string;
  'latest-sdk': string;
  'release-type': string;
  'support-phase': SupportPhase;
  'eol-date"': string;
  'lifecycle-policy"': string;
  'releases'?: Release[];
}

export interface Release {
  'release-date': string;
  'release-version': string;
  'security': boolean;
  'release-notes': string;
}

export function isPreview(release: ReleaseChannel): boolean {
  switch (release['support-phase']) {
    case 'go-live':
    case 'preview':
      return true;
    default:
      return false;
  }
}
