/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// helpers
import { API_BASE_URL } from "@plane/constants";
import type { TChatMessage } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class ChatService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getChatMessages(workspaceSlug: string): Promise<{ results: TChatMessage[]; count: number }> {
    return this.get(`/api/workspaces/${workspaceSlug}/chat-messages/`, { params: { per_page: 50 } })
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }

  async createChatMessage(workspaceSlug: string, message: string): Promise<TChatMessage> {
    return this.post(`/api/workspaces/${workspaceSlug}/chat-messages/`, { message })
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }

  async deleteChatMessage(workspaceSlug: string, id: string) {
    return this.delete(`/api/workspaces/${workspaceSlug}/chat-messages/${id}/`)
      .then((res) => res?.data)
      .catch((err) => {
        throw err?.response?.data;
      });
  }
}
