/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
// components
import { PageHead } from "@/components/core/page-title";
import { ChatRoot } from "@/components/chat/root";

export default function WorkspaceChatPage() {
  const { workspaceSlug } = useParams();

  if (!workspaceSlug) return null;

  return (
    <>
      <PageHead title="Chat" />
      <div className="relative h-full w-full overflow-hidden">
        <ChatRoot workspaceSlug={workspaceSlug.toString()} />
      </div>
    </>
  );
}
