# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Setjoo: ClickUp-style custom fields on work items (Plane CE has none).
from django.db import models
from django.db.models import Q

from .project import ProjectBaseModel


class CustomFieldType(models.TextChoices):
    TEXT = "text", "Text"
    NUMBER = "number", "Number"
    DATE = "date", "Date"
    DROPDOWN = "dropdown", "Dropdown"
    CHECKBOX = "checkbox", "Checkbox"
    URL = "url", "URL"
    PEOPLE = "people", "People"


class CustomField(ProjectBaseModel):
    name = models.CharField(max_length=255)
    field_type = models.CharField(max_length=32, choices=CustomFieldType.choices, default=CustomFieldType.TEXT)
    # Dropdown choices, as a list of strings.
    options = models.JSONField(default=list, blank=True)
    sort_order = models.FloatField(default=65535)

    class Meta:
        unique_together = ["name", "project", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "project"],
                condition=Q(deleted_at__isnull=True),
                name="custom_field_unique_name_project_when_deleted_at_null",
            )
        ]
        verbose_name = "Custom Field"
        verbose_name_plural = "Custom Fields"
        db_table = "custom_fields"
        ordering = ("sort_order", "created_at")

    def __str__(self):
        return f"{self.name} <{self.project.name}>"


class IssueCustomFieldValue(ProjectBaseModel):
    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="custom_field_values")
    field = models.ForeignKey("db.CustomField", on_delete=models.CASCADE, related_name="values")
    value = models.JSONField(null=True)

    class Meta:
        unique_together = ["issue", "field", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["issue", "field"],
                condition=Q(deleted_at__isnull=True),
                name="issue_custom_field_value_unique_when_deleted_at_null",
            )
        ]
        verbose_name = "Issue Custom Field Value"
        verbose_name_plural = "Issue Custom Field Values"
        db_table = "issue_custom_field_values"

    def __str__(self):
        return f"{self.issue_id} {self.field.name}"
