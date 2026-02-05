-- Create table for project report settings
CREATE TABLE public.project_report_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  send_time TIME NOT NULL DEFAULT '08:00:00',
  timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
  include_department_summary BOOLEAN NOT NULL DEFAULT true,
  include_user_activity BOOLEAN NOT NULL DEFAULT true,
  include_smart_insights BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(project_id)
);

-- Create table for report recipients
CREATE TABLE public.project_report_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_report_settings_project ON public.project_report_settings(project_id);
CREATE INDEX idx_report_recipients_project ON public.project_report_recipients(project_id);
CREATE INDEX idx_report_recipients_active ON public.project_report_recipients(project_id, is_active);

-- Enable RLS
ALTER TABLE public.project_report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_report_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for report settings (only project managers and admins can manage)
CREATE POLICY "Project managers can view report settings"
ON public.project_report_settings
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'project_manager') OR
  has_project_role_level(auth.uid(), project_id, 'manager')
);

CREATE POLICY "Project managers can create report settings"
ON public.project_report_settings
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'project_manager') OR
  has_project_role_level(auth.uid(), project_id, 'manager')
);

CREATE POLICY "Project managers can update report settings"
ON public.project_report_settings
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'project_manager') OR
  has_project_role_level(auth.uid(), project_id, 'manager')
);

CREATE POLICY "Project managers can delete report settings"
ON public.project_report_settings
FOR DELETE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'project_manager') OR
  has_project_role_level(auth.uid(), project_id, 'manager')
);

-- RLS Policies for recipients
CREATE POLICY "Project managers can view recipients"
ON public.project_report_recipients
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'project_manager') OR
  has_project_role_level(auth.uid(), project_id, 'manager')
);

CREATE POLICY "Project managers can manage recipients"
ON public.project_report_recipients
FOR ALL
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'project_manager') OR
  has_project_role_level(auth.uid(), project_id, 'manager')
);

-- Add triggers for updated_at
CREATE TRIGGER update_report_settings_updated_at
BEFORE UPDATE ON public.project_report_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();