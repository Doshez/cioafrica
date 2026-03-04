
CREATE OR REPLACE FUNCTION public.validate_task_department_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only check if assignee_department_id is being changed
  IF OLD.assignee_department_id IS DISTINCT FROM NEW.assignee_department_id THEN
    -- Allow if user is admin or project_manager
    IF has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'project_manager'::app_role) THEN
      RETURN NEW;
    END IF;
    
    -- Allow if user is lead of the TARGET department
    IF NEW.assignee_department_id IS NOT NULL AND is_department_lead(auth.uid(), NEW.assignee_department_id) THEN
      RETURN NEW;
    END IF;
    
    -- Allow if user is lead of the SOURCE department
    IF OLD.assignee_department_id IS NOT NULL AND is_department_lead(auth.uid(), OLD.assignee_department_id) THEN
      RETURN NEW;
    END IF;
    
    RAISE EXCEPTION 'Only admins, project managers, or department leads can move tasks between departments';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_task_department_change
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_department_change();
