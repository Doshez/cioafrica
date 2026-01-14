-- Update RLS policy for documents to allow users with edit permission on folder to insert
DROP POLICY IF EXISTS "Document managers can create documents" ON public.documents;

CREATE POLICY "Document managers and folder editors can create documents" 
ON public.documents 
FOR INSERT 
WITH CHECK (
  can_manage_documents(auth.uid(), project_id)
  OR (
    folder_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM document_access da
      WHERE da.folder_id = documents.folder_id
        AND da.user_id = auth.uid()
        AND da.permission = 'edit'::document_permission
    )
  )
);

-- Update RLS policy for documents to allow users with edit permission to update
DROP POLICY IF EXISTS "Document managers can update documents" ON public.documents;

CREATE POLICY "Document managers and folder editors can update documents" 
ON public.documents 
FOR UPDATE 
USING (
  can_manage_documents(auth.uid(), project_id)
  OR (
    folder_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM document_access da
      WHERE da.folder_id = documents.folder_id
        AND da.user_id = auth.uid()
        AND da.permission = 'edit'::document_permission
    )
  )
);

-- Update RLS policy for document_links to allow users with edit permission on folder to insert
DROP POLICY IF EXISTS "Document managers can create links" ON public.document_links;

CREATE POLICY "Document managers and folder editors can create links" 
ON public.document_links 
FOR INSERT 
WITH CHECK (
  can_manage_documents(auth.uid(), project_id)
  OR (
    folder_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM document_access da
      WHERE da.folder_id = document_links.folder_id
        AND da.user_id = auth.uid()
        AND da.permission = 'edit'::document_permission
    )
  )
);

-- Update RLS policy for document_links to allow users with edit permission to update
DROP POLICY IF EXISTS "Document managers can update links" ON public.document_links;

CREATE POLICY "Document managers and folder editors can update links" 
ON public.document_links 
FOR UPDATE 
USING (
  can_manage_documents(auth.uid(), project_id)
  OR (
    folder_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM document_access da
      WHERE da.folder_id = document_links.folder_id
        AND da.user_id = auth.uid()
        AND da.permission = 'edit'::document_permission
    )
  )
);