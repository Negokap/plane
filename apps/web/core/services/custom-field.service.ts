/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type TCustomFieldType = "text" | "number" | "date" | "dropdown" | "checkbox" | "url" | "people";

export type TCustomField = {
  id: string;
  project: string;
  name: string;
  field_type: TCustomFieldType;
  options: string[];
  sort_order: number;
  created_at: string;
};

export type TCustomFieldValue = {
  issue_id: string;
  field_id: string;
  value: string | number | boolean | string[] | null;
};

export type TCustomFieldCreate = { name: string; field_type: TCustomFieldType; options?: string[] };
export type TCustomFieldUpdate = Partial<Pick<TCustomField, "name" | "options" | "sort_order">>;

export class CustomFieldService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async list(workspaceSlug: string, projectId: string): Promise<TCustomField[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async create(workspaceSlug: string, projectId: string, data: TCustomFieldCreate): Promise<TCustomField> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    fieldId: string,
    data: TCustomFieldUpdate
  ): Promise<TCustomField> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/${fieldId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async remove(workspaceSlug: string, projectId: string, fieldId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/${fieldId}/`)
      .then(() => undefined)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async listValues(workspaceSlug: string, projectId: string, issueId?: string): Promise<TCustomFieldValue[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-field-values/`, {
      params: issueId ? { issue: issueId } : {},
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async setValue(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    fieldId: string,
    value: TCustomFieldValue["value"]
  ): Promise<TCustomFieldValue> {
    return this.put(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/custom-field-values/${fieldId}/`,
      { value }
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
