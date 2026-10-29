/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { CustomFieldService } from "@/services/custom-field.service";
import type { TCustomFieldValue } from "@/services/custom-field.service";

const customFieldService = new CustomFieldService();

export const useCustomFields = (workspaceSlug: string, projectId: string) => {
  const { data, mutate, isLoading } = useSWR(["custom-fields", workspaceSlug, projectId], () =>
    customFieldService.list(workspaceSlug, projectId)
  );
  return { fields: data ?? [], isLoading, mutate, service: customFieldService };
};

export const useIssueCustomFieldValues = (workspaceSlug: string, projectId: string, issueId: string) => {
  const { data, mutate } = useSWR(["custom-field-values", workspaceSlug, projectId, issueId], () =>
    customFieldService.listValues(workspaceSlug, projectId, issueId)
  );
  const values = data ?? [];
  const setValue = async (fieldId: string, value: TCustomFieldValue["value"]) => {
    const saved = await customFieldService.setValue(workspaceSlug, projectId, issueId, fieldId, value);
    await mutate((current) => [...(current ?? []).filter((v) => v.field_id !== fieldId), saved], { revalidate: false });
  };
  return { values, setValue };
};
