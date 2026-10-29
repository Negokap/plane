# Setjoo: ClickUp-style custom fields on work items.

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def base_fields():
    return [
        ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
        ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
        ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
        (
            "id",
            models.UUIDField(
                db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True
            ),
        ),
        (
            "created_by",
            models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="%(class)s_created_by",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Created By",
            ),
        ),
        (
            "updated_by",
            models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="%(class)s_updated_by",
                to=settings.AUTH_USER_MODEL,
                verbose_name="Last Modified By",
            ),
        ),
        (
            "project",
            models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name="project_%(class)s", to="db.project"
            ),
        ),
        (
            "workspace",
            models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name="workspace_%(class)s", to="db.workspace"
            ),
        ),
    ]


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("db", "0124_setjoo_enable_project_features"),
    ]

    operations = [
        migrations.CreateModel(
            name="CustomField",
            fields=[
                *base_fields(),
                ("name", models.CharField(max_length=255)),
                (
                    "field_type",
                    models.CharField(
                        choices=[
                            ("text", "Text"),
                            ("number", "Number"),
                            ("date", "Date"),
                            ("dropdown", "Dropdown"),
                            ("checkbox", "Checkbox"),
                            ("url", "URL"),
                            ("people", "People"),
                        ],
                        default="text",
                        max_length=32,
                    ),
                ),
                ("options", models.JSONField(blank=True, default=list)),
                ("sort_order", models.FloatField(default=65535)),
            ],
            options={
                "verbose_name": "Custom Field",
                "verbose_name_plural": "Custom Fields",
                "db_table": "custom_fields",
                "ordering": ("sort_order", "created_at"),
                "unique_together": {("name", "project", "deleted_at")},
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("deleted_at__isnull", True)),
                        fields=("name", "project"),
                        name="custom_field_unique_name_project_when_deleted_at_null",
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="IssueCustomFieldValue",
            fields=[
                *base_fields(),
                ("value", models.JSONField(null=True)),
                (
                    "field",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="values", to="db.customfield"
                    ),
                ),
                (
                    "issue",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="custom_field_values",
                        to="db.issue",
                    ),
                ),
            ],
            options={
                "verbose_name": "Issue Custom Field Value",
                "verbose_name_plural": "Issue Custom Field Values",
                "db_table": "issue_custom_field_values",
                "unique_together": {("issue", "field", "deleted_at")},
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("deleted_at__isnull", True)),
                        fields=("issue", "field"),
                        name="issue_custom_field_value_unique_when_deleted_at_null",
                    )
                ],
            },
        ),
    ]
