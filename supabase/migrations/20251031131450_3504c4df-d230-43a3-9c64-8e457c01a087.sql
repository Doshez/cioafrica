-- Create elements table
CREATE TABLE IF NOT EXISTS public.elements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  start_date DATE,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add element_id to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS element_id UUID REFERENCES public.elements(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_element_id ON public.tasks(element_id);
CREATE INDEX IF NOT EXISTS idx_elements_project_id ON public.elements(project_id);
CREATE INDEX IF NOT EXISTS idx_elements_department_id ON public.elements(department_id);

-- Enable RLS on elements table
ALTER TABLE public.elements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for elements table
-- Users can view elements in their projects
CREATE POLICY "Users can view elements in their projects"
ON public.elements
FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects 
    WHERE owner_id = auth.uid() 
    OR id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  )
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'project_manager')
);

-- Project members can create elements
CREATE POLICY "Members can create elements"
ON public.elements
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    project_id IN (
      SELECT id FROM projects 
      WHERE owner_id = auth.uid() 
      OR id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'project_manager')
  )
);

-- Project managers and admins can update elements
CREATE POLICY "Admins and project managers can update elements"
ON public.elements
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'project_manager')
  OR EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = elements.project_id 
    AND projects.owner_id = auth.uid()
  )
);

-- Project managers and admins can delete elements
CREATE POLICY "Admins and project managers can delete elements"
ON public.elements
FOR DELETE
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'project_manager')
);

-- Update trigger for elements
CREATE TRIGGER update_elements_updated_at
BEFORE UPDATE ON public.elements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();