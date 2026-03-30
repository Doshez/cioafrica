-- Fix FK constraints so departments can be deleted by setting child references to NULL
ALTER TABLE public.tasks DROP CONSTRAINT tasks_assignee_department_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assignee_department_id_fkey 
  FOREIGN KEY (assignee_department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.elements DROP CONSTRAINT elements_department_id_fkey;
ALTER TABLE public.elements ADD CONSTRAINT elements_department_id_fkey 
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.document_folders DROP CONSTRAINT document_folders_department_id_fkey;
ALTER TABLE public.document_folders ADD CONSTRAINT document_folders_department_id_fkey 
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.documents DROP CONSTRAINT documents_department_id_fkey;
ALTER TABLE public.documents ADD CONSTRAINT documents_department_id_fkey 
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.document_links DROP CONSTRAINT document_links_department_id_fkey;
ALTER TABLE public.document_links ADD CONSTRAINT document_links_department_id_fkey 
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.projects DROP CONSTRAINT projects_department_id_fkey;
ALTER TABLE public.projects ADD CONSTRAINT projects_department_id_fkey 
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

-- Fix FK so elements can be deleted (tasks.element_id set to NULL)
ALTER TABLE public.tasks DROP CONSTRAINT tasks_element_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_element_id_fkey 
  FOREIGN KEY (element_id) REFERENCES public.elements(id) ON DELETE SET NULL;