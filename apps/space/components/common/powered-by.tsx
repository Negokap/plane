/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

type TPoweredBy = {
  disabled?: boolean;
};

// Setjoo whitelabel: this is Setjoo's own deployment, not a third-party
// "powered by" attribution case. See WHITELABEL.md.
export function PoweredBy(_props: TPoweredBy) {
  return null;
}
