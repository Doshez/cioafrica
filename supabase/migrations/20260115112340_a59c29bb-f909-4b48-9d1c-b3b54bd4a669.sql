-- Drop the problematic policy
DROP POLICY IF EXISTS "Project members can view all members of their projects" ON public.project_members;

-- Create a security definer function to check project membership
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE user_id = _user_id
      AND project_id = _project_id
  )
$$;

-- Create the policy using the security definer function
CREATE POLICY "Project members can view all members of their projects"
ON public.project_members
FOR SELECT
USING (
  public.is_project_member(auth.uid(), project_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
);