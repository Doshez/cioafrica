-- Update RLS policy to allow project members to view all tasks in their projects
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view tasks in their projects or assigned to them" ON public.tasks;

-- Create new policy that allows project members to view all tasks in projects they're members of
CREATE POLICY "Users can view tasks in their projects or assigned to them" 
ON public.tasks 
FOR SELECT 
USING (
  -- Assigned to the user
  assignee_user_id = auth.uid() 
  OR 
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
    WHERE id = tasks.project_id 
    AND owner_id = auth.uid()
  )
);