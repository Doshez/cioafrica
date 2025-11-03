-- Add cost tracking fields to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_cost NUMERIC DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN tasks.estimated_cost IS 'Estimated cost for the task';
COMMENT ON COLUMN tasks.actual_cost IS 'Actual cost incurred for the task';