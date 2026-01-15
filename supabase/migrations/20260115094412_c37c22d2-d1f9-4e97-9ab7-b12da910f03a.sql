-- Drop the existing document SELECT policy that includes folder inheritance
DROP POLICY IF EXISTS "Restricted document view access" ON public.documents;

-- Create new policy WITHOUT folder permission inheritance
-- Files are only visible with EXPLICIT file-level permissions
CREATE POLICY "Explicit document access only"
ON public.documents
FOR SELECT
USING (
  -- Admins and project managers can see all documents
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  -- Document uploader can see their own documents
  uploaded_by = auth.uid() OR
  -- Project owner can see all project documents
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = documents.project_id 
    AND projects.owner_id = auth.uid()
  ) OR
  -- Department leads can see documents in their department
  EXISTS (
    SELECT 1 FROM department_leads dl
    JOIN departments d ON d.id = dl.department_id
    WHERE dl.user_id = auth.uid() 
    AND d.project_id = documents.project_id
    AND (documents.department_id = d.id OR documents.department_id IS NULL)
  ) OR
  -- EXPLICIT file-level access ONLY (no folder inheritance)
  EXISTS (
    SELECT 1 FROM document_access
    WHERE document_access.document_id = documents.id 
    AND document_access.user_id = auth.uid()
  )
);

-- Also update the has_document_access function to NOT include folder-based access
-- This ensures consistent behavior across the application
CREATE OR REPLACE FUNCTION public.has_document_access(_user_id uuid, _document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only check for EXPLICIT document access, not folder inheritance
  SELECT EXISTS (
    SELECT 1 FROM public.document_access
    WHERE document_id = _document_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = _document_id AND (
      d.uploaded_by = _user_id OR
      has_role(_user_id, 'admin') OR
      has_role(_user_id, 'project_manager')
    )
  ) OR EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.projects p ON p.id = d.project_id
    WHERE d.id = _document_id AND p.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.department_leads dl ON dl.user_id = _user_id
    JOIN public.departments dept ON dept.id = dl.department_id
    WHERE d.id = _document_id 
    AND dept.project_id = d.project_id
    AND (d.department_id = dept.id OR d.department_id IS NULL)
  )
$$;