import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const queryKey = ['all-documents', projectId, currentFolderId];

  // Fetch data with React Query caching
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return { folders: [], documents: [], links: [] };

      // Fetch all data in parallel for better performance
      const [foldersResult, documentsResult, linksResult] = await Promise.all([
        currentFolderId
          ? supabase.from('document_folders').select('*').eq('project_id', projectId).eq('parent_folder_id', currentFolderId).order('name')
          : supabase.from('document_folders').select('*').eq('project_id', projectId).is('parent_folder_id', null).order('name'),
        currentFolderId
          ? supabase.from('documents').select('*').eq('project_id', projectId).eq('folder_id', currentFolderId).order('name')
          : supabase.from('documents').select('*').eq('project_id', projectId).is('folder_id', null).order('name'),
        currentFolderId
          ? supabase.from('document_links').select('*').eq('project_id', projectId).eq('folder_id', currentFolderId).order('title')
          : supabase.from('document_links').select('*').eq('project_id', projectId).is('folder_id', null).order('title'),
      ]);

      const foldersData = foldersResult.data || [];
      const documentsData = documentsResult.data || [];
      const linksData = linksResult.data || [];

      // Get uploader names for documents
      const uploaderIds = [...new Set(documentsData.map(d => d.uploaded_by).filter(Boolean))];
      const creatorIds = [...new Set(linksData.map(l => l.created_by).filter(Boolean))];
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

      return {
        folders: foldersData,
        documents: documentsData.map(d => ({
          ...d,
          uploader_name: d.uploaded_by ? userProfiles[d.uploaded_by] : undefined,
        })),
        links: linksData.map(l => ({
          ...l,
          creator_name: l.created_by ? userProfiles[l.created_by] : undefined,
        })),
      };
    },
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const folders = data?.folders || [];
  const documents = data?.documents || [];
  const links = data?.links || [];

  // Invalidate query helper
  const invalidateData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['all-documents', projectId] });
  }, [queryClient, projectId]);

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
      invalidateData();
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
      invalidateData();
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
      invalidateData();
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
      invalidateData();
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
      invalidateData();
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
      invalidateData();
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

  const getBreadcrumbs = useCallback(async (): Promise<{ id: string | null; name: string }[]> => {
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
  }, [currentFolderId]);

  // Filter by search query using useMemo for performance
  const filteredFolders = useMemo(() => 
    folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [folders, searchQuery]
  );
  
  const filteredDocuments = useMemo(() =>
    documents.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [documents, searchQuery]
  );
  
  const filteredLinks = useMemo(() =>
    links.filter(l =>
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.url.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [links, searchQuery]
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
    refetch,
  };
}
