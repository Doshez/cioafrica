-- Create department_leads table to track department leads
CREATE TABLE public.department_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(department_id, user_id)
);

-- Enable RLS
ALTER TABLE public.department_leads ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user is a department lead
CREATE OR REPLACE FUNCTION public.is_department_lead(_user_id uuid, _department_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_leads
    WHERE user_id = _user_id AND department_id = _department_id
  )
$$;

-- RLS Policies for department_leads
CREATE POLICY "Admins and managers can view all department leads"
ON public.department_leads FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role));

CREATE POLICY "Users can view their own department lead assignments"
ON public.department_leads FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins and managers can assign department leads"
ON public.department_leads FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role));

CREATE POLICY "Admins and managers can remove department leads"
ON public.department_leads FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role));

-- Update can_manage_documents to include department leads
CREATE OR REPLACE FUNCTION public.can_manage_documents(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Admin or Project Manager app role
    has_role(_user_id, 'admin'::app_role) OR 
    has_role(_user_id, 'project_manager'::app_role) OR
    -- Project owner
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = _project_id AND owner_id = _user_id
    ) OR
    -- Department lead in this project
    EXISTS (
      SELECT 1 FROM public.department_leads dl
      JOIN public.departments d ON d.id = dl.department_id
      WHERE dl.user_id = _user_id AND d.project_id = _project_id
    )
  )
$$;

-- Update document_access policies to allow department leads to grant access
DROP POLICY IF EXISTS "Document managers can manage access" ON public.document_access;
CREATE POLICY "Document managers can manage access"
ON public.document_access FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'project_manager'::app_role) OR 
  (granted_by = auth.uid()) OR
  -- Department lead can grant access
  EXISTS (
    SELECT 1 FROM public.department_leads dl
    JOIN public.departments d ON d.id = dl.department_id
    WHERE dl.user_id = auth.uid()
  )
);

-- Update documents SELECT policy to allow viewers based on project membership
DROP POLICY IF EXISTS "Users can view documents they have access to" ON public.documents;
CREATE POLICY "Users can view documents they have access to"
ON public.documents FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'project_manager'::app_role) OR 
  (uploaded_by = auth.uid()) OR 
  has_document_access(auth.uid(), id) OR
  has_project_role_level(auth.uid(), project_id, 'viewer'::project_role) OR
  -- Department lead can view all documents in their project
  EXISTS (
    SELECT 1 FROM public.department_leads dl
    JOIN public.departments d ON d.id = dl.department_id
    WHERE dl.user_id = auth.uid() AND d.project_id = documents.project_id
  )
);

-- Update document_links SELECT policy
DROP POLICY IF EXISTS "Users can view links they have access to" ON public.document_links;
CREATE POLICY "Users can view links they have access to"
ON public.document_links FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'project_manager'::app_role) OR 
  (created_by = auth.uid()) OR 
  has_link_access(auth.uid(), id) OR
  has_project_role_level(auth.uid(), project_id, 'viewer'::project_role) OR
  -- Department lead can view all links in their project
  EXISTS (
    SELECT 1 FROM public.department_leads dl
    JOIN public.departments d ON d.id = dl.department_id
    WHERE dl.user_id = auth.uid() AND d.project_id = document_links.project_id
  )
);

-- Update document_folders SELECT policy
DROP POLICY IF EXISTS "Users can view folders they have access to" ON public.document_folders;
CREATE POLICY "Users can view folders they have access to"
ON public.document_folders FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'project_manager'::app_role) OR 
  (created_by = auth.uid()) OR 
  has_folder_access(auth.uid(), id) OR
  has_project_role_level(auth.uid(), project_id, 'viewer'::project_role) OR
  -- Department lead can view all folders in their project
  EXISTS (
    SELECT 1 FROM public.department_leads dl
    JOIN public.departments d ON d.id = dl.department_id
    WHERE dl.user_id = auth.uid() AND d.project_id = document_folders.project_id
  )
);

-- Enable realtime for department_leads
ALTER PUBLICATION supabase_realtime ADD TABLE public.department_leads;