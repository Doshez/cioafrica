-- Add role column to project_members for project-specific permissions
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_role') THEN
    CREATE TYPE public.project_role AS ENUM ('owner', 'manager', 'member', 'viewer');
  END IF;
END $$;

-- Add role column to project_members table
ALTER TABLE public.project_members 
ADD COLUMN IF NOT EXISTS role public.project_role DEFAULT 'member';

-- Create function to check project-specific role
CREATE OR REPLACE FUNCTION public.has_project_role(
  _user_id uuid, 
  _project_id uuid, 
  _role project_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE user_id = _user_id 
      AND project_id = _project_id
      AND role = _role
  ) OR EXISTS (
    SELECT 1
    FROM public.projects
    WHERE id = _project_id
      AND owner_id = _user_id
  )
$$;

-- Create function to check if user has at least a certain role level in project
CREATE OR REPLACE FUNCTION public.has_project_role_level(
  _user_id uuid,
  _project_id uuid,
  _min_role project_role
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role project_role;
  role_hierarchy INTEGER;
BEGIN
  -- Check if user is project owner
  IF EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = _project_id AND owner_id = _user_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- Get user's role in project
  SELECT role INTO user_role
  FROM public.project_members
  WHERE user_id = _user_id AND project_id = _project_id;

  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Define role hierarchy: owner > manager > member > viewer
  role_hierarchy := CASE user_role
    WHEN 'owner' THEN 4
    WHEN 'manager' THEN 3
    WHEN 'member' THEN 2
    WHEN 'viewer' THEN 1
    ELSE 0
  END;

  RETURN role_hierarchy >= CASE _min_role
    WHEN 'owner' THEN 4
    WHEN 'manager' THEN 3
    WHEN 'member' THEN 2
    WHEN 'viewer' THEN 1
    ELSE 0
  END;
END;
$$;

-- Update projects RLS policies to include project-specific roles
DROP POLICY IF EXISTS "Users can view their assigned projects" ON public.projects;
CREATE POLICY "Users can view their assigned projects" ON public.projects
FOR SELECT USING (
  owner_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
  OR has_project_role_level(auth.uid(), id, 'viewer'::project_role)
);

-- Update tasks RLS policies for project-specific roles
DROP POLICY IF EXISTS "Users can view tasks in their projects or assigned to them" ON public.tasks;
CREATE POLICY "Users can view tasks in their projects or assigned to them" ON public.tasks
FOR SELECT USING (
  assignee_user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
  OR has_project_role_level(auth.uid(), project_id, 'viewer'::project_role)
);

DROP POLICY IF EXISTS "Members can create tasks" ON public.tasks;
CREATE POLICY "Members can create tasks" ON public.tasks
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
    OR has_project_role_level(auth.uid(), project_id, 'member'::project_role)
  )
);

-- Update elements RLS policies for project-specific roles
DROP POLICY IF EXISTS "Users can view elements in their projects" ON public.elements;
CREATE POLICY "Users can view elements in their projects" ON public.elements
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
  OR has_project_role_level(auth.uid(), project_id, 'viewer'::project_role)
);

DROP POLICY IF EXISTS "Members can create elements" ON public.elements;
CREATE POLICY "Members can create elements" ON public.elements
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'project_manager'::app_role)
    OR has_project_role_level(auth.uid(), project_id, 'member'::project_role)
  )
);

-- Update departments RLS policies for project-specific roles
DROP POLICY IF EXISTS "Users can view departments in their projects" ON public.departments;
CREATE POLICY "Users can view departments in their projects" ON public.departments
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'project_manager'::app_role)
  OR has_project_role_level(auth.uid(), project_id, 'viewer'::project_role)
);