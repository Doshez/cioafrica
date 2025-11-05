-- Drop the existing update policy that allows owners and managers
DROP POLICY IF EXISTS "Project owners, managers and admins can update projects" ON public.projects;

-- Create a new policy that only allows admins to update projects
CREATE POLICY "Only admins can update projects" 
ON public.projects 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- The delete policy is already admin-only, but let's verify it exists
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;

CREATE POLICY "Only admins can delete projects" 
ON public.projects 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));