-- Drop the existing constraint
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

-- Add the updated constraint with new notification types
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'task_created'::text, 
  'task_updated'::text, 
  'task_due_soon'::text, 
  'task_overdue'::text, 
  'task_completed'::text,
  'document_access'::text,
  'chat_message'::text
]));