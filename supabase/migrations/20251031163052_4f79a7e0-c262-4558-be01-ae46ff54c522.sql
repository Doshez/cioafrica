-- Create storage bucket for project logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-logos', 'project-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for project logos
CREATE POLICY "Anyone can view project logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-logos');

CREATE POLICY "Admins and project managers can upload project logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-logos' 
  AND (
    auth.uid() IN (
      SELECT user_id FROM public.user_roles 
      WHERE role IN ('admin', 'project_manager')
    )
  )
);

CREATE POLICY "Admins and project managers can update project logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-logos' 
  AND (
    auth.uid() IN (
      SELECT user_id FROM public.user_roles 
      WHERE role IN ('admin', 'project_manager')
    )
  )
);

CREATE POLICY "Admins and project managers can delete project logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-logos' 
  AND (
    auth.uid() IN (
      SELECT user_id FROM public.user_roles 
      WHERE role IN ('admin', 'project_manager')
    )
  )
);