
-- Add project category enum
DO $$ BEGIN
  CREATE TYPE public.project_category AS ENUM ('cio_africa', 'client');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add columns to projects table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_category public.project_category NOT NULL DEFAULT 'cio_africa',
  ADD COLUMN IF NOT EXISTS client_name text;
