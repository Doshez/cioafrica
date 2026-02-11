
-- Update the documents SELECT policy for external users to also check junction table
DROP POLICY IF EXISTS "External users can view documents in their department" ON public.documents;
CREATE POLICY "External users can view documents in their department"
ON public.documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM external_users eu
    WHERE eu.user_id = auth.uid() AND eu.department_id = documents.department_id AND eu.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM external_user_departments eud
    JOIN external_users eu ON eu.id = eud.external_user_id
    WHERE eu.user_id = auth.uid() AND eud.department_id = documents.department_id AND eud.is_active = true AND eu.is_active = true
  )
);

-- Update document_folders SELECT policy for external users
DROP POLICY IF EXISTS "External users can view folders in their department" ON public.document_folders;
CREATE POLICY "External users can view folders in their department"
ON public.document_folders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM external_users eu
    WHERE eu.user_id = auth.uid() AND eu.department_id = document_folders.department_id AND eu.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM external_user_departments eud
    JOIN external_users eu ON eu.id = eud.external_user_id
    WHERE eu.user_id = auth.uid() AND eud.department_id = document_folders.department_id AND eud.is_active = true AND eu.is_active = true
  )
);

-- Update document_links SELECT policy for external users
DROP POLICY IF EXISTS "External users can view links in their department" ON public.document_links;
CREATE POLICY "External users can view links in their department"
ON public.document_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM external_users eu
    WHERE eu.user_id = auth.uid() AND eu.department_id = document_links.department_id AND eu.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM external_user_departments eud
    JOIN external_users eu ON eu.id = eud.external_user_id
    WHERE eu.user_id = auth.uid() AND eud.department_id = document_links.department_id AND eud.is_active = true AND eu.is_active = true
  )
);

-- Update departments SELECT policy for external users to include cross-department
DROP POLICY IF EXISTS "External users can view their department" ON public.departments;
CREATE POLICY "External users can view their department"
ON public.departments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM external_users eu
    WHERE eu.user_id = auth.uid() AND eu.department_id = departments.id AND eu.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM external_user_departments eud
    JOIN external_users eu ON eu.id = eud.external_user_id
    WHERE eu.user_id = auth.uid() AND eud.department_id = departments.id AND eud.is_active = true AND eu.is_active = true
  )
);

-- Update documents INSERT policy for external users with upload access via junction table
DROP POLICY IF EXISTS "External users with upload access can create documents" ON public.documents;
CREATE POLICY "External users with upload access can create documents"
ON public.documents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM external_users eu
    WHERE eu.user_id = auth.uid() AND eu.department_id = documents.department_id
    AND eu.access_level = ANY (ARRAY['upload_edit'::external_access_level, 'edit_download'::external_access_level])
    AND eu.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM external_user_departments eud
    JOIN external_users eu ON eu.id = eud.external_user_id
    WHERE eu.user_id = auth.uid() AND eud.department_id = documents.department_id
    AND eud.access_level = ANY (ARRAY['upload_edit'::external_access_level, 'edit_download'::external_access_level])
    AND eud.is_active = true AND eu.is_active = true
  )
);

-- Update documents UPDATE policy for external users with edit access via junction table
DROP POLICY IF EXISTS "External users with edit access can update documents" ON public.documents;
CREATE POLICY "External users with edit access can update documents"
ON public.documents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM external_users eu
    WHERE eu.user_id = auth.uid() AND eu.department_id = documents.department_id
    AND eu.access_level = ANY (ARRAY['upload_edit'::external_access_level, 'edit_download'::external_access_level])
    AND eu.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM external_user_departments eud
    JOIN external_users eu ON eu.id = eud.external_user_id
    WHERE eu.user_id = auth.uid() AND eud.department_id = documents.department_id
    AND eud.access_level = ANY (ARRAY['upload_edit'::external_access_level, 'edit_download'::external_access_level])
    AND eud.is_active = true AND eu.is_active = true
  )
);
