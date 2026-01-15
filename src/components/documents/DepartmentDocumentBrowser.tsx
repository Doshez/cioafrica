import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserRole } from '@/hooks/useUserRole';
import { useDepartmentLead } from '@/hooks/useDepartmentLead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Folder,
  File,
  Link as LinkIcon,
  Search,
  Upload,
  MoreVertical,
  Trash2,
  Eye,
  Download,
  ChevronRight,
  FolderPlus,
  LinkIcon as Link2Icon,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  FileArchive,
  Shield,
  ArrowLeft,
  Lock,
  Info,
  MoveRight,
  CheckSquare,
  X,
  Trash2 as Trash2Icon,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreateFolderDialog } from './CreateFolderDialog';
import { CreateLinkDialog } from './CreateLinkDialog';
import { DocumentAccessDialog } from './DocumentAccessDialog';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';
import { MoveToDepartmentDialog } from './MoveToDepartmentDialog';
import { BulkMoveToDepartmentDialog } from './BulkMoveToDepartmentDialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface DocumentFolder {
  id: string;
  name: string;
  created_at: string;
  parent_folder_id: string | null;
}

interface Document {
  id: string;
  name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  uploader_name?: string;
}

interface DocumentLink {
  id: string;
  title: string;
  url: string;
  description: string | null;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
}

interface DepartmentDocumentBrowserProps {
  projectId: string;
  departmentId: string;
  departmentName: string;
  allDepartments?: Department[];
}

