/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "../type";

// Setjoo whitelabel: no dedicated compact icon mark exists in the brand
// pack (brand/wordmarks/ only has the full "Setjoo" wordmark), so the
// same wordmark image is reused here at a smaller rendered size rather
// than vectorizing one. See WHITELABEL.md.
export function PlaneLogo({ width = "85", height: _height, className }: ISvgIcons) {
  return <img src="/setjoo-logo.png" alt="Setjoo" width={width} className={className} />;
}
