-- Make the project-documents bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'project-documents';