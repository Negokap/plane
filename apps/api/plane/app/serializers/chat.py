# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from plane.db.models import ChatMessage

from .base import BaseSerializer
from .user import UserLiteSerializer


class ChatMessageSerializer(BaseSerializer):
    created_by_detail = UserLiteSerializer(source="created_by", read_only=True)

    class Meta:
        model = ChatMessage
        fields = ["id", "workspace", "message", "created_by", "created_by_detail", "created_at"]
        read_only_fields = ["id", "workspace", "created_by", "created_by_detail", "created_at"]
