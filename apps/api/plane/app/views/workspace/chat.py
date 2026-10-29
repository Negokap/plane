# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework.response import Response
from rest_framework import status

# Module imports
from plane.app.views.base import BaseViewSet
from plane.app.permissions import ROLE, allow_permission
from plane.db.models import ChatMessage, Workspace
from plane.app.serializers import ChatMessageSerializer


class WorkspaceChatMessageViewSet(BaseViewSet):
    """A single shared message stream per workspace. Every active member
    (including guests) can read; posting is limited to admins/members,
    matching the in-house Setjoo Projects chat this replaces. No edit —
    messages are post-and-done; only the author (or workspace admin via
    destroy's own role check) can delete their own message."""

    serializer_class = ChatMessageSerializer
    model = ChatMessage
    use_read_replica = True

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .select_related("workspace", "created_by")
            .distinct()
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def create(self, request, slug):
        message = request.data.get("message", "").strip()
        if not message:
            return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)

        workspace = Workspace.objects.get(slug=slug)
        serializer = ChatMessageSerializer(data={"message": message})
        if serializer.is_valid():
            # created_by is auto-set from the current request's user by
            # BaseModel.save() (via crum) - no need to pass it explicitly.
            serializer.save(workspace_id=workspace.id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def list(self, request, slug):
        messages = self.get_queryset().order_by("created_at")
        return self.paginate(
            request=request,
            queryset=messages,
            on_results=lambda messages: ChatMessageSerializer(messages, many=True).data,
            default_per_page=50,
        )

    @allow_permission(allowed_roles=[ROLE.ADMIN], creator=True, model=ChatMessage, level="WORKSPACE")
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)
