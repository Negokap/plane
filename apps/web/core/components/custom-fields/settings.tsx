/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { AlertModalCore, CustomSelect, Input } from "@plane/ui";
// components
import { SettingsHeading } from "@/components/settings/heading";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
// services
import type { TCustomField, TCustomFieldType } from "@/services/custom-field.service";
// local imports
import { useCustomFields } from "./hooks";

const FIELD_TYPE_LABELS: Record<TCustomFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  url: "URL",
  people: "People",
};
const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as TCustomFieldType[];

const showError = (error: unknown) => {
  const data = error as Record<string, unknown> | undefined;
  const message = Object.values(data ?? {})
    .map((v) => (Array.isArray(v) ? v.join(" ") : String(v)))
    .join(" ");
  setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: message || "Something went wrong. Please try again." });
};

type TEditorProps = {
  field?: TCustomField;
  onSubmit: (data: { name: string; field_type: TCustomFieldType; options: string[] }) => Promise<void>;
  onCancel: () => void;
};

function CustomFieldEditor(props: TEditorProps) {
  const { field, onSubmit, onCancel } = props;
  const [name, setName] = useState(field?.name ?? "");
  const [fieldType, setFieldType] = useState<TCustomFieldType>(field?.field_type ?? "text");
  // one option per line
  const [optionsText, setOptionsText] = useState((field?.options ?? []).join("\n"));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const options = optionsText
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
  const isValid = name.trim().length > 0 && (fieldType !== "dropdown" || options.length > 0);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await onSubmit({ name: name.trim(), field_type: fieldType, options: fieldType === "dropdown" ? options : [] })
      .catch(showError)
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-subtle bg-layer-1 p-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Field name"
          autoFocus
          className="w-full"
        />
        {/* the type is fixed once the field exists */}
        <CustomSelect
          value={fieldType}
          label={FIELD_TYPE_LABELS[fieldType]}
          onChange={(val: TCustomFieldType) => setFieldType(val)}
          disabled={Boolean(field)}
          buttonClassName="border border-subtle"
        >
          {FIELD_TYPES.map((type) => (
            <CustomSelect.Option key={type} value={type}>
              {FIELD_TYPE_LABELS[type]}
            </CustomSelect.Option>
          ))}
        </CustomSelect>
      </div>
      {fieldType === "dropdown" && (
        <div className="flex flex-col gap-1">
          <span className="text-body-xs-regular text-tertiary">Options (one per line)</span>
          <textarea
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-subtle bg-surface-1 p-2 text-body-xs-regular text-primary outline-none"
          />
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!isValid || isSubmitting}>
          {isSubmitting ? "Saving" : "Save"}
        </Button>
      </div>
    </div>
  );
}

type Props = {
  workspaceSlug: string;
  projectId: string;
};

export const ProjectCustomFieldsSettings = observer(function ProjectCustomFieldsSettings(props: Props) {
  const { workspaceSlug, projectId } = props;
  // states
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldToDelete, setFieldToDelete] = useState<TCustomField | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // store hooks
  const { allowPermissions } = useUserPermissions();
  const { fields, mutate, service } = useCustomFields(workspaceSlug, projectId);
  // derived values
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);

  const handleDelete = async () => {
    if (!fieldToDelete) return;
    setIsDeleting(true);
    await service
      .remove(workspaceSlug, projectId, fieldToDelete.id)
      .then(async () => {
        await mutate();
        setFieldToDelete(null);
      })
      .catch(showError)
      .finally(() => setIsDeleting(false));
  };

  return (
    <div className="w-full">
      <SettingsHeading
        title="Custom fields"
        description="Add your own properties to every work item in this project."
        control={
          isAdmin ? (
            <Button variant="primary" size="lg" onClick={() => setIsCreating(true)}>
              Add custom field
            </Button>
          ) : undefined
        }
      />
      <div className="mt-6 flex w-full flex-col gap-3">
        {isCreating && (
          <CustomFieldEditor
            onCancel={() => setIsCreating(false)}
            onSubmit={async (data) => {
              await service.create(workspaceSlug, projectId, data);
              await mutate();
              setIsCreating(false);
            }}
          />
        )}
        {fields.length === 0 && !isCreating && <p className="text-body-xs-regular text-tertiary">No custom fields yet.</p>}
        {fields.map((field) =>
          editingId === field.id ? (
            <CustomFieldEditor
              key={field.id}
              field={field}
              onCancel={() => setEditingId(null)}
              onSubmit={async ({ name, options }) => {
                await service.update(workspaceSlug, projectId, field.id, {
                  name,
                  ...(field.field_type === "dropdown" ? { options } : {}),
                });
                await mutate();
                setEditingId(null);
              }}
            />
          ) : (
            <div
              key={field.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-subtle bg-layer-1 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-body-sm-medium text-primary">{field.name}</span>
                <span className="truncate text-body-xs-regular text-tertiary">
                  {FIELD_TYPE_LABELS[field.field_type]}
                  {field.field_type === "dropdown" && `: ${field.options.join(", ")}`}
                </span>
              </div>
              {isAdmin && (
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="secondary" onClick={() => setEditingId(field.id)}>
                    Edit
                  </Button>
                  <Button variant="error-outline" onClick={() => setFieldToDelete(field)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )
        )}
      </div>
      <AlertModalCore
        handleClose={() => setFieldToDelete(null)}
        handleSubmit={handleDelete}
        isSubmitting={isDeleting}
        isOpen={Boolean(fieldToDelete)}
        title="Delete custom field"
        content={
          <>
            Are you sure you want to delete <span className="font-medium text-primary">{fieldToDelete?.name}</span>?
            Its values on every work item will be removed.
          </>
        }
      />
    </div>
  );
});
