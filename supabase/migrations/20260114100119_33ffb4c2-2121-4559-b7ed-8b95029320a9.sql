-- Drop the duplicate old policies that still exist
DROP POLICY IF EXISTS "Users can view folders they have access to" ON public.document_folders;
DROP POLICY IF EXISTS "Users can view links they have access to" ON public.document_links;
DROP POLICY IF EXISTS "Users can view documents they have access to" ON public.documents;