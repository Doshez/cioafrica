-- Create table to store user's preferred view per department
CREATE TABLE public.user_view_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  view_type TEXT NOT NULL DEFAULT 'list',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id),
  CONSTRAINT valid_view_type CHECK (view_type IN ('list', 'kanban', 'table', 'calendar'))
);

-- Enable RLS
ALTER TABLE public.user_view_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own preferences
CREATE POLICY "Users can view their own view preferences"
  ON public.user_view_preferences
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own view preferences"
  ON public.user_view_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own view preferences"
  ON public.user_view_preferences
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own view preferences"
  ON public.user_view_preferences
  FOR DELETE
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_user_view_preferences_updated_at
  BEFORE UPDATE ON public.user_view_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();