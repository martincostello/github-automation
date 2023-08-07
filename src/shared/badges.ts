// Copyright (c) Martin Costello, 2023. All rights reserved.
// Licensed under the Apache 2.0 license. See the LICENSE file in the project root for full license information.

function formatSlug(value: string): string {
  return value.replace('-', '--').replace('_', '__').replace(' ', '_');
}

export function getBadge(label: string, message: string, color: string, logo: 'dotnet' | 'git' | 'github'): string {
  label = formatSlug(label);
  message = formatSlug(message);
  return `https://img.shields.io/badge/${label}-${message}-${color}?logo=${logo}`;
}
