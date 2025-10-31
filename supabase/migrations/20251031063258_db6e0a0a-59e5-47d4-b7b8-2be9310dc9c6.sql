-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'project_manager', 'member', 'viewer');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
  theme_colors JSONB DEFAULT '{"primary": "#3b82f6", "secondary": "#8b5cf6"}'::jsonb,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'completed', 'blocked')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  estimate_hours NUMERIC(10, 2),
  logged_hours NUMERIC(10, 2) DEFAULT 0,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  labels TEXT[],
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create task_dependencies table
CREATE TABLE public.task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  depends_on_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id)
);

-- Create task_attachments table
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create task_comments table
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('task_created', 'task_updated', 'task_due_soon', 'task_overdue', 'task_completed')),
  related_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for departments
CREATE POLICY "Departments are viewable by everyone"
  ON public.departments FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage departments"
  ON public.departments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for projects
CREATE POLICY "Projects are viewable by everyone"
  ON public.projects FOR SELECT
  USING (true);

CREATE POLICY "Project managers and admins can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'project_manager')
  );

CREATE POLICY "Project owners, managers and admins can update projects"
  ON public.projects FOR UPDATE
  USING (
    owner_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'project_manager')
  );

CREATE POLICY "Admins can delete projects"
  ON public.projects FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for tasks
CREATE POLICY "Tasks are viewable by everyone"
  ON public.tasks FOR SELECT
  USING (true);

CREATE POLICY "Members can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Assignees, project owners and admins can update tasks"
  ON public.tasks FOR UPDATE
  USING (
    assignee_user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'project_manager') OR
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = tasks.project_id AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins and project managers can delete tasks"
  ON public.tasks FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'project_manager')
  );

-- RLS Policies for task_dependencies
CREATE POLICY "Task dependencies are viewable by everyone"
  ON public.task_dependencies FOR SELECT
  USING (true);

CREATE POLICY "Members can manage task dependencies"
  ON public.task_dependencies FOR ALL
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for task_attachments
CREATE POLICY "Task attachments are viewable by everyone"
  ON public.task_attachments FOR SELECT
  USING (true);

CREATE POLICY "Members can upload attachments"
  ON public.task_attachments FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploaders and admins can delete attachments"
  ON public.task_attachments FOR DELETE
  USING (
    uploaded_by = auth.uid() OR
    public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for task_comments
CREATE POLICY "Task comments are viewable by everyone"
  ON public.task_comments FOR SELECT
  USING (true);

CREATE POLICY "Members can create comments"
  ON public.task_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Comment authors can update their comments"
  ON public.task_comments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Comment authors and admins can delete comments"
  ON public.task_comments FOR DELETE
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin')
  );

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_comments_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();