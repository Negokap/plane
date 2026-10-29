/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "react-router";
// components
import { PageHead } from "@/components/core/page-title";
import { ProjectCustomFieldsSettings } from "@/components/custom-fields/settings";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
// hooks
import { useProject } from "@/hooks/store/use-project";
// local imports
import { CustomFieldsProjectSettingsHeader } from "./header";

function CustomFieldsSettingsPage() {
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { currentProjectDetails } = useProject();

  const pageTitle = currentProjectDetails?.name ? `${currentProjectDetails?.name} - Custom fields` : undefined;

  if (!workspaceSlug || !projectId) return null;

  return (
    <SettingsContentWrapper header={<CustomFieldsProjectSettingsHeader />}>
      <PageHead title={pageTitle} />
      <ProjectCustomFieldsSettings workspaceSlug={workspaceSlug} projectId={projectId} />
    </SettingsContentWrapper>
  );
}

export default observer(CustomFieldsSettingsPage);
