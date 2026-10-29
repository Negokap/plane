# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models

# Module imports
from .base import BaseModel


class ChatMessage(BaseModel):
    """A single shared message stream per workspace — not per-issue
    comments (see the issue comment models for that). Intentionally flat:
    no threads, reactions, or rich text. Author is BaseModel's own
    created_by, same convention every other model in this app uses."""

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="chat_messages")
    message = models.TextField()

    class Meta:
        verbose_name = "Chat Message"
        verbose_name_plural = "Chat Messages"
        db_table = "chat_messages"
        ordering = ("created_at",)
        indexes = [models.Index(fields=["workspace", "created_at"])]

    def __str__(self):
        return f"{self.created_by_id}: {self.message[:40]}"
