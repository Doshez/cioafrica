-- Create the project-documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload project documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-documents');

-- Allow anyone to view/download files (public bucket)
CREATE POLICY "Anyone can view project documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-documents');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own project documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-documents' AND (storage.foldername(name))[1] = auth.uid()::text);