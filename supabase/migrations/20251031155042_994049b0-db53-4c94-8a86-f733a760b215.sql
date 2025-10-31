-- Grant SELECT permission on analytics views to authenticated users
GRANT SELECT ON public.department_analytics TO authenticated;
GRANT SELECT ON public.project_analytics TO authenticated;

-- The views will automatically respect RLS policies from underlying tables
-- (departments and tasks), so users will only see analytics for data they have access to