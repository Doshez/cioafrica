-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "Project managers and admins can manage task assignments" ON public.task_assignments;

-- Create a more permissive policy that allows project members to manage task assignments
CREATE POLICY "Project members can manage task assignments"
ON public.task_assignments
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.id = task_assignments.task_id
    AND (
      p.owner_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p.id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'manager', 'member')
      ) OR
      EXISTS (
        SELECT 1 FROM department_leads dl
        JOIN departments d ON d.id = dl.department_id
        WHERE d.project_id = p.id
        AND dl.user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'project_manager'::app_role) OR
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.id = task_assignments.task_id
    AND (
      p.owner_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p.id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'manager', 'member')
      ) OR
      EXISTS (
        SELECT 1 FROM department_leads dl
        JOIN departments d ON d.id = dl.department_id
        WHERE d.project_id = p.id
        AND dl.user_id = auth.uid()
      )
    )
  )
);