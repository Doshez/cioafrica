-- Create documents storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', true, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Allow external users to upload files to their department folder
CREATE POLICY "External users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.user_id = auth.uid()
    AND eu.access_level IN ('upload_edit', 'edit_download')
    AND eu.is_active = true
    AND (storage.foldername(name))[2] = eu.project_id::text
    AND (storage.foldername(name))[3] = eu.department_id::text
  )
);

-- Allow external users to view files in their department
CREATE POLICY "External users can view documents storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.user_id = auth.uid()
    AND eu.is_active = true
    AND (storage.foldername(name))[2] = eu.project_id::text
    AND (storage.foldername(name))[3] = eu.department_id::text
  )
);

-- Allow external users with edit access to update their uploads
CREATE POLICY "External users can update their documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.user_id = auth.uid()
    AND eu.access_level IN ('upload_edit', 'edit_download')
    AND eu.is_active = true
    AND (storage.foldername(name))[2] = eu.project_id::text
    AND (storage.foldername(name))[3] = eu.department_id::text
  )
);

-- Allow external users with edit access to delete their uploads
CREATE POLICY "External users can delete their documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.external_users eu
    WHERE eu.user_id = auth.uid()
    AND eu.access_level IN ('upload_edit', 'edit_download')
    AND eu.is_active = true
    AND (storage.foldername(name))[2] = eu.project_id::text
    AND (storage.foldername(name))[3] = eu.department_id::text
  )
);