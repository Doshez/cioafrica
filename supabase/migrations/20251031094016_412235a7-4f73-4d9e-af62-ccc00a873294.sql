-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view task assignments in their projects" ON public.task_assignments;
DROP POLICY IF EXISTS "Project managers and admins can manage task assignments" ON public.task_assignments;

-- Recreate RLS Policies
CREATE POLICY "Users can view task assignments in their projects"
  ON public.task_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_assignments.task_id
      AND (
        tasks.assignee_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM projects
          WHERE projects.id = tasks.project_id
          AND (projects.owner_id = auth.uid() OR EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
          ))
        )
      )
    )
  );

CREATE POLICY "Project managers and admins can manage task assignments"
  ON public.task_assignments FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'project_manager'::app_role)
    OR EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_assignments.task_id
      AND tasks.assignee_user_id = auth.uid()
    )
  );