import { useState, useMemo, useCallback, DragEvent, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Folder, Link2, Search, Building2, ExternalLink, MoreVertical, 
  Trash2, Download, Eye, ChevronRight, ArrowLeft, FolderPlus, 
  Upload, LinkIcon, GripVertical, LayoutGrid, List, CheckSquare,
  X, Cloud, Users, Share2
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { CreateFolderDialog } from './CreateFolderDialog';
import { CreateLinkDialog } from './CreateLinkDialog';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';
import { DocumentAccessDialog } from './DocumentAccessDialog';
import { DuplicateItemDialog, DuplicateItem } from './DuplicateItemDialog';
import { CloudProviderIcon, CloudProviderBadge } from './CloudProviderIcon';
import { FileTypeIcon } from './FileTypeIcon';
import { formatFileSize, extractDomain } from '@/lib/cloudProviders';
import { Document as DocType } from '@/hooks/useDocumentManagement';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Department { id: string; name: string; }
interface UnifiedDocumentBrowserProps { projectId: string; departments: Department[]; canManage: boolean; }

type ViewMode = 'grid' | 'list';

export function UnifiedDocumentBrowser({ projectId, departments, canManage }: UnifiedDocumentBrowserProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<'folders' | 'links'>('folders');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createLinkOpen, setCreateLinkOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocType | null>(null);
  const [accessDialogItem, setAccessDialogItem] = useState<{ type: 'folder' | 'document' | 'link'; id: string; name: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Duplicate detection state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateItem, setDuplicateItem] = useState<DuplicateItem | null>(null);
  const pendingFileRef = useRef<{ file: File; departmentId?: string } | null>(null);
  
  // Drag and drop state
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);

  const departmentMap = useMemo(() => {
    const map: Record<string, string> = {};
    departments.forEach(d => { map[d.id] = d.name; });
    return map;
  }, [departments]);

  const { data: allFolders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['unified-folders', projectId, currentFolderId],
    queryFn: async () => {
      const query = currentFolderId
        ? supabase.from('document_folders').select('*').eq('project_id', projectId).eq('parent_folder_id', currentFolderId)
        : supabase.from('document_folders').select('*').eq('project_id', projectId).is('parent_folder_id', null);
      const { data } = await query.order('name');
      return (data || []).map(f => ({ ...f, department_name: f.department_id ? departmentMap[f.department_id] : 'General' }));
    },
    enabled: !!projectId,
  });

  const { data: allDocuments = [], isLoading: docsLoading } = useQuery({
    queryKey: ['unified-documents', projectId, currentFolderId],
    queryFn: async () => {
      const query = currentFolderId
        ? supabase.from('documents').select('*').eq('project_id', projectId).eq('folder_id', currentFolderId)
        : supabase.from('documents').select('*').eq('project_id', projectId).is('folder_id', null);
      const { data } = await query.order('name');
      return (data || []).map(d => ({ ...d, department_name: d.department_id ? departmentMap[d.department_id] : 'General' }));
    },
    enabled: !!projectId,
  });

  const { data: allLinks = [], isLoading: linksLoading } = useQuery({
    queryKey: ['unified-links', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('document_links').select('*').eq('project_id', projectId).order('title');
      return (data || []).map(l => ({ ...l, department_name: l.department_id ? departmentMap[l.department_id] : 'General' }));
    },
    enabled: !!projectId,
  });

  const { data: breadcrumbs = [] } = useQuery({
    queryKey: ['folder-breadcrumbs', currentFolderId],
    queryFn: async () => {
      const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'All Folders' }];
      if (!currentFolderId) return crumbs;
      let folderId: string | null = currentFolderId;
      const folderPath: { id: string; name: string }[] = [];
      while (folderId) {
        const { data: folder } = await supabase.from('document_folders').select('id, name, parent_folder_id').eq('id', folderId).single();
        if (folder) { folderPath.unshift({ id: folder.id, name: folder.name }); folderId = folder.parent_folder_id; } else break;
      }
      return [...crumbs, ...folderPath];
    },
    enabled: !!currentFolderId,
  });

  const filteredFolders = useMemo(() => allFolders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()) && (departmentFilter === 'all' || (departmentFilter === 'general' ? !f.department_id : f.department_id === departmentFilter))), [allFolders, searchQuery, departmentFilter]);
  const filteredDocuments = useMemo(() => allDocuments.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()) && (departmentFilter === 'all' || (departmentFilter === 'general' ? !d.department_id : d.department_id === departmentFilter))), [allDocuments, searchQuery, departmentFilter]);
  const filteredLinks = useMemo(() => allLinks.filter(l => (l.title.toLowerCase().includes(searchQuery.toLowerCase()) || l.url.toLowerCase().includes(searchQuery.toLowerCase())) && (departmentFilter === 'all' || (departmentFilter === 'general' ? !l.department_id : l.department_id === departmentFilter))), [allLinks, searchQuery, departmentFilter]);

  // Existing links for duplicate detection
  const existingLinksForDuplicateCheck = useMemo(() => 
    allLinks.map(l => ({ id: l.id, title: l.title, url: l.url })), 
    [allLinks]
  );

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['unified-folders'] });
    queryClient.invalidateQueries({ queryKey: ['unified-documents'] });
    queryClient.invalidateQueries({ queryKey: ['unified-links'] });
    queryClient.invalidateQueries({ queryKey: ['department-documents'] });
  }, [queryClient]);

  // Real-time subscription for document_access changes
  useEffect(() => {
    const channel = supabase
      .channel('document-access-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_access',
        },
        () => {
          // Invalidate all document queries when access changes
          invalidateQueries();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
        },
        () => invalidateQueries()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_links',
        },
        () => invalidateQueries()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_folders',
        },
        () => invalidateQueries()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invalidateQueries]);

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
    if (activeTab === 'folders') {
      filteredFolders.forEach(f => allItems.add(`folder:${f.id}`));
      filteredDocuments.forEach(d => allItems.add(`document:${d.id}`));
    } else {
      filteredLinks.forEach(l => allItems.add(`link:${l.id}`));
    }
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
    invalidateQueries();
  };

  // Check for duplicate folder
  const checkDuplicateFolder = async (name: string, departmentId?: string): Promise<{ exists: boolean; existing?: any }> => {
    const query = currentFolderId
      ? supabase.from('document_folders').select('*').eq('project_id', projectId).eq('parent_folder_id', currentFolderId).ilike('name', name)
      : supabase.from('document_folders').select('*').eq('project_id', projectId).is('parent_folder_id', null).ilike('name', name);
    
    const { data } = await query;
    const existing = data?.find(f => f.name.toLowerCase() === name.toLowerCase());
    return { exists: !!existing, existing };
  };

  // Check for duplicate document
  const checkDuplicateDocument = async (name: string): Promise<{ exists: boolean; existing?: any }> => {
    const query = currentFolderId
      ? supabase.from('documents').select('*').eq('project_id', projectId).eq('folder_id', currentFolderId).ilike('name', name)
      : supabase.from('documents').select('*').eq('project_id', projectId).is('folder_id', null).ilike('name', name);
    
    const { data } = await query;
    const existing = data?.find(d => d.name.toLowerCase() === name.toLowerCase());
    return { exists: !!existing, existing };
  };

  // Check for duplicate link
  const checkDuplicateLink = async (title: string): Promise<{ exists: boolean; existing?: any }> => {
    const { data } = await supabase.from('document_links').select('*').eq('project_id', projectId).ilike('title', title);
    const existing = data?.find(l => l.title.toLowerCase() === title.toLowerCase());
    return { exists: !!existing, existing };
  };

  const handleCreateFolder = async (name: string, departmentId?: string) => {
    if (!projectId || !user) return;
    
    const { exists, existing } = await checkDuplicateFolder(name, departmentId);
    if (exists && existing) {
      setDuplicateItem({
        type: 'folder',
        existingId: existing.id,
        existingName: existing.name,
        existingCreatedAt: existing.created_at,
        existingDepartment: existing.department_id ? departmentMap[existing.department_id] : 'General',
        newName: name,
        departmentId,
      });
      setDuplicateDialogOpen(true);
      return;
    }

    await createFolderDirectly(name, departmentId);
  };

  const createFolderDirectly = async (name: string, departmentId?: string) => {
    if (!projectId || !user) return;
    const { error } = await supabase.from('document_folders').insert({ project_id: projectId, department_id: departmentId || null, parent_folder_id: currentFolderId, name, created_by: user.id });
    if (!error) { toast({ title: 'Folder created' }); invalidateQueries(); setCreateFolderOpen(false); } else toast({ title: 'Error', variant: 'destructive' });
  };

  const handleCreateLink = async (title: string, url: string, description?: string, departmentId?: string) => {
    if (!projectId || !user) return;
    
    const { exists, existing } = await checkDuplicateLink(title);
    if (exists && existing) {
      setDuplicateItem({
        type: 'link',
        existingId: existing.id,
        existingName: existing.title,
        existingCreatedAt: existing.created_at,
        existingDepartment: existing.department_id ? departmentMap[existing.department_id] : 'General',
        newName: title,
        newUrl: url,
        newDescription: description,
        departmentId,
      });
      setDuplicateDialogOpen(true);
      return;
    }

    await createLinkDirectly(title, url, description, departmentId);
  };

  const createLinkDirectly = async (title: string, url: string, description?: string, departmentId?: string) => {
    if (!projectId || !user) return;
    const { error } = await supabase.from('document_links').insert({ project_id: projectId, department_id: departmentId || null, folder_id: currentFolderId, title, url, description, created_by: user.id });
    if (!error) { toast({ title: 'Link added' }); invalidateQueries(); setCreateLinkOpen(false); } else toast({ title: 'Error', variant: 'destructive' });
  };

  const handleDelete = async (type: 'folder' | 'document' | 'link', id: string) => {
    const table = type === 'folder' ? 'document_folders' : type === 'document' ? 'documents' : 'document_links';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) { toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted` }); invalidateQueries(); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !projectId) return;
    if (!canManage && !currentFolderId) { toast({ title: 'Upload restricted', description: 'Navigate into a folder first', variant: 'destructive' }); e.target.value = ''; return; }
    
    const { exists, existing } = await checkDuplicateDocument(file.name);
    if (exists && existing) {
      pendingFileRef.current = { file };
      setDuplicateItem({
        type: 'document',
        existingId: existing.id,
        existingName: existing.name,
        existingCreatedAt: existing.created_at,
        existingDepartment: existing.department_id ? departmentMap[existing.department_id] : 'General',
        newName: file.name,
        newFile: file,
      });
      setDuplicateDialogOpen(true);
      e.target.value = '';
      return;
    }

    await uploadDocumentDirectly(file);
    e.target.value = '';
  };

  const uploadDocumentDirectly = async (file: File, customName?: string) => {
    if (!user || !projectId) return;
    const fileName = customName || file.name;
    const filePath = `${projectId}/${currentFolderId || 'root'}/${Date.now()}-${fileName}`;
    const { error: uploadError } = await supabase.storage.from('project-documents').upload(filePath, file);
    if (uploadError) { toast({ title: 'Upload failed', variant: 'destructive' }); return; }
    const { data: urlData } = supabase.storage.from('project-documents').getPublicUrl(filePath);
    await supabase.from('documents').insert({ project_id: projectId, folder_id: currentFolderId, name: fileName, file_url: urlData.publicUrl, file_type: file.type, file_size: file.size, uploaded_by: user.id });
    toast({ title: 'Document uploaded' }); invalidateQueries();
  };

  // Handle duplicate resolution
  const handleDuplicateReplace = async () => {
    if (!duplicateItem || !user || !projectId) return;

    if (duplicateItem.type === 'folder') {
      await supabase.from('document_folders').delete().eq('id', duplicateItem.existingId);
      await createFolderDirectly(duplicateItem.newName, duplicateItem.departmentId);
    } else if (duplicateItem.type === 'document' && duplicateItem.newFile) {
      await supabase.from('documents').delete().eq('id', duplicateItem.existingId);
      await uploadDocumentDirectly(duplicateItem.newFile);
    } else if (duplicateItem.type === 'link' && duplicateItem.newUrl) {
      await supabase.from('document_links').delete().eq('id', duplicateItem.existingId);
      await createLinkDirectly(duplicateItem.newName, duplicateItem.newUrl, duplicateItem.newDescription, duplicateItem.departmentId);
    }

    pendingFileRef.current = null;
  };

  const handleDuplicateRename = async (newName: string) => {
    if (!duplicateItem || !user || !projectId) return;

    if (duplicateItem.type === 'folder') {
      await createFolderDirectly(newName, duplicateItem.departmentId);
    } else if (duplicateItem.type === 'document' && duplicateItem.newFile) {
      await uploadDocumentDirectly(duplicateItem.newFile, newName);
    } else if (duplicateItem.type === 'link' && duplicateItem.newUrl) {
      await createLinkDirectly(newName, duplicateItem.newUrl, duplicateItem.newDescription, duplicateItem.departmentId);
    }

    pendingFileRef.current = null;
  };

  const handleDuplicateCancel = () => {
    setDuplicateItem(null);
    pendingFileRef.current = null;
  };

  // Drag and Drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, docId: string, docName: string) => {
    e.dataTransfer.setData('text/plain', docId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedDocId(docId);
    
    const dragImage = document.createElement('div');
    dragImage.className = 'bg-background border rounded-lg px-3 py-2 shadow-lg text-sm font-medium';
    dragImage.textContent = docName;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = () => {
    setDraggedDocId(null);
    setDropTargetFolderId(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetFolderId(folderId);
  };

  const handleDragLeave = () => {
    setDropTargetFolderId(null);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetFolderId: string) => {
    e.preventDefault();
    const docId = e.dataTransfer.getData('text/plain');
    
    if (!docId || !canManage) {
      setDraggedDocId(null);
      setDropTargetFolderId(null);
      return;
    }

    try {
      const { error } = await supabase.from('documents').update({ folder_id: targetFolderId }).eq('id', docId);
      if (error) throw error;
      toast({ title: 'File moved successfully' });
      invalidateQueries();
    } catch (error) {
      console.error('Error moving document:', error);
      toast({ title: 'Move failed', variant: 'destructive' });
    }

    setDraggedDocId(null);
    setDropTargetFolderId(null);
  };

  const loading = foldersLoading || docsLoading || linksLoading;

  // Render functions for grid and list views
  const renderFolderCard = (f: any) => (
    <Card 
      key={f.id} 
      className={`group cursor-pointer transition-all ${
        dropTargetFolderId === f.id 
          ? 'ring-2 ring-primary bg-primary/5 shadow-lg scale-[1.02]' 
          : 'hover:shadow-md'
      } ${isItemSelected(f.id, 'folder') ? 'ring-2 ring-primary' : ''}`}
      onClick={() => !draggedDocId && !selectionMode && setCurrentFolderId(f.id)}
    >
      <CardContent className="p-4 flex items-start justify-between"
        onDragOver={(e) => handleDragOver(e, f.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, f.id)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {selectionMode && (
            <Checkbox 
              checked={isItemSelected(f.id, 'folder')}
              onCheckedChange={() => toggleItemSelection(f.id, 'folder')}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className={`p-2 rounded-lg transition-colors ${
            dropTargetFolderId === f.id ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
          }`}>
            <Folder className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{f.name}</p>
            <Badge variant="outline" className="text-xs mt-1"><Building2 className="h-3 w-3 mr-1" />{f.department_name}</Badge>
          </div>
        </div>
        {canManage && !draggedDocId && !selectionMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={e => { e.stopPropagation(); setAccessDialogItem({ type: 'folder', id: f.id, name: f.name }); }}>
                <Users className="h-4 w-4 mr-2" />Manage Access
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDelete('folder', f.id); }} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardContent>
    </Card>
  );

  const renderDocumentCard = (d: any) => (
    <Card 
      key={d.id} 
      className={`group transition-all ${
        draggedDocId === d.id ? 'opacity-50 scale-95' : 'hover:shadow-md'
      } ${canManage && !selectionMode ? 'cursor-grab active:cursor-grabbing' : ''} ${isItemSelected(d.id, 'document') ? 'ring-2 ring-primary' : ''}`}
      draggable={canManage && !selectionMode}
      onDragStart={(e) => handleDragStart(e, d.id, d.name)}
      onDragEnd={handleDragEnd}
    >
      <CardContent className="p-4 flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {selectionMode ? (
            <Checkbox 
              checked={isItemSelected(d.id, 'document')}
              onCheckedChange={() => toggleItemSelection(d.id, 'document')}
            />
          ) : canManage && (
            <div className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors cursor-grab">
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <FileTypeIcon fileType={d.file_type} fileName={d.name} />
          <div className="min-w-0">
            <p className="font-medium truncate">{d.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(d.file_size)}</p>
            <Badge variant="outline" className="text-xs mt-1"><Building2 className="h-3 w-3 mr-1" />{d.department_name}</Badge>
          </div>
        </div>
        {!selectionMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPreviewDoc(d as DocType)}>
                <Eye className="h-4 w-4 mr-2" />Preview
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={d.file_url} download target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" />Download
                </a>
              </DropdownMenuItem>
              {canManage && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setAccessDialogItem({ type: 'document', id: d.id, name: d.name })}>
                    <Users className="h-4 w-4 mr-2" />Manage Access
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDelete('document', d.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardContent>
    </Card>
  );

  const renderLinkCard = (l: any) => (
    <Card key={l.id} className={`group hover:shadow-md transition-all ${isItemSelected(l.id, 'link') ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {selectionMode && (
            <Checkbox 
              checked={isItemSelected(l.id, 'link')}
              onCheckedChange={() => toggleItemSelection(l.id, 'link')}
            />
          )}
          <CloudProviderIcon url={l.url} className="h-5 w-5" />
          <div className="min-w-0 flex-1">
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-medium truncate block hover:text-primary">
              {l.title}
            </a>
            {l.description && <p className="text-xs text-muted-foreground line-clamp-1">{l.description}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <CloudProviderBadge url={l.url} />
              <Badge variant="outline" className="text-xs"><Building2 className="h-3 w-3 mr-1" />{l.department_name}</Badge>
            </div>
          </div>
        </div>
        {!selectionMode && (
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open in new tab</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setAccessDialogItem({ type: 'link', id: l.id, name: l.title })}>
                    <Users className="h-4 w-4 mr-2" />Manage Access
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleDelete('link', l.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // List view render functions
  const renderFolderListItem = (f: any) => (
    <div 
      key={f.id}
      className={`flex items-center gap-4 p-3 rounded-lg border transition-all cursor-pointer ${
        dropTargetFolderId === f.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
      } ${isItemSelected(f.id, 'folder') ? 'ring-2 ring-primary bg-primary/5' : ''}`}
      onClick={() => !draggedDocId && !selectionMode && setCurrentFolderId(f.id)}
      onDragOver={(e) => handleDragOver(e, f.id)}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e, f.id)}
    >
      {selectionMode && (
        <Checkbox 
          checked={isItemSelected(f.id, 'folder')}
          onCheckedChange={() => toggleItemSelection(f.id, 'folder')}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className="p-2 rounded-lg bg-primary/10">
        <Folder className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{f.name}</p>
      </div>
      <Badge variant="outline" className="text-xs shrink-0">{f.department_name}</Badge>
      {canManage && !selectionMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={e => { e.stopPropagation(); setAccessDialogItem({ type: 'folder', id: f.id, name: f.name }); }}>
              <Users className="h-4 w-4 mr-2" />Manage Access
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDelete('folder', f.id); }} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  const renderDocumentListItem = (d: any) => (
    <div 
      key={d.id}
      className={`flex items-center gap-4 p-3 rounded-lg border transition-all ${
        draggedDocId === d.id ? 'opacity-50' : 'hover:bg-muted/50'
      } ${canManage && !selectionMode ? 'cursor-grab' : ''} ${isItemSelected(d.id, 'document') ? 'ring-2 ring-primary bg-primary/5' : ''}`}
      draggable={canManage && !selectionMode}
      onDragStart={(e) => handleDragStart(e, d.id, d.name)}
      onDragEnd={handleDragEnd}
    >
      {selectionMode ? (
        <Checkbox 
          checked={isItemSelected(d.id, 'document')}
          onCheckedChange={() => toggleItemSelection(d.id, 'document')}
        />
      ) : canManage && (
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      )}
      <FileTypeIcon fileType={d.file_type} fileName={d.name} />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{d.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(d.file_size)}</p>
      </div>
      <Badge variant="outline" className="text-xs shrink-0">{d.department_name}</Badge>
      {!selectionMode && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewDoc(d as DocType)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <a href={d.file_url} download target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
            </a>
          </Button>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setAccessDialogItem({ type: 'document', id: d.id, name: d.name })}>
                  <Users className="h-4 w-4 mr-2" />Manage Access
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDelete('document', d.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );

  const renderLinkListItem = (l: any) => (
    <div 
      key={l.id}
      className={`flex items-center gap-4 p-3 rounded-lg border transition-all hover:bg-muted/50 ${isItemSelected(l.id, 'link') ? 'ring-2 ring-primary bg-primary/5' : ''}`}
    >
      {selectionMode && (
        <Checkbox 
          checked={isItemSelected(l.id, 'link')}
          onCheckedChange={() => toggleItemSelection(l.id, 'link')}
        />
      )}
      <CloudProviderIcon url={l.url} className="h-5 w-5" />
      <div className="flex-1 min-w-0">
        <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-medium truncate block hover:text-primary">
          {l.title}
        </a>
        {l.description && <p className="text-xs text-muted-foreground line-clamp-1">{l.description}</p>}
      </div>
      <CloudProviderBadge url={l.url} />
      <Badge variant="outline" className="text-xs shrink-0">{l.department_name}</Badge>
      {!selectionMode && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setAccessDialogItem({ type: 'link', id: l.id, name: l.title })}>
                  <Users className="h-4 w-4 mr-2" />Manage Access
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDelete('link', l.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with Cloud Storage branding */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 rounded-lg bg-primary/10">
          <Cloud className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Cloud Storage</h2>
          <p className="text-sm text-muted-foreground">Manage files and links from OneDrive, Google Drive, Dropbox & more</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search files and links..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Building2 className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="general">General</SelectItem>
            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        
        {/* View mode toggle */}
        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        {/* Action buttons */}
        {canManage && (
          <div className="flex gap-2">
            <Button
              variant={selectionMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => selectionMode ? clearSelection() : setSelectionMode(true)}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              {selectionMode ? 'Cancel' : 'Select'}
            </Button>
            {activeTab === 'folders' && !selectionMode && (
              <>
                <Button onClick={() => setCreateFolderOpen(true)} size="sm" variant="outline">
                  <FolderPlus className="h-4 w-4 mr-2" />Folder
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />Upload
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                  </label>
                </Button>
              </>
            )}
            {activeTab === 'links' && !selectionMode && (
              <Button onClick={() => setCreateLinkOpen(true)} size="sm" variant="outline">
                <LinkIcon className="h-4 w-4 mr-2" />Add Link
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Bulk selection bar */}
      {selectionMode && selectedItems.size > 0 && (
        <div className="flex items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium">{selectedItems.size} item(s) selected</span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={selectAllVisible}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4 mr-1" />Clear
            </Button>
            {canManage && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />Delete Selected
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Drag hint */}
      {canManage && activeTab === 'folders' && !selectionMode && filteredDocuments.length > 0 && filteredFolders.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <GripVertical className="h-3 w-3" />
          Tip: Drag files to move them into folders
        </p>
      )}

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'folders' | 'links'); clearSelection(); }} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="folders">
            <Folder className="h-4 w-4 mr-2" />Files & Folders
            <Badge variant="secondary" className="ml-2 text-xs">{filteredFolders.length + filteredDocuments.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="links">
            <Cloud className="h-4 w-4 mr-2" />Cloud Links
            <Badge variant="secondary" className="ml-2 text-xs">{filteredLinks.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="folders" className="mt-6 space-y-4">
          {/* Breadcrumbs */}
          {currentFolderId && (
            <div className="flex items-center gap-2 text-sm flex-wrap mb-4">
              {breadcrumbs.map((c, i) => (
                <div key={c.id || 'root'} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="h-4 w-4" />}
                  <button 
                    onClick={() => setCurrentFolderId(c.id)} 
                    className={i === breadcrumbs.length - 1 ? 'font-medium' : 'text-muted-foreground hover:text-foreground'}
                  >
                    {c.name}
                  </button>
                </div>
              ))}
            </div>
          )}
          {currentFolderId && (
            <Button variant="ghost" size="sm" onClick={() => setCurrentFolderId(breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2]?.id || null : null)}>
              <ArrowLeft className="h-4 w-4 mr-2" />Back
            </Button>
          )}
          
          {loading ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-2'}>
              {[1,2,3,4].map(i => viewMode === 'grid' 
                ? <Card key={i}><CardContent className="p-4 h-24 bg-muted animate-pulse rounded" /></Card>
                : <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              )}
            </div>
          ) : (
            <>
              {/* Folders */}
              {filteredFolders.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Folders</h3>
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredFolders.map(renderFolderCard)}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredFolders.map(renderFolderListItem)}
                    </div>
                  )}
                </div>
              )}

              {/* Files */}
              {filteredDocuments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Files</h3>
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredDocuments.map(renderDocumentCard)}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredDocuments.map(renderDocumentListItem)}
                    </div>
                  )}
                </div>
              )}

              {filteredFolders.length === 0 && filteredDocuments.length === 0 && (
                <div className="text-center py-16">
                  <Folder className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No folders or files found</p>
                  {canManage && (
                    <p className="text-sm text-muted-foreground mt-2">Create a folder or upload a file to get started</p>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="links" className="mt-6">
          {loading ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
              {[1,2,3].map(i => viewMode === 'grid'
                ? <Card key={i}><CardContent className="p-4 h-24 bg-muted animate-pulse rounded" /></Card>
                : <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              )}
            </div>
          ) : filteredLinks.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLinks.map(renderLinkCard)}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLinks.map(renderLinkListItem)}
              </div>
            )
          ) : (
            <div className="text-center py-16">
              <Cloud className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No cloud links found</p>
              {canManage && (
                <p className="text-sm text-muted-foreground mt-2">Add links to OneDrive, Google Drive, Dropbox or any external resource</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateFolderDialog open={createFolderOpen} onOpenChange={setCreateFolderOpen} onCreateFolder={handleCreateFolder} departments={departments} />
      <CreateLinkDialog 
        open={createLinkOpen} 
        onOpenChange={setCreateLinkOpen} 
        onCreateLink={handleCreateLink} 
        departments={departments}
        existingLinks={existingLinksForDuplicateCheck}
      />
      {previewDoc && <DocumentPreviewDialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)} document={previewDoc} />}
      {accessDialogItem && <DocumentAccessDialog open={!!accessDialogItem} onOpenChange={() => setAccessDialogItem(null)} itemType={accessDialogItem.type} itemId={accessDialogItem.id} itemName={accessDialogItem.name} projectId={projectId} />}
      <DuplicateItemDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        duplicateItem={duplicateItem}
        onReplace={handleDuplicateReplace}
        onRename={handleDuplicateRename}
        onCancel={handleDuplicateCancel}
      />
    </div>
  );
}
