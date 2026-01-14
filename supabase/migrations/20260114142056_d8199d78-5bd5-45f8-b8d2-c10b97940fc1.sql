-- First migration: Add 'edit' permission to the document_permission enum
ALTER TYPE public.document_permission ADD VALUE IF NOT EXISTS 'edit';