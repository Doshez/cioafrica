
-- Create junction table for external user multi-department associations
CREATE TABLE public.external_user_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_user_id UUID NOT NULL REFERENCES public.external_users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  access_level public.external_access_level NOT NULL DEFAULT 'view_only',
  added_by UUID NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(external_user_id, department_id)
);

-- Enable RLS
ALTER TABLE public.external_user_departments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Department leads can view department associations"
ON public.external_user_departments
FOR SELECT
USING (
  can_manage_external_users(auth.uid(), department_id) OR
  EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.id = external_user_id AND can_manage_external_users(auth.uid(), eu.department_id)
  )
);

CREATE POLICY "Department leads can add users to their department"
ON public.external_user_departments
FOR INSERT
WITH CHECK (can_manage_external_users(auth.uid(), department_id));

CREATE POLICY "Department leads can update their department associations"
ON public.external_user_departments
FOR UPDATE
USING (can_manage_external_users(auth.uid(), department_id));

CREATE POLICY "Department leads can remove users from their department"
ON public.external_user_departments
FOR DELETE
USING (can_manage_external_users(auth.uid(), department_id));

-- Enable realtime for the new table
ALTER PUBLICATION supabase_realtime ADD TABLE public.external_user_departments;
