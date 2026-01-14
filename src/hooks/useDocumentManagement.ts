import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface DocumentFolder {
  id: string;
  project_id: string;
  department_id: string | null;
  parent_folder_id: string | null;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  department_id: string | null;
  folder_id: string | null;
  name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  uploader_name?: string;
}

export interface DocumentLink {
  id: string;
  project_id: string;
  department_id: string | null;
  folder_id: string | null;
  title: string;
  url: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  creator_name?: string;
}

export interface DocumentAccess {
  id: string;
  document_id: string | null;
  link_id: string | null;
  folder_id: string | null;
  user_id: string;
  permission: 'view_only' | 'download';
  granted_by: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export function useDocumentManagement(projectId: string | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [links, setLinks] = useState<DocumentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      // Fetch folders - use .is() for null comparison
      let foldersQuery = supabase
        .from('document_folders')
        .select('*')
        .eq('project_id', projectId);
      
      if (currentFolderId) {
        foldersQuery = foldersQuery.eq('parent_folder_id', currentFolderId);
      } else {
        foldersQuery = foldersQuery.is('parent_folder_id', null);
      }
      
      const { data: foldersData, error: foldersError } = await foldersQuery.order('name');

      if (foldersError) throw foldersError;

      // Fetch documents - use .is() for null comparison
      let documentsQuery = supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId);
      
      if (currentFolderId) {
        documentsQuery = documentsQuery.eq('folder_id', currentFolderId);
      } else {
        documentsQuery = documentsQuery.is('folder_id', null);
      }
      
      const { data: documentsData, error: documentsError } = await documentsQuery.order('name');

      if (documentsError) throw documentsError;

      // Fetch links - use .is() for null comparison
      let linksQuery = supabase
        .from('document_links')
        .select('*')
        .eq('project_id', projectId);
      
      if (currentFolderId) {
        linksQuery = linksQuery.eq('folder_id', currentFolderId);
      } else {
        linksQuery = linksQuery.is('folder_id', null);
      }
      
      const { data: linksData, error: linksError } = await linksQuery.order('title');

      if (linksError) throw linksError;

      // Get uploader names for documents
      const uploaderIds = [...new Set(documentsData?.map(d => d.uploaded_by).filter(Boolean))];
      const creatorIds = [...new Set(linksData?.map(l => l.created_by).filter(Boolean))];
      const allUserIds = [...new Set([...uploaderIds, ...creatorIds])];

      let userProfiles: Record<string, string> = {};
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', allUserIds);

        if (profiles) {
          userProfiles = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || 'Unknown';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      setFolders(foldersData || []);
      setDocuments(
        (documentsData || []).map(d => ({
          ...d,
          uploader_name: d.uploaded_by ? userProfiles[d.uploaded_by] : undefined,
        }))
      );
      setLinks(
        (linksData || []).map(l => ({
          ...l,
          creator_name: l.created_by ? userProfiles[l.created_by] : undefined,
        }))
      );
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, currentFolderId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!projectId) return;

