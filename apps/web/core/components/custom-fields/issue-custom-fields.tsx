/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { LabelPropertyIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CustomSelect } from "@plane/ui";
import { renderFormattedPayloadDate } from "@plane/utils";
// components
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { DateDropdown } from "@/components/dropdowns/date";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
// services
import type { TCustomField, TCustomFieldValue } from "@/services/custom-field.service";
// local imports
import { useCustomFields, useIssueCustomFieldValues } from "./hooks";

const INPUT_CLASSNAME =
  "h-7.5 w-full rounded-sm border-none bg-transparent px-2 text-body-xs-medium text-primary outline-none placeholder:text-placeholder hover:bg-layer-transparent-hover focus:bg-layer-transparent-hover disabled:cursor-not-allowed";

type TFieldEditorProps = {
  field: TCustomField;
  value: TCustomFieldValue["value"] | undefined;
  projectId: string;
  disabled: boolean;
  onChange: (value: TCustomFieldValue["value"]) => void;
};

function CustomFieldEditor(props: TFieldEditorProps) {
  const { field, value, projectId, disabled, onChange } = props;
  const fieldType = field.field_type;

  switch (fieldType) {
    case "text":
    case "url":
      return (
        <input
          key={String(value ?? "")}
          type={fieldType === "url" ? "url" : "text"}
          defaultValue={typeof value === "string" ? value : ""}
          placeholder={fieldType === "url" ? "https://" : "Add text"}
          disabled={disabled}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next !== (typeof value === "string" ? value : "")) onChange(next);
          }}
          className={INPUT_CLASSNAME}
        />
      );
    case "number":
      return (
        <input
          key={String(value ?? "")}
          type="number"
          defaultValue={typeof value === "number" ? value : ""}
          placeholder="Add number"
          disabled={disabled}
          onBlur={(e) => {
            const next = e.target.value === "" ? null : Number(e.target.value);
            if (next !== (typeof value === "number" ? value : null)) onChange(next);
          }}
          className={INPUT_CLASSNAME}
        />
      );
    case "date":
      return (
        <DateDropdown
          value={typeof value === "string" ? value : null}
          onChange={(val) => onChange((val && renderFormattedPayloadDate(val)) || null)}
          placeholder="Add date"
          buttonVariant="transparent-with-text"
          disabled={disabled}
          className="group w-full grow"
          buttonContainerClassName="w-full text-left h-7.5"
          buttonClassName={`text-body-xs-medium ${value ? "" : "text-placeholder"}`}
          hideIcon
          clearIconClassName="h-3 w-3 hidden group-hover:inline"
        />
      );
    case "dropdown":
      return (
        <CustomSelect
          value={typeof value === "string" ? value : ""}
          label={
            <span className={`text-body-xs-medium ${value ? "" : "text-placeholder"}`}>
              {typeof value === "string" && value ? value : "Select"}
            </span>
          }
          onChange={(val: string) => onChange(val)}
          disabled={disabled}
          className="w-full"
          buttonClassName="w-full border-none"
          maxHeight="lg"
        >
          <CustomSelect.Option value="">None</CustomSelect.Option>
          {field.options.map((option) => (
            <CustomSelect.Option key={option} value={option}>
              {option}
            </CustomSelect.Option>
          ))}
        </CustomSelect>
      );
    case "checkbox":
      return (
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mx-2 size-4"
        />
      );
    case "people":
      return (
        <MemberDropdown
          value={Array.isArray(value) ? value : []}
          onChange={(val) => onChange(val)}
          projectId={projectId}
          multiple
          placeholder="Add people"
          buttonVariant="transparent-with-text"
          disabled={disabled}
          className="group w-full grow"
          buttonContainerClassName="w-full text-left h-7.5"
          buttonClassName={`text-body-xs-medium ${Array.isArray(value) && value.length > 0 ? "" : "text-placeholder"}`}
          dropdownArrow
          dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
        />
      );
    default: {
      const _exhaustive: never = fieldType;
      return _exhaustive;
    }
  }
}

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
};

export const IssueCustomFields = observer(function IssueCustomFields(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled } = props;
  // hooks
  const { fields } = useCustomFields(workspaceSlug, projectId);
  const { values, setValue } = useIssueCustomFieldValues(workspaceSlug, projectId, issueId);

  if (fields.length === 0) return null;

  const handleChange = (fieldId: string, value: TCustomFieldValue["value"]) => {
    setValue(fieldId, value).catch((error) => {
      const message = Object.values((error as Record<string, unknown>) ?? {}).join(" ");
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: message || "Custom field could not be updated. Please try again.",
      });
    });
  };

  return (
    <div className="mt-6">
      <h6 className="text-body-xs-medium">Custom fields</h6>
      <div className={`mt-3 w-full space-y-3 ${disabled ? "opacity-60" : ""}`}>
        {fields.map((field) => (
          <SidebarPropertyListItem key={field.id} icon={LabelPropertyIcon} label={field.name}>
            <CustomFieldEditor
              field={field}
              value={values.find((v) => v.field_id === field.id)?.value}
              projectId={projectId}
              disabled={disabled}
              onChange={(value) => handleChange(field.id, value)}
            />
          </SidebarPropertyListItem>
        ))}
      </div>
    </div>
  );
});
