# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Setjoo custom fields: admins define fields, members set typed values on work items."""

import pytest
from rest_framework import status

from plane.db.models import CustomField, Issue, IssueCustomFieldValue, Project, ProjectMember, State


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="CF Project", identifier="CFP", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def issue(db, workspace, project):
    state = State.objects.create(name="Todo", project=project, workspace=workspace, group="backlog", default=True)
    return Issue.objects.create(name="Task", workspace=workspace, project=project, state=state)


def fields_url(ws, project):
    return f"/api/workspaces/{ws.slug}/projects/{project.id}/custom-fields/"


def value_url(ws, project, issue, field_id):
    return f"/api/workspaces/{ws.slug}/projects/{project.id}/issues/{issue.id}/custom-field-values/{field_id}/"


@pytest.mark.contract
class TestCustomFields:
    @pytest.mark.django_db
    def test_field_lifecycle_and_values(self, session_client, workspace, project, issue, create_user):
        res = session_client.post(fields_url(workspace, project), {"name": "Budget", "field_type": "number"}, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        budget = res.data["id"]

        res = session_client.post(
            fields_url(workspace, project),
            {"name": "Stage", "field_type": "dropdown", "options": ["Lead", "Won"]},
            format="json",
        )
        assert res.status_code == status.HTTP_201_CREATED
        stage = res.data["id"]

        # Duplicate names and option-less dropdowns are refused
        dup = session_client.post(fields_url(workspace, project), {"name": "Budget", "field_type": "text"}, format="json")
        assert dup.status_code == status.HTTP_400_BAD_REQUEST
        empty = session_client.post(fields_url(workspace, project), {"name": "X", "field_type": "dropdown"}, format="json")
        assert empty.status_code == status.HTTP_400_BAD_REQUEST

        # Typed values
        assert session_client.put(value_url(workspace, project, issue, budget), {"value": 1200}, format="json").status_code == 200
        assert session_client.put(value_url(workspace, project, issue, budget), {"value": "lots"}, format="json").status_code == 400
        assert session_client.put(value_url(workspace, project, issue, stage), {"value": "Won"}, format="json").status_code == 200
        assert session_client.put(value_url(workspace, project, issue, stage), {"value": "Lost"}, format="json").status_code == 400

        res = session_client.get(f"/api/workspaces/{workspace.slug}/projects/{project.id}/custom-field-values/")
        assert res.status_code == 200
        assert {(str(v["field_id"]), v["value"]) for v in res.data} == {(budget, 1200), (stage, "Won")}

        # Removing an option clears work items that had it
        res = session_client.patch(f"{fields_url(workspace, project)}{stage}/", {"options": ["Lead"]}, format="json")
        assert res.status_code == 200
        assert not IssueCustomFieldValue.objects.filter(field_id=stage).exists()

        # The type can't change; null clears a value; delete removes the field
        res = session_client.patch(f"{fields_url(workspace, project)}{budget}/", {"field_type": "text"}, format="json")
        assert res.status_code == 400
        assert session_client.put(value_url(workspace, project, issue, budget), {"value": None}, format="json").status_code == 200
        assert not IssueCustomFieldValue.objects.filter(field_id=budget).exists()
        assert session_client.delete(f"{fields_url(workspace, project)}{budget}/").status_code == 204
        assert not CustomField.objects.filter(id=budget).exists()

    @pytest.mark.django_db
    def test_people_must_be_project_members(self, session_client, workspace, project, issue, create_user):
        res = session_client.post(fields_url(workspace, project), {"name": "Reviewer", "field_type": "people"}, format="json")
        people = res.data["id"]
        ok = session_client.put(value_url(workspace, project, issue, people), {"value": [str(create_user.id)]}, format="json")
        assert ok.status_code == 200
        bad = session_client.put(
            value_url(workspace, project, issue, people),
            {"value": ["00000000-0000-0000-0000-000000000000"]},
            format="json",
        )
        assert bad.status_code == 400
