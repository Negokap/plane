# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.db.models import CustomField, CustomFieldType

from .base import BaseSerializer


class CustomFieldSerializer(BaseSerializer):
    class Meta:
        model = CustomField
        fields = ["id", "project", "name", "field_type", "options", "sort_order", "created_at"]
        read_only_fields = ["id", "project", "created_at"]

    def validate_options(self, options):
        if not isinstance(options, list) or not all(isinstance(o, str) and o.strip() for o in options):
            raise serializers.ValidationError("Options must be a list of non-empty strings")
        cleaned = [o.strip()[:255] for o in options]
        if len(set(cleaned)) != len(cleaned):
            raise serializers.ValidationError("Options must be unique")
        return cleaned

    def validate(self, attrs):
        # The type is fixed after creation: stored values would no longer match it.
        if self.instance and "field_type" in attrs and attrs["field_type"] != self.instance.field_type:
            raise serializers.ValidationError({"field_type": "The type of a field can't be changed"})
        field_type = attrs.get("field_type", self.instance.field_type if self.instance else CustomFieldType.TEXT)
        if field_type == CustomFieldType.DROPDOWN and not attrs.get(
            "options", self.instance.options if self.instance else []
        ):
            raise serializers.ValidationError({"options": "A dropdown needs at least one option"})
        return attrs
