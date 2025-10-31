-- Add project_id to departments table to create proper hierarchy
ALTER TABLE public.departments 
ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_departments_project_id ON public.departments(project_id);

-- Update RLS policies for departments to include project-based access
DROP POLICY IF EXISTS "Departments are viewable by everyone" ON public.departments;
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;

CREATE POLICY "Users can view departments in their projects" 
ON public.departments 
FOR SELECT 
USING (
  project_id IN (
    SELECT id FROM public.projects 
    WHERE owner_id = auth.uid() 
    OR id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
  )
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "Admins and project managers can create departments" 
ON public.departments 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "Admins and project managers can update departments" 
ON public.departments 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'project_manager'::app_role)
);

CREATE POLICY "Admins can delete departments" 
ON public.departments 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a view for project analytics
CREATE OR REPLACE VIEW public.project_analytics AS
SELECT 
  p.id as project_id,
  p.name as project_name,
  COUNT(DISTINCT d.id) as total_departments,
  COUNT(DISTINCT t.id) as total_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as in_progress_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'todo' THEN t.id END) as todo_tasks,
  ROUND(
    (COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END)::numeric / 
    NULLIF(COUNT(DISTINCT t.id), 0) * 100), 2
  ) as completion_percentage
FROM public.projects p
LEFT JOIN public.departments d ON d.project_id = p.id
LEFT JOIN public.tasks t ON t.project_id = p.id
GROUP BY p.id, p.name;

-- Create a view for department analytics
CREATE OR REPLACE VIEW public.department_analytics AS
SELECT 
  d.id as department_id,
  d.name as department_name,
  d.project_id,
  COUNT(t.id) as total_tasks,
  COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
  COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
  COUNT(CASE WHEN t.status = 'todo' THEN 1 END) as todo_tasks,
  ROUND(
    (COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::numeric / 
    NULLIF(COUNT(t.id), 0) * 100), 2
  ) as completion_percentage,
  MIN(t.start_date) as earliest_start_date,
  MAX(t.due_date) as latest_due_date
FROM public.departments d
LEFT JOIN public.tasks t ON t.assignee_department_id = d.id
GROUP BY d.id, d.name, d.project_id;