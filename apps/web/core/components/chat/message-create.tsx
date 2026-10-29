/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, type KeyboardEvent } from "react";
import { observer } from "mobx-react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@plane/propel/button";

type TChatMessageCreate = {
  disabled?: boolean;
  onSubmit: (message: string) => Promise<void>;
};

export const ChatMessageCreate = observer(function ChatMessageCreate(props: TChatMessageCreate) {
  const { disabled, onSubmit } = props;
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = value.trim().length > 0 && !submitting && !disabled;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const message = value.trim();
    setSubmitting(true);
    try {
      setValue("");
      await onSubmit(message);
    } catch {
      setValue(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2 border-t border-subtle bg-surface-1 p-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message the workspace…"
        rows={1}
        disabled={disabled}
        className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-subtle bg-surface-1 px-3 py-2 text-body-sm-regular text-primary placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!canSubmit} loading={submitting}>
        <SendHorizontal className="size-4" />
      </Button>
    </div>
  );
});
