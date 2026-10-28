/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "../type";

// Setjoo whitelabel: full wordmark lockup, shown on auth/onboarding
// screens. See WHITELABEL.md.
export function PlaneLockup({ width = "253", className }: ISvgIcons) {
  return <img src="/setjoo-logo.png" alt="Setjoo" width={width} className={className} />;
}
