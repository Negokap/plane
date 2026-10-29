# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Setjoo: ClickUp-style custom fields. Project admins define fields; members set values on work items.
import datetime
from urllib.parse import urlparse

from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import CustomFieldSerializer
from plane.app.views.base import BaseAPIView, BaseViewSet
from plane.db.models import CustomField, CustomFieldType, Issue, IssueCustomFieldValue, ProjectMember


def clean_custom_field_value(field, value, member_ids):
    """Returns the value to store for `field`, None to clear it, or raises ValueError."""
    if value is None or value == "" or value == []:
        return None
    kind = field.field_type
    if kind == CustomFieldType.TEXT:
        if not isinstance(value, str) or len(value) > 5000:
            raise ValueError("Text must be a string of at most 5000 characters")
        return value
    if kind == CustomFieldType.NUMBER:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("Number expected")
        return value
    if kind == CustomFieldType.DATE:
        try:
            datetime.date.fromisoformat(value)
        except (TypeError, ValueError):
            raise ValueError("Date must be YYYY-MM-DD")
        return value
    if kind == CustomFieldType.DROPDOWN:
        if value not in field.options:
            raise ValueError("Not one of the field's options")
        return value
    if kind == CustomFieldType.CHECKBOX:
        if not isinstance(value, bool):
            raise ValueError("true or false expected")
        return value or None
    if kind == CustomFieldType.URL:
        if not isinstance(value, str) or urlparse(value).scheme not in ("http", "https") or len(value) > 2000:
            raise ValueError("URL must start with http:// or https://")
        return value
    if kind == CustomFieldType.PEOPLE:
        if not isinstance(value, list) or not all(str(v) in member_ids for v in value):
            raise ValueError("People must be members of the project")
        return list(dict.fromkeys(str(v) for v in value))
    raise ValueError("Unknown field type")


class CustomFieldViewSet(BaseViewSet):
    serializer_class = CustomFieldSerializer
    model = CustomField

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"), project_id=self.kwargs.get("project_id"))
            .order_by("sort_order", "created_at")
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def list(self, request, slug, project_id):
        return Response(CustomFieldSerializer(self.get_queryset(), many=True).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id):
        serializer = CustomFieldSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            # Savepoint, so a duplicate name doesn't poison the request's transaction.
            with transaction.atomic():
                serializer.save(project_id=project_id)
        except IntegrityError:
            return Response({"name": "A field with this name already exists"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, slug, project_id, pk):
        field = self.get_queryset().filter(pk=pk).first()
        if not field:
            return Response({"error": "Field not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = CustomFieldSerializer(field, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            with transaction.atomic():
                field = serializer.save()
        except IntegrityError:
            return Response({"name": "A field with this name already exists"}, status=status.HTTP_400_BAD_REQUEST)
        if field.field_type == CustomFieldType.DROPDOWN:
            # A removed option clears the work items that had it.
            stale = [v.id for v in IssueCustomFieldValue.objects.filter(field=field) if v.value not in field.options]
            IssueCustomFieldValue.objects.filter(id__in=stale).delete()
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, slug, project_id, pk):
        field = self.get_queryset().filter(pk=pk).first()
        if not field:
            return Response({"error": "Field not found"}, status=status.HTTP_404_NOT_FOUND)
        IssueCustomFieldValue.objects.filter(field=field).delete()
        field.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IssueCustomFieldValueEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        # shortcut: returns every value in the project (fine for Setjoo-sized projects); paginate if projects grow large.
        values = IssueCustomFieldValue.objects.filter(
            workspace__slug=slug, project_id=project_id, issue__deleted_at__isnull=True, field__deleted_at__isnull=True
        )
        if request.GET.get("issue"):
            values = values.filter(issue_id=request.GET["issue"])
        return Response(list(values.values("issue_id", "field_id", "value")), status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def put(self, request, slug, project_id, issue_id, field_id):
        field = CustomField.objects.filter(pk=field_id, project_id=project_id, workspace__slug=slug).first()
        issue = Issue.objects.filter(pk=issue_id, project_id=project_id, workspace__slug=slug).first()
        if not field or not issue:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        member_ids = set()
        if field.field_type == CustomFieldType.PEOPLE:
            member_ids = {
                str(m)
                for m in ProjectMember.objects.filter(project_id=project_id, is_active=True).values_list(
                    "member_id", flat=True
                )
            }
        try:
            value = clean_custom_field_value(field, request.data.get("value"), member_ids)
        except ValueError as e:
            return Response({"value": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if value is None:
            IssueCustomFieldValue.objects.filter(issue=issue, field=field).delete()
        else:
            IssueCustomFieldValue.objects.update_or_create(
                issue=issue, field=field, defaults={"value": value, "project_id": project_id}
            )
        return Response({"issue_id": issue.id, "field_id": field.id, "value": value}, status=status.HTTP_200_OK)
