-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.project_members;

-- Create a new policy that allows all project members to see each other
CREATE POLICY "Project members can view all members of their projects"
ON public.project_members
FOR SELECT
USING (
  -- User can see members of projects they belong to
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = project_members.project_id
    AND pm.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);