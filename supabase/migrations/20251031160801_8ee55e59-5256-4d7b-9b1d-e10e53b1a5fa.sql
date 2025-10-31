-- Update departments RLS policy to allow project members to view all departments in their projects
DROP POLICY IF EXISTS "Users can view their assigned departments" ON public.departments;

CREATE POLICY "Users can view departments in their projects" 
ON public.departments 
FOR SELECT 
USING (
  -- User is admin or project manager
  has_role(auth.uid(), 'admin'::app_role) 
  OR 
  has_role(auth.uid(), 'project_manager'::app_role)
  OR
  -- User is a member of the project (has project role)
  has_project_role_level(auth.uid(), project_id, 'viewer'::project_role)
  OR
  -- User is project owner
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = departments.project_id 
    AND owner_id = auth.uid()
  )
);