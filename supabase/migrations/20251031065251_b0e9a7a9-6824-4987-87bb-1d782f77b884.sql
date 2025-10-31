-- Create project_members table to track user assignments to projects
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS on project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Project members policies
CREATE POLICY "Users can view projects they are members of"
ON public.project_members
FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role));

CREATE POLICY "Project managers and admins can add members"
ON public.project_members
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role));

CREATE POLICY "Project managers and admins can remove members"
ON public.project_members
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role));

-- Update projects RLS policy for regular users
DROP POLICY IF EXISTS "Projects are viewable by everyone" ON public.projects;

CREATE POLICY "Admins and managers can view all projects"
ON public.projects
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role));

CREATE POLICY "Users can view their assigned projects"
ON public.projects
FOR SELECT
USING (
  owner_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE project_members.project_id = projects.id 
    AND project_members.user_id = auth.uid()
  )
);

-- Update tasks RLS policy for regular users
DROP POLICY IF EXISTS "Tasks are viewable by everyone" ON public.tasks;

CREATE POLICY "Admins and managers can view all tasks"
ON public.tasks
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role));

CREATE POLICY "Users can view tasks in their projects or assigned to them"
ON public.tasks
FOR SELECT
USING (
  assignee_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = tasks.project_id 
    AND projects.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE project_members.project_id = tasks.project_id 
    AND project_members.user_id = auth.uid()
  )
);

-- Allow users to update status of their assigned tasks
CREATE POLICY "Users can update their assigned tasks"
ON public.tasks
FOR UPDATE
USING (assignee_user_id = auth.uid())
WITH CHECK (assignee_user_id = auth.uid());