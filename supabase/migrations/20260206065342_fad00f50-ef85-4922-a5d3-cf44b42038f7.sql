-- Enum for external user access levels
CREATE TYPE public.external_access_level AS ENUM ('view_only', 'upload_edit', 'edit_download');

-- External users table (linked to auth.users but with external-specific metadata)
CREATE TABLE public.external_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  invited_by UUID NOT NULL,
  access_level public.external_access_level NOT NULL DEFAULT 'view_only',
  access_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  temporary_password_expires_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- External user activity log for audit tracking
CREATE TABLE public.external_user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_user_id UUID REFERENCES public.external_users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_external_users_department ON public.external_users(department_id);
CREATE INDEX idx_external_users_project ON public.external_users(project_id);
CREATE INDEX idx_external_users_email ON public.external_users(email);
CREATE INDEX idx_external_users_user_id ON public.external_users(user_id);
CREATE INDEX idx_external_activity_user ON public.external_user_activity_log(external_user_id);
CREATE INDEX idx_external_activity_created ON public.external_user_activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.external_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_user_activity_log ENABLE ROW LEVEL SECURITY;

-- Function to check if user is department lead or admin
CREATE OR REPLACE FUNCTION public.can_manage_external_users(_user_id UUID, _department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    has_role(_user_id, 'admin'::app_role) OR
    has_role(_user_id, 'project_manager'::app_role) OR
    is_department_lead(_user_id, _department_id)
  )
$$;

-- Function to check if current user is an external user
CREATE OR REPLACE FUNCTION public.is_external_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.external_users
    WHERE user_id = _user_id AND is_active = true
  )
$$;

-- Function to get external user's department access
CREATE OR REPLACE FUNCTION public.get_external_user_department(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.external_users
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1
$$;

-- RLS Policies for external_users table
-- Department leads and admins can view external users in their departments
CREATE POLICY "Department leads can view external users"
ON public.external_users
FOR SELECT
TO authenticated
USING (
  can_manage_external_users(auth.uid(), department_id) OR
  user_id = auth.uid()
);

-- Department leads and admins can insert external users
CREATE POLICY "Department leads can create external users"
ON public.external_users
FOR INSERT
TO authenticated
WITH CHECK (
  can_manage_external_users(auth.uid(), department_id)
);

-- Department leads and admins can update external users
CREATE POLICY "Department leads can update external users"
ON public.external_users
FOR UPDATE
TO authenticated
USING (
  can_manage_external_users(auth.uid(), department_id)
);

-- Department leads and admins can delete external users
CREATE POLICY "Department leads can delete external users"
ON public.external_users
FOR DELETE
TO authenticated
USING (
  can_manage_external_users(auth.uid(), department_id)
);

-- RLS Policies for activity log
CREATE POLICY "Department leads can view activity logs"
ON public.external_user_activity_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.id = external_user_id
    AND can_manage_external_users(auth.uid(), eu.department_id)
  ) OR
  EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.id = external_user_id AND eu.user_id = auth.uid()
  )
);

-- System can insert activity logs (via service role or authenticated user for their own actions)
CREATE POLICY "Users can log their own activity"
ON public.external_user_activity_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.id = external_user_id AND eu.user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.id = external_user_id
    AND can_manage_external_users(auth.uid(), eu.department_id)
  )
);

-- Trigger to update updated_at
CREATE TRIGGER update_external_users_updated_at
BEFORE UPDATE ON public.external_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for external_users
ALTER PUBLICATION supabase_realtime ADD TABLE public.external_users;