-- Create enum for document permission levels
CREATE TYPE public.document_permission AS ENUM ('view_only', 'download');

-- Create folders table for organizing documents
CREATE TABLE public.document_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  parent_folder_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table for file storage
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create links table for external URLs
CREATE TABLE public.document_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create document access permissions table
CREATE TABLE public.document_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  link_id UUID REFERENCES public.document_links(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission document_permission NOT NULL DEFAULT 'view_only',
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT document_access_check CHECK (
    (document_id IS NOT NULL AND link_id IS NULL AND folder_id IS NULL) OR
    (document_id IS NULL AND link_id IS NOT NULL AND folder_id IS NULL) OR
    (document_id IS NULL AND link_id IS NULL AND folder_id IS NOT NULL)
  )
);

-- Create audit log for document actions
CREATE TABLE public.document_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  link_id UUID REFERENCES public.document_links(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audit_log ENABLE ROW LEVEL SECURITY;

-- Function to check if user can manage documents (admin, project owner, or project manager)
CREATE OR REPLACE FUNCTION public.can_manage_documents(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(_user_id, 'admin') OR 
    has_role(_user_id, 'project_manager') OR
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = _project_id AND owner_id = _user_id
    )
$$;

-- Function to check if user has access to a document
CREATE OR REPLACE FUNCTION public.has_document_access(_user_id uuid, _document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  )
$$;

-- Function to check if user has access to a link
CREATE OR REPLACE FUNCTION public.has_link_access(_user_id uuid, _link_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_access
    WHERE link_id = _link_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.document_links l
    WHERE l.id = _link_id AND (
      l.created_by = _user_id OR
      has_role(_user_id, 'admin') OR
      has_role(_user_id, 'project_manager')
    )
  )
$$;

-- Function to check if user has access to a folder
CREATE OR REPLACE FUNCTION public.has_folder_access(_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_access
    WHERE folder_id = _folder_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.document_folders f
    WHERE f.id = _folder_id AND (
      f.created_by = _user_id OR
      has_role(_user_id, 'admin') OR
      has_role(_user_id, 'project_manager')
    )
  )
$$;

-- RLS Policies for document_folders
CREATE POLICY "Users can view folders they have access to"
ON public.document_folders FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'project_manager') OR
  created_by = auth.uid() OR
  has_folder_access(auth.uid(), id) OR
  has_project_role_level(auth.uid(), project_id, 'viewer')
);

CREATE POLICY "Document managers can create folders"
ON public.document_folders FOR INSERT
WITH CHECK (can_manage_documents(auth.uid(), project_id));

CREATE POLICY "Document managers can update folders"
ON public.document_folders FOR UPDATE
USING (can_manage_documents(auth.uid(), project_id));

CREATE POLICY "Document managers can delete folders"
ON public.document_folders FOR DELETE
USING (can_manage_documents(auth.uid(), project_id));

-- RLS Policies for documents
CREATE POLICY "Users can view documents they have access to"
ON public.documents FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'project_manager') OR
  uploaded_by = auth.uid() OR
  has_document_access(auth.uid(), id)
);

CREATE POLICY "Document managers can create documents"
ON public.documents FOR INSERT
WITH CHECK (can_manage_documents(auth.uid(), project_id));

CREATE POLICY "Document managers can update documents"
ON public.documents FOR UPDATE
USING (can_manage_documents(auth.uid(), project_id));

CREATE POLICY "Document managers can delete documents"
ON public.documents FOR DELETE
USING (can_manage_documents(auth.uid(), project_id));

-- RLS Policies for document_links
CREATE POLICY "Users can view links they have access to"
ON public.document_links FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'project_manager') OR
  created_by = auth.uid() OR
  has_link_access(auth.uid(), id)
);

CREATE POLICY "Document managers can create links"
ON public.document_links FOR INSERT
WITH CHECK (can_manage_documents(auth.uid(), project_id));

CREATE POLICY "Document managers can update links"
ON public.document_links FOR UPDATE
USING (can_manage_documents(auth.uid(), project_id));

CREATE POLICY "Document managers can delete links"
ON public.document_links FOR DELETE
USING (can_manage_documents(auth.uid(), project_id));

-- RLS Policies for document_access
CREATE POLICY "Users can view their own access"
ON public.document_access FOR SELECT
USING (
  user_id = auth.uid() OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'project_manager')
);

CREATE POLICY "Document managers can manage access"
ON public.document_access FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'project_manager') OR
  granted_by = auth.uid()
);

CREATE POLICY "Document managers can update access"
ON public.document_access FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'project_manager')
);

CREATE POLICY "Document managers can delete access"
ON public.document_access FOR DELETE
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'project_manager')
);

-- RLS Policies for document_audit_log
CREATE POLICY "Admins and managers can view audit logs"
ON public.document_audit_log FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'project_manager')
);

CREATE POLICY "System can insert audit logs"
ON public.document_audit_log FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for project-documents bucket
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view documents they have access to"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Document managers can delete documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-documents' AND auth.uid() IS NOT NULL);

-- Enable realtime for documents
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_folders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_access;

-- Add indexes for better performance
CREATE INDEX idx_documents_project_id ON public.documents(project_id);
CREATE INDEX idx_documents_folder_id ON public.documents(folder_id);
CREATE INDEX idx_documents_department_id ON public.documents(department_id);
CREATE INDEX idx_document_links_project_id ON public.document_links(project_id);
CREATE INDEX idx_document_links_folder_id ON public.document_links(folder_id);
CREATE INDEX idx_document_folders_project_id ON public.document_folders(project_id);
CREATE INDEX idx_document_folders_parent_id ON public.document_folders(parent_folder_id);
CREATE INDEX idx_document_access_user_id ON public.document_access(user_id);
CREATE INDEX idx_document_access_document_id ON public.document_access(document_id);
CREATE INDEX idx_document_access_link_id ON public.document_access(link_id);
CREATE INDEX idx_document_access_folder_id ON public.document_access(folder_id);