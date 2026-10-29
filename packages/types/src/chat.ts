/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IUserLite } from "./users";

export type TChatMessage = {
  id: string;
  workspace: string;
  message: string;
  created_by: string;
  created_by_detail: IUserLite;
  created_at: string;
};
