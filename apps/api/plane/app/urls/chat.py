# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import WorkspaceChatMessageViewSet

urlpatterns = [
    path(
        "workspaces/<str:slug>/chat-messages/",
        WorkspaceChatMessageViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-chat-messages",
    ),
    path(
        "workspaces/<str:slug>/chat-messages/<uuid:pk>/",
        WorkspaceChatMessageViewSet.as_view({"delete": "destroy"}),
        name="workspace-chat-messages",
    ),
]
