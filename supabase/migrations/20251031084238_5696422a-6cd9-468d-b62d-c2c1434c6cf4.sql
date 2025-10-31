-- Add progress_percentage column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN progress_percentage numeric DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100);