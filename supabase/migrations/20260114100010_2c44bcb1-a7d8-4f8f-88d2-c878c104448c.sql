-- Drop existing overly permissive SELECT policies
DROP POLICY IF EXISTS "Users can view documents they have access to" ON public.documents;
DROP POLICY IF EXISTS "Users can view folders they have access to" ON public.document_folders;
DROP POLICY IF EXISTS "Users can view links they have access to" ON public.document_links;

-- Create a function to check inherited folder access (if parent folder has access, child has access too)
CREATE OR REPLACE FUNCTION public.has_folder_access_recursive(_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_folder_id uuid := _folder_id;
  parent_id uuid;
BEGIN
  -- Check direct folder access first
  IF EXISTS (
    SELECT 1 FROM public.document_access
    WHERE folder_id = _folder_id AND user_id = _user_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check parent folders recursively
  LOOP
    SELECT parent_folder_id INTO parent_id
    FROM public.document_folders
    WHERE id = current_folder_id;

    IF parent_id IS NULL THEN
      EXIT;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.document_access
      WHERE folder_id = parent_id AND user_id = _user_id
    ) THEN
      RETURN TRUE;
    END IF;

    current_folder_id := parent_id;
  END LOOP;

  RETURN FALSE;
END;
$$;

-- Create a function to check if user has access to a document via folder access
CREATE OR REPLACE FUNCTION public.has_document_access_via_folder(_user_id uuid, _document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = _document_id 
      AND d.folder_id IS NOT NULL
      AND has_folder_access_recursive(_user_id, d.folder_id)
  )
$$;

-- Create a function to check if user has access to a link via folder access
CREATE OR REPLACE FUNCTION public.has_link_access_via_folder(_user_id uuid, _link_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_links l
    WHERE l.id = _link_id 
      AND l.folder_id IS NOT NULL
      AND has_folder_access_recursive(_user_id, l.folder_id)
  )
$$;

-- New restrictive policy for documents:
-- Access only if: admin, project_manager, uploader, has direct document_access, or has folder access
CREATE POLICY "Restricted document view access"
ON public.documents FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  uploaded_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = documents.project_id AND owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.department_leads dl
    JOIN public.departments d ON d.id = dl.department_id
    WHERE dl.user_id = auth.uid() 
      AND d.project_id = documents.project_id
      AND (documents.department_id = d.id OR documents.department_id IS NULL)
  ) OR
  EXISTS (
    SELECT 1 FROM public.document_access
    WHERE document_id = documents.id AND user_id = auth.uid()
  ) OR
  has_document_access_via_folder(auth.uid(), documents.id)
);

-- New restrictive policy for folders:
-- Access only if: admin, project_manager, creator, has direct folder_access, or parent folder access
CREATE POLICY "Restricted folder view access"
ON public.document_folders FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = document_folders.project_id AND owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.department_leads dl
    JOIN public.departments d ON d.id = dl.department_id
    WHERE dl.user_id = auth.uid() 
      AND d.project_id = document_folders.project_id
      AND (document_folders.department_id = d.id OR document_folders.department_id IS NULL)
  ) OR
  has_folder_access_recursive(auth.uid(), document_folders.id)
);

-- New restrictive policy for links:
-- Access only if: admin, project_manager, creator, has direct link_access, or has folder access
CREATE POLICY "Restricted link view access"
ON public.document_links FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = document_links.project_id AND owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.department_leads dl
    JOIN public.departments d ON d.id = dl.department_id
    WHERE dl.user_id = auth.uid() 
      AND d.project_id = document_links.project_id
      AND (document_links.department_id = d.id OR document_links.department_id IS NULL)
  ) OR
  EXISTS (
    SELECT 1 FROM public.document_access
    WHERE link_id = document_links.id AND user_id = auth.uid()
  ) OR
  has_link_access_via_folder(auth.uid(), document_links.id)
);