/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { Loader } from "@plane/ui";
// hooks
import { useChat } from "@/hooks/store/use-chat";
import { useUser } from "@/hooks/store/user";
// components
import { ChatMessageBlock } from "./message-block";
import { ChatMessageCreate } from "./message-create";

const POLL_INTERVAL = 5000;

type TChatRoot = {
  workspaceSlug: string;
};

export const ChatRoot = observer(function ChatRoot(props: TChatRoot) {
  const { workspaceSlug } = props;
  // hooks
  const { loader, workspaceMessageIds, messages, fetchMessages, createMessage, deleteMessage } = useChat();
  const { data: currentUser } = useUser();
  // refs
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workspaceSlug) return;
    void fetchMessages(workspaceSlug);
    const interval = setInterval(() => {
      void fetchMessages(workspaceSlug);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [workspaceSlug, fetchMessages]);

  const messageIds = workspaceMessageIds[workspaceSlug] ?? [];

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "end" });
  }, [messageIds.length]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {loader === "init-loader" ? (
          <div className="space-y-4 p-4">
            <Loader>
              <Loader.Item height="40px" />
              <Loader.Item height="40px" />
              <Loader.Item height="40px" />
            </Loader>
          </div>
        ) : messageIds.length === 0 ? (
          <div className="flex h-full items-center justify-center text-body-sm-regular text-tertiary">
            No messages yet. Say hello.
          </div>
        ) : (
          <div className="flex flex-col py-2">
            {messageIds.map((messageId) => {
              const message = messages[messageId];
              if (!message) return null;
              return (
                <ChatMessageBlock
                  key={message.id}
                  message={message}
                  canDelete={message.created_by === currentUser?.id}
                  onDelete={() => void deleteMessage(workspaceSlug, message.id)}
                />
              );
            })}
            <div ref={listEndRef} />
          </div>
        )}
      </div>
      <ChatMessageCreate onSubmit={(message) => createMessage(workspaceSlug, message)} />
    </div>
  );
});
