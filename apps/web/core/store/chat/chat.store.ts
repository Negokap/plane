/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observable, action, makeObservable, runInAction } from "mobx";
import type { TChatMessage, TLoader } from "@plane/types";
import { ChatService } from "@/services/chat.service";

export interface IChatStore {
  loader: TLoader;
  sendingMessage: boolean;
  workspaceMessageIds: Record<string, string[]>; // workspaceSlug -> messageIds, oldest first
  messages: Record<string, TChatMessage>; // messageId -> message
  // actions
  fetchMessages: (workspaceSlug: string) => Promise<void>;
  createMessage: (workspaceSlug: string, message: string) => Promise<void>;
  deleteMessage: (workspaceSlug: string, id: string) => Promise<void>;
}

export class ChatStore implements IChatStore {
  loader: TLoader = "init-loader";
  sendingMessage = false;
  workspaceMessageIds: Record<string, string[]> = {};
  messages: Record<string, TChatMessage> = {};

  // services
  chatService;

  constructor() {
    makeObservable(this, {
      loader: observable,
      sendingMessage: observable,
      workspaceMessageIds: observable,
      messages: observable,
      fetchMessages: action,
      createMessage: action,
      deleteMessage: action,
    });
    this.chatService = new ChatService();
  }

  fetchMessages = async (workspaceSlug: string) => {
    try {
      this.loader = this.workspaceMessageIds[workspaceSlug] ? "mutation" : "init-loader";
      const response = await this.chatService.getChatMessages(workspaceSlug);
      runInAction(() => {
        response.results.forEach((message) => {
          this.messages[message.id] = message;
        });
        this.workspaceMessageIds[workspaceSlug] = response.results.map((message) => message.id);
        this.loader = "loaded";
      });
    } catch (e) {
      console.error(e);
      runInAction(() => {
        this.loader = "loaded";
      });
    }
  };

  createMessage = async (workspaceSlug: string, message: string) => {
    this.sendingMessage = true;
    try {
      const response = await this.chatService.createChatMessage(workspaceSlug, message);
      runInAction(() => {
        this.messages[response.id] = response;
        this.workspaceMessageIds[workspaceSlug] = [...(this.workspaceMessageIds[workspaceSlug] || []), response.id];
        this.sendingMessage = false;
      });
    } catch (e) {
      console.error(e);
      runInAction(() => {
        this.sendingMessage = false;
      });
      throw e;
    }
  };

  deleteMessage = async (workspaceSlug: string, id: string) => {
    const message = this.messages[id];
    if (!message) return;
    try {
      runInAction(() => {
        this.workspaceMessageIds[workspaceSlug] = (this.workspaceMessageIds[workspaceSlug] || []).filter(
          (messageId) => messageId !== id
        );
        delete this.messages[id];
      });
      await this.chatService.deleteChatMessage(workspaceSlug, id);
    } catch (e) {
      console.error(e);
      runInAction(() => {
        this.messages[id] = message;
        this.workspaceMessageIds[workspaceSlug] = [...(this.workspaceMessageIds[workspaceSlug] || []), id];
      });
    }
  };
}
