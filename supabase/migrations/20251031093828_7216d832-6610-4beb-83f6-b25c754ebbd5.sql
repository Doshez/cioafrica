-- Create task_assignments junction table for multi-user task assignments
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Enable RLS
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Migrate existing single assignments to junction table
INSERT INTO public.task_assignments (task_id, user_id)
SELECT id, assignee_user_id 
FROM public.tasks 
WHERE assignee_user_id IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON public.task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user_id ON public.task_assignments(user_id);