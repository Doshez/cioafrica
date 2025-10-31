-- Fix security definer views by recreating them with SECURITY INVOKER
DROP VIEW IF EXISTS public.project_analytics;
DROP VIEW IF EXISTS public.department_analytics;

-- Create project analytics view with SECURITY INVOKER
CREATE OR REPLACE VIEW public.project_analytics 
WITH (security_invoker = true) AS
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

-- Create department analytics view with SECURITY INVOKER
CREATE OR REPLACE VIEW public.department_analytics 
WITH (security_invoker = true) AS
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