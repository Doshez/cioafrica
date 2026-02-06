-- Add RLS policies for external users to access their assigned department's documents

-- External users can view their assigned department
CREATE POLICY "External users can view their department"
ON public.departments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.user_id = auth.uid()
    AND eu.department_id = departments.id
    AND eu.is_active = true
  )
);

-- External users can view their assigned project
CREATE POLICY "External users can view their project"
ON public.projects FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.user_id = auth.uid()
    AND eu.project_id = projects.id
    AND eu.is_active = true
  )
);

-- External users can view document folders in their assigned department
CREATE POLICY "External users can view folders in their department"
ON public.document_folders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.user_id = auth.uid()
    AND eu.department_id = document_folders.department_id
    AND eu.is_active = true
  )
);

-- External users can view documents in their assigned department
CREATE POLICY "External users can view documents in their department"
ON public.documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.user_id = auth.uid()
    AND eu.department_id = documents.department_id
    AND eu.is_active = true
  )
);

-- External users can view document links in their assigned department
CREATE POLICY "External users can view links in their department"
ON public.document_links FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.user_id = auth.uid()
    AND eu.department_id = document_links.department_id
    AND eu.is_active = true
  )
);

-- External users with upload_edit access can insert documents in their department
CREATE POLICY "External users with upload access can create documents"
ON public.documents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.user_id = auth.uid()
    AND eu.department_id = documents.department_id
    AND eu.access_level IN ('upload_edit', 'edit_download')
    AND eu.is_active = true
  )
);

-- External users with edit access can update documents in their department
CREATE POLICY "External users with edit access can update documents"
ON public.documents FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.user_id = auth.uid()
    AND eu.department_id = documents.department_id
    AND eu.access_level IN ('upload_edit', 'edit_download')
    AND eu.is_active = true
  )
);