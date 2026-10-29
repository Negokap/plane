# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import CustomFieldViewSet, IssueCustomFieldValueEndpoint

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/custom-fields/",
        CustomFieldViewSet.as_view({"get": "list", "post": "create"}),
        name="project-custom-fields",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/custom-fields/<uuid:pk>/",
        CustomFieldViewSet.as_view({"patch": "partial_update", "delete": "destroy"}),
        name="project-custom-fields",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/custom-field-values/",
        IssueCustomFieldValueEndpoint.as_view(),
        name="project-custom-field-values",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/custom-field-values/<uuid:field_id>/",
        IssueCustomFieldValueEndpoint.as_view(),
        name="issue-custom-field-value",
    ),
]
