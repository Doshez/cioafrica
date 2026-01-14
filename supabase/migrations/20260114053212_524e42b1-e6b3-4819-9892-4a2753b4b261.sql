-- Add UPDATE policy for project_members table to allow managers and admins to update member roles
CREATE POLICY "Project managers and admins can update member roles"
ON public.project_members
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role));