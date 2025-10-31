-- Fix RLS policy for project creation to ensure owner_id is set correctly
DROP POLICY IF EXISTS "Project managers and admins can create projects" ON public.projects;

-- Create new policy that ensures the owner_id matches the authenticated user
CREATE POLICY "Project managers and admins can create projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role))
  AND (owner_id = auth.uid() OR owner_id IS NULL)
);