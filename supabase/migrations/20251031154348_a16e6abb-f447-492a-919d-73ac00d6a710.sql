-- Drop existing department view policy
DROP POLICY IF EXISTS "Users can view departments in their projects" ON public.departments;

-- Create new policy: Users can only see departments where they have assigned tasks
CREATE POLICY "Users can view their assigned departments"
ON public.departments
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'project_manager'::app_role)
  OR EXISTS (
    SELECT 1 
    FROM public.tasks 
    WHERE tasks.assignee_department_id = departments.id 
    AND tasks.assignee_user_id = auth.uid()
  )
);

-- Add helper function to check if user has any tasks in a project
CREATE OR REPLACE FUNCTION public.user_has_tasks_in_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks
    WHERE assignee_user_id = _user_id 
    AND project_id = _project_id
  )
$$;