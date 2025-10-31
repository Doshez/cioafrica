-- Drop the old check constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Add new check constraint with updated status values (removed 'review', changed 'completed' to 'done')
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('todo', 'in_progress', 'done'));