-- Drop and recreate department_analytics view with correct status values
DROP VIEW IF EXISTS public.department_analytics;

CREATE OR REPLACE VIEW public.department_analytics AS
SELECT 
  d.id AS department_id,
  d.name AS department_name,
  d.project_id,
  COUNT(t.id) AS total_tasks,
  COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS completed_tasks,
  COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) AS in_progress_tasks,
  COUNT(CASE WHEN t.status = 'todo' THEN 1 END) AS todo_tasks,
  ROUND(
    (COUNT(CASE WHEN t.status = 'done' THEN 1 END)::numeric / 
     NULLIF(COUNT(t.id), 0)::numeric) * 100, 
    2
  ) AS completion_percentage,
  MIN(t.start_date) AS earliest_start_date,
  MAX(t.due_date) AS latest_due_date
FROM departments d
LEFT JOIN tasks t ON t.assignee_department_id = d.id
GROUP BY d.id, d.name, d.project_id;

-- Drop and recreate project_analytics view with correct status values
DROP VIEW IF EXISTS public.project_analytics;

CREATE OR REPLACE VIEW public.project_analytics AS
SELECT 
  p.id AS project_id,
  p.name AS project_name,
  COUNT(DISTINCT d.id) AS total_departments,
  COUNT(DISTINCT t.id) AS total_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) AS completed_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) AS in_progress_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'todo' THEN t.id END) AS todo_tasks,
  ROUND(
    (COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END)::numeric / 
     NULLIF(COUNT(DISTINCT t.id), 0)::numeric) * 100, 
    2
  ) AS completion_percentage
FROM projects p
LEFT JOIN departments d ON d.project_id = p.id
LEFT JOIN tasks t ON t.project_id = p.id
GROUP BY p.id, p.name;

-- Re-grant permissions
GRANT SELECT ON public.department_analytics TO authenticated;
GRANT SELECT ON public.project_analytics TO authenticated;