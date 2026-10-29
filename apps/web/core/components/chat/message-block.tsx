/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { X } from "lucide-react";
import type { TChatMessage } from "@plane/types";
import { Avatar, Tooltip } from "@plane/ui";
import { calculateTimeAgo, getFileURL } from "@plane/utils";

type TChatMessageBlock = {
  message: TChatMessage;
  canDelete: boolean;
  onDelete: () => void;
};

export const ChatMessageBlock = observer(function ChatMessageBlock(props: TChatMessageBlock) {
  const { message, canDelete, onDelete } = props;

  return (
    <div className="group relative flex gap-3 px-4 py-2 hover:bg-surface-2">
      <Avatar
        src={getFileURL(message.created_by_detail?.avatar_url ?? "")}
        name={message.created_by_detail?.display_name}
        size={28}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-body-sm-medium text-primary">{message.created_by_detail?.display_name}</span>
          <Tooltip tooltipContent={new Date(message.created_at).toLocaleString()}>
            <span className="text-caption-sm text-tertiary">{calculateTimeAgo(message.created_at)}</span>
          </Tooltip>
        </div>
        <p className="whitespace-pre-wrap break-words text-body-sm-regular text-primary">{message.message}</p>
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-2 right-2 hidden rounded p-1 text-tertiary hover:bg-surface-3 hover:text-primary group-hover:block"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
});