    const documentsChannel = supabase
      .channel(`documents-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents', filter: `project_id=eq.${projectId}` },
        () => fetchData()
      )
      .subscribe();

    const linksChannel = supabase
      .channel(`document-links-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'document_links', filter: `project_id=eq.${projectId}` },
        () => fetchData()
      )
      .subscribe();

    const foldersChannel = supabase
      .channel(`document-folders-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'document_folders', filter: `project_id=eq.${projectId}` },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(documentsChannel);
      supabase.removeChannel(linksChannel);
      supabase.removeChannel(foldersChannel);
    };
  }, [projectId, fetchData]);

  const createFolder = async (name: string, departmentId?: string) => {
    if (!projectId || !user) return;

    try {
      const { error } = await supabase.from('document_folders').insert({
        project_id: projectId,
        department_id: departmentId || null,
        parent_folder_id: currentFolderId,
        name,
        created_by: user.id,
      });

      if (error) throw error;

      await supabase.from('document_audit_log').insert({
        folder_id: null,
        user_id: user.id,
        action: 'folder_created',
        details: { name, department_id: departmentId },
      });

      toast({ title: 'Folder created successfully' });
      fetchData();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: 'Error',
        description: 'Failed to create folder',
        variant: 'destructive',
      });
    }
  };

  const uploadDocument = async (file: File, departmentId?: string) => {
    if (!projectId || !user) return;

    try {
      const filePath = `${projectId}/${currentFolderId || 'root'}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('project-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('project-documents')
        .getPublicUrl(filePath);

      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          department_id: departmentId || null,
          folder_id: currentFolderId,
          name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (docError) throw docError;

      await supabase.from('document_audit_log').insert({
        document_id: docData.id,
        user_id: user.id,
        action: 'document_uploaded',
        details: { name: file.name, size: file.size, type: file.type },
      });

      toast({ title: 'Document uploaded successfully' });
      fetchData();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload document',
        variant: 'destructive',
      });
    }
  };

  const createLink = async (title: string, url: string, description?: string, departmentId?: string) => {
    if (!projectId || !user) return;

    try {
      const { data: linkData, error } = await supabase
        .from('document_links')
        .insert({
          project_id: projectId,
          department_id: departmentId || null,
          folder_id: currentFolderId,
          title,
          url,
          description,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('document_audit_log').insert({
        link_id: linkData.id,
        user_id: user.id,
        action: 'link_created',
        details: { title, url },
      });

      toast({ title: 'Link added successfully' });
      fetchData();
    } catch (error) {
      console.error('Error creating link:', error);
      toast({
        title: 'Error',
        description: 'Failed to add link',
        variant: 'destructive',
      });
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      await supabase.from('document_audit_log').insert({
        document_id: documentId,
        user_id: user.id,
        action: 'document_deleted',
      });

      toast({ title: 'Document deleted successfully' });
      fetchData();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    }
  };

  const deleteLink = async (linkId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('document_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      await supabase.from('document_audit_log').insert({
        link_id: linkId,
        user_id: user.id,
        action: 'link_deleted',
      });

      toast({ title: 'Link deleted successfully' });
      fetchData();
    } catch (error) {
      console.error('Error deleting link:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete link',
        variant: 'destructive',
      });
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('document_folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;

      await supabase.from('document_audit_log').insert({
        folder_id: folderId,
        user_id: user.id,
        action: 'folder_deleted',
      });

      toast({ title: 'Folder deleted successfully' });
      fetchData();
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete folder',
        variant: 'destructive',
      });
    }
  };

  const navigateToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
  };

  const getBreadcrumbs = async (): Promise<{ id: string | null; name: string }[]> => {
    const breadcrumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Documents' }];
    
    if (!currentFolderId) return breadcrumbs;

    let folderId: string | null = currentFolderId;
    const folderPath: { id: string; name: string }[] = [];

    while (folderId) {
      const { data: folder } = await supabase
        .from('document_folders')
        .select('id, name, parent_folder_id')
        .eq('id', folderId)
        .single();

      if (folder) {
        folderPath.unshift({ id: folder.id, name: folder.name });
        folderId = folder.parent_folder_id;
      } else {
        break;
      }
    }

    return [...breadcrumbs, ...folderPath];
  };

  // Filter by search query
  const filteredFolders = folders.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDocuments = documents.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredLinks = links.filter(l =>
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return {
    folders: filteredFolders,
    documents: filteredDocuments,
    links: filteredLinks,
    loading,
    currentFolderId,
    searchQuery,
    setSearchQuery,
    createFolder,
    uploadDocument,
    createLink,
    deleteDocument,
    deleteLink,
    deleteFolder,
    navigateToFolder,
    getBreadcrumbs,
    refetch: fetchData,
  };
}