export function DepartmentDocumentBrowser({ projectId, departmentId, departmentName, allDepartments = [] }: DepartmentDocumentBrowserProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isProjectManager } = useUserRole();
  const { isCurrentUserLead } = useDepartmentLead(departmentId);
  
  const canManage = isAdmin || isProjectManager || isCurrentUserLead;

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createLinkOpen, setCreateLinkOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    type: 'document' | 'link' | 'folder';
    item: any;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Move dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveItem, setMoveItem] = useState<{ type: 'folder' | 'document' | 'link'; id: string; name: string; departmentId: string | null } | null>(null);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);

  // Query key for caching
  const queryKey = ['department-documents', departmentId, currentFolderId];

  // Fetch documents data with React Query
  const { data, isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      // Build folder query
      let foldersQuery = supabase
        .from('document_folders')
        .select('*')
        .eq('project_id', projectId)
        .eq('department_id', departmentId);
      
      if (currentFolderId) {
        foldersQuery = foldersQuery.eq('parent_folder_id', currentFolderId);
      } else {
        foldersQuery = foldersQuery.is('parent_folder_id', null);
      }

      // Build documents query
      let documentsQuery = supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .eq('department_id', departmentId);
      
      if (currentFolderId) {
        documentsQuery = documentsQuery.eq('folder_id', currentFolderId);
      } else {
        documentsQuery = documentsQuery.is('folder_id', null);
      }

      // Build links query
      let linksQuery = supabase
        .from('document_links')
        .select('*')
        .eq('project_id', projectId)
        .eq('department_id', departmentId);
      
      if (currentFolderId) {
        linksQuery = linksQuery.eq('folder_id', currentFolderId);
      } else {
        linksQuery = linksQuery.is('folder_id', null);
      }

      // Fetch all data in parallel
      const [foldersResult, documentsResult, linksResult] = await Promise.all([
        foldersQuery.order('name'),
        documentsQuery.order('name'),
        linksQuery.order('title'),
      ]);

      const foldersData = foldersResult.data || [];
      const documentsData = documentsResult.data || [];
      const linksData = linksResult.data || [];

      // Get uploader names
      const uploaderIds = [...new Set(documentsData.map(d => d.uploaded_by).filter(Boolean))];
      let userProfiles: Record<string, string> = {};
      
      if (uploaderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uploaderIds);

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
        links: linksData,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const folders = data?.folders || [];
  const documents = data?.documents || [];
  const links = data?.links || [];

  // Build breadcrumbs
  const { data: breadcrumbs = [{ id: null, name: departmentName }] } = useQuery({
    queryKey: ['breadcrumbs', departmentId, currentFolderId],
    queryFn: async () => {
      const crumbs: { id: string | null; name: string }[] = [{ id: null, name: departmentName }];
      
      if (!currentFolderId) return crumbs;

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

      return [...crumbs, ...folderPath];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Invalidate query on mutations - only invalidate this department's queries
  const invalidateData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['department-documents', departmentId] });
    queryClient.invalidateQueries({ queryKey: ['breadcrumbs', departmentId] });
  }, [queryClient, departmentId]);

  // Real-time subscription for document changes - unique channel per department
  useEffect(() => {
    const channelName = `dept-docs-${projectId}-${departmentId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_access',
        },
        () => {
          invalidateData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `department_id=eq.${departmentId}`,
        },
        () => invalidateData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_links',
          filter: `department_id=eq.${departmentId}`,
        },
        () => invalidateData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_folders',
          filter: `department_id=eq.${departmentId}`,
        },
        () => invalidateData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, departmentId, invalidateData]);

  // Only allow uploads inside folders (not at root level) for non-managers
  const canUploadHere = canManage || currentFolderId !== null;

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !user) return;

    // Enforce folder-based uploads for non-managers
    if (!canManage && !currentFolderId) {
      toast({ 
        title: 'Upload Restricted', 
        description: 'Files must be uploaded inside a folder. Please navigate to a folder first.',
        variant: 'destructive' 
      });
      return;
    }

    for (const file of Array.from(files)) {
      try {
        const filePath = `${projectId}/${departmentId}/${currentFolderId || 'root'}/${Date.now()}-${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('project-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('project-documents')
          .getPublicUrl(filePath);

        await supabase.from('documents').insert({
          project_id: projectId,
          department_id: departmentId,
          folder_id: currentFolderId,
          name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user.id,
        });

        await supabase.from('document_audit_log').insert({
          user_id: user.id,
          action: 'document_uploaded',
          details: { name: file.name, size: file.size, type: file.type, department_id: departmentId },
        });

        toast({ title: 'Document uploaded successfully' });
        invalidateData();
      } catch (error) {
        console.error('Error uploading document:', error);
        toast({ title: 'Error', description: 'Failed to upload document', variant: 'destructive' });
      }
    }
  };

  const handleCreateFolder = async (name: string) => {
    if (!user) return;

    try {
      await supabase.from('document_folders').insert({
        project_id: projectId,
        department_id: departmentId,
        parent_folder_id: currentFolderId,
        name,
        created_by: user.id,
      });

      toast({ title: 'Folder created successfully' });
      invalidateData();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({ title: 'Error', description: 'Failed to create folder', variant: 'destructive' });
    }
  };

  const handleCreateLink = async (title: string, url: string, description?: string) => {
    if (!user) return;

    try {
      await supabase.from('document_links').insert({
        project_id: projectId,
        department_id: departmentId,
        folder_id: currentFolderId,
        title,
        url,
        description,
        created_by: user.id,
      });

      toast({ title: 'Link added successfully' });
      invalidateData();
    } catch (error) {
      console.error('Error creating link:', error);
      toast({ title: 'Error', description: 'Failed to add link', variant: 'destructive' });
    }
  };

  const handleDelete = async (type: 'document' | 'link' | 'folder', id: string) => {
    try {
      const table = type === 'document' ? 'documents' : type === 'link' ? 'document_links' : 'document_folders';
      await supabase.from(table).delete().eq('id', id);
      toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully` });
      invalidateData();
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      toast({ title: 'Error', description: `Failed to delete ${type}`, variant: 'destructive' });
    }
  };

  // Handle moving items between departments
  const handleMoveToDepartment = async (targetDepartmentId: string | null) => {
    if (!moveItem) return;
    const table = moveItem.type === 'folder' ? 'document_folders' : moveItem.type === 'document' ? 'documents' : 'document_links';
    
    // When moving to a different department, also clear folder_id to move to root
    const updateData: { department_id: string | null; folder_id?: null; parent_folder_id?: null } = { 
      department_id: targetDepartmentId 
    };
    
    // Clear folder association when moving between departments
    if (moveItem.type === 'folder') {
      updateData.parent_folder_id = null;
    } else {
      updateData.folder_id = null;
    }
    
    const { error } = await supabase.from(table).update(updateData).eq('id', moveItem.id);
    if (error) {
      toast({ title: 'Failed to move item', variant: 'destructive' });
      return;
    }
    const targetName = targetDepartmentId ? allDepartments.find(d => d.id === targetDepartmentId)?.name || 'department' : 'General';
    toast({ title: `Moved "${moveItem.name}" to ${targetName}` });
    queryClient.invalidateQueries({ queryKey: ['department-documents'] });
    queryClient.invalidateQueries({ queryKey: ['unified-folders'] });
    queryClient.invalidateQueries({ queryKey: ['unified-documents'] });
    queryClient.invalidateQueries({ queryKey: ['unified-links'] });
    setMoveItem(null);
  };

  const openMoveDialog = (type: 'folder' | 'document' | 'link', id: string, name: string) => {
    setMoveItem({ type, id, name, departmentId });
    setMoveDialogOpen(true);
  };

  // Selection handlers
  const toggleItemSelection = (itemId: string, itemType: string) => {
    const key = `${itemType}:${itemId}`;
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isItemSelected = (itemId: string, itemType: string) => {
    return selectedItems.has(`${itemType}:${itemId}`);
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
    setSelectionMode(false);
  };

  const selectAllVisible = () => {
    const allItems = new Set<string>();
    filteredFolders.forEach(f => allItems.add(`folder:${f.id}`));
    filteredDocuments.forEach(d => allItems.add(`document:${d.id}`));
    filteredLinks.forEach(l => allItems.add(`link:${l.id}`));
    setSelectedItems(allItems);
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedItems.size} items? This action cannot be undone.`);
    if (!confirmed) return;

    let deleted = 0;
    for (const item of selectedItems) {
      const [type, id] = item.split(':');
      const table = type === 'folder' ? 'document_folders' : type === 'document' ? 'documents' : 'document_links';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (!error) deleted++;
    }

    toast({ title: `Deleted ${deleted} items` });
    clearSelection();
    invalidateData();
  };

  // Bulk move handler
  const handleBulkMove = async (targetDepartmentId: string | null) => {
    if (selectedItems.size === 0) return;

    let moved = 0;
    for (const item of selectedItems) {
      const [type, id] = item.split(':');
      const table = type === 'folder' ? 'document_folders' : type === 'document' ? 'documents' : 'document_links';
      
      // When moving to a different department, also clear folder_id to move to root
      const updateData: { department_id: string | null; folder_id?: null; parent_folder_id?: null } = { 
        department_id: targetDepartmentId 
      };
      
      if (type === 'folder') {
        updateData.parent_folder_id = null;
      } else {
        updateData.folder_id = null;
      }
      
      const { error } = await supabase.from(table).update(updateData).eq('id', id);
      if (!error) moved++;
    }

    const targetName = targetDepartmentId 
      ? allDepartments.find(d => d.id === targetDepartmentId)?.name || 'department'
      : 'General';
    toast({ title: `Moved ${moved} items to ${targetName}` });
    clearSelection();
    invalidateData();
    queryClient.invalidateQueries({ queryKey: ['unified-folders'] });
    queryClient.invalidateQueries({ queryKey: ['unified-documents'] });
    queryClient.invalidateQueries({ queryKey: ['unified-links'] });
  };

  // Get selected items for bulk move dialog
  const getSelectedItemsForBulkMove = () => {
    return Array.from(selectedItems).map(item => {
      const [type, id] = item.split(':');
      return { type: type as 'folder' | 'document' | 'link', id };
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="h-8 w-8 text-muted-foreground" />;
    
    if (fileType.includes('image')) return <FileImage className="h-8 w-8 text-blue-500" />;
    if (fileType.includes('video')) return <FileVideo className="h-8 w-8 text-purple-500" />;
    if (fileType.includes('audio')) return <FileAudio className="h-8 w-8 text-pink-500" />;
    if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('csv')) 
      return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('archive'))
      return <FileArchive className="h-8 w-8 text-amber-500" />;
    if (fileType.includes('pdf') || fileType.includes('document') || fileType.includes('text'))
      return <FileText className="h-8 w-8 text-red-500" />;
    
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredDocuments = documents.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredLinks = links.filter(l => l.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Documents & Links
            <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              <Lock className="h-3 w-3" />
              Access Controlled
            </span>
          </CardTitle>
          
          {canManage && (
            <div className="flex items-center gap-2">
              <Button
                variant={selectionMode ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => selectionMode ? clearSelection() : setSelectionMode(true)}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                {selectionMode ? 'Cancel' : 'Select'}
              </Button>
              {!selectionMode && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setCreateFolderOpen(true)}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New Folder
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCreateLinkOpen(true)}>
                    <Link2Icon className="h-4 w-4 mr-2" />
                    Add Link
                  </Button>
                  <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Access info alert */}
        {!canManage && (
          <Alert className="mt-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              You can only see folders and files you have been granted access to. Contact a department lead or manager to request access.
            </AlertDescription>
          </Alert>
        )}

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm mt-4">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id || 'root'} className="flex items-center">
              {index > 0 && <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />}
              <button
                onClick={() => setCurrentFolderId(crumb.id)}
                className={cn(
                  "hover:text-primary transition-colors",
                  index === breadcrumbs.length - 1 ? "font-medium" : "text-muted-foreground"
                )}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents, folders, and links..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>

      <CardContent>
        {/* Upload restriction notice at root level for non-managers */}
        {!canManage && !currentFolderId && (
          <Alert className="mb-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <Lock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              To upload files, navigate to a folder you have access to. Files must be organized within folders.
            </AlertDescription>
          </Alert>
        )}

        {/* Bulk selection bar */}
        {selectionMode && selectedItems.size > 0 && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
            <span className="text-sm font-medium">{selectedItems.size} item(s) selected</span>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={selectAllVisible}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                <X className="h-4 w-4 mr-1" />Clear
              </Button>
              {canManage && allDepartments.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setBulkMoveDialogOpen(true)}>
                  <MoveRight className="h-4 w-4 mr-2" />Move to Department
                </Button>
              )}
              {canManage && (
                <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                  <Trash2Icon className="h-4 w-4 mr-2" />Delete Selected
                </Button>
              )}
            </div>
          </div>
        )}

        {currentFolderId && (
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => setCurrentFolderId(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        )}

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg transition-colors min-h-[300px]",
            isDragging ? "border-primary bg-primary/5" : "border-transparent"
          )}
        >
          {isDragging ? (
            <div className="flex flex-col items-center justify-center h-[300px]">
              <Upload className="h-12 w-12 text-primary mb-4" />
              <p className="text-lg font-medium">Drop files to upload</p>
            </div>
          ) : filteredFolders.length === 0 && filteredDocuments.length === 0 && filteredLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Folder className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No documents yet</p>
              <p className="text-sm">Upload files or create folders to get started</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-6">
                {/* Folders Section */}
                {filteredFolders.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/30">
                        <Folder className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Folders</h3>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {filteredFolders.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredFolders.map((folder) => (
                        <div
                          key={folder.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all cursor-pointer group",
                            isItemSelected(folder.id, 'folder') && "ring-2 ring-primary bg-primary/5"
                          )}
                          onClick={() => !selectionMode && setCurrentFolderId(folder.id)}
                        >
                          {selectionMode && (
                            <Checkbox 
                              checked={isItemSelected(folder.id, 'folder')}
                              onCheckedChange={() => toggleItemSelection(folder.id, 'folder')}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                            <Folder className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{folder.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(folder.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          {canManage && !selectionMode && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedItem({ type: 'folder', item: folder }); setAccessDialogOpen(true); }}>
                                  <Shield className="h-4 w-4 mr-2" />
                                  Manage Access
                                </DropdownMenuItem>
                                {allDepartments.length > 0 && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openMoveDialog('folder', folder.id, folder.name); }}>
                                    <MoveRight className="h-4 w-4 mr-2" />
                                    Move to Department
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete('folder', folder.id); }}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files Section */}
                {filteredDocuments.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/30">
                        <File className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Files</h3>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {filteredDocuments.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {filteredDocuments.map((doc) => (
                        <div key={doc.id} className={cn(
                          "flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all group",
                          isItemSelected(doc.id, 'document') && "ring-2 ring-primary bg-primary/5"
                        )}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {selectionMode && (
                              <Checkbox 
                                checked={isItemSelected(doc.id, 'document')}
                                onCheckedChange={() => toggleItemSelection(doc.id, 'document')}
                              />
                            )}
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              {getFileIcon(doc.file_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(doc.file_size)} • {doc.uploader_name || 'Unknown'} • {format(new Date(doc.created_at), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                          
                          {!selectionMode && (
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => { setSelectedItem({ type: 'document', item: doc }); setPreviewDialogOpen(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => window.open(doc.file_url, '_blank')}>
                                <Download className="h-4 w-4" />
                              </Button>
                              
                              {canManage && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => { setSelectedItem({ type: 'document', item: doc }); setAccessDialogOpen(true); }}>
                                      <Shield className="h-4 w-4 mr-2" />
                                      Manage Access
                                    </DropdownMenuItem>
                                    {allDepartments.length > 0 && (
                                      <DropdownMenuItem onClick={() => openMoveDialog('document', doc.id, doc.name)}>
                                        <MoveRight className="h-4 w-4 mr-2" />
                                        Move to Department
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete('document', doc.id)}>
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links Section */}
                {filteredLinks.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/30">
                        <LinkIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Links</h3>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {filteredLinks.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredLinks.map((link) => (
                        <div key={link.id} className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-all group",
                          isItemSelected(link.id, 'link') && "ring-2 ring-primary bg-primary/5"
                        )}>
                          {selectionMode && (
                            <Checkbox 
                              checked={isItemSelected(link.id, 'link')}
                              onCheckedChange={() => toggleItemSelection(link.id, 'link')}
                            />
                          )}
                          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                            <LinkIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{link.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                            {link.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{link.description}</p>}
                          </div>
                          
                          {!selectionMode && (
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => window.open(link.url, '_blank')}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              {canManage && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => { setSelectedItem({ type: 'link', item: link }); setAccessDialogOpen(true); }}>
                                      <Shield className="h-4 w-4 mr-2" />
                                      Manage Access
                                    </DropdownMenuItem>
                                    {allDepartments.length > 0 && (
                                      <DropdownMenuItem onClick={() => openMoveDialog('link', link.id, link.title)}>
                                        <MoveRight className="h-4 w-4 mr-2" />
                                        Move to Department
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete('link', link.id)}>
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>

      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        onCreateFolder={handleCreateFolder}
        departments={[]}
        defaultDepartmentId={departmentId}
        showDepartmentSelect={false}
      />

      <CreateLinkDialog
        open={createLinkOpen}
        onOpenChange={setCreateLinkOpen}
        onCreateLink={handleCreateLink}
        departments={[]}
        defaultDepartmentId={departmentId}
        showDepartmentSelect={false}
      />

      {selectedItem && accessDialogOpen && (
        <DocumentAccessDialog
          open={accessDialogOpen}
          onOpenChange={setAccessDialogOpen}
          itemId={selectedItem.item.id}
          itemType={selectedItem.type}
          itemName={selectedItem.type === 'document' ? selectedItem.item.name : selectedItem.type === 'link' ? selectedItem.item.title : selectedItem.item.name}
          projectId={projectId}
        />
      )}

      {selectedItem?.type === 'document' && previewDialogOpen && (
        <DocumentPreviewDialog
          open={previewDialogOpen}
          onOpenChange={setPreviewDialogOpen}
          document={selectedItem.item}
        />
      )}

      {moveItem && allDepartments.length > 0 && (
        <MoveToDepartmentDialog
          open={moveDialogOpen}
          onOpenChange={(open) => { setMoveDialogOpen(open); if (!open) setMoveItem(null); }}
          itemType={moveItem.type}
          itemName={moveItem.name}
          currentDepartmentId={departmentId}
          departments={allDepartments}
          onMove={handleMoveToDepartment}
        />
      )}
      {allDepartments.length > 0 && (
        <BulkMoveToDepartmentDialog
          open={bulkMoveDialogOpen}
          onOpenChange={setBulkMoveDialogOpen}
          selectedItems={getSelectedItemsForBulkMove()}
          departments={allDepartments}
          onMove={handleBulkMove}
        />
      )}
    </Card>
  );
}
