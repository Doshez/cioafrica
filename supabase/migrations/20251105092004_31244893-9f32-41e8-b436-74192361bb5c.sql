-- Remove the unique constraint on department names
-- This allows different projects to have departments with the same name
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_name_key;

-- Add a unique constraint that allows same names in different projects
-- Only the combination of project_id and name needs to be unique
ALTER TABLE public.departments ADD CONSTRAINT departments_project_name_key UNIQUE (project_id, name);