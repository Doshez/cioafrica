-- Allow project managers to update their own projects (projects they created/own)
DROP POLICY IF EXISTS "Only admins can update projects" ON public.projects;
CREATE POLICY "Admins and project owners can update projects"
ON public.projects
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (has_role(auth.uid(), 'project_manager'::app_role) AND owner_id = auth.uid())
);

-- Allow project managers to delete departments in their projects
DROP POLICY IF EXISTS "Admins can delete departments" ON public.departments;
CREATE POLICY "Admins and project managers can delete departments"
ON public.departments
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'project_manager'::app_role)
);