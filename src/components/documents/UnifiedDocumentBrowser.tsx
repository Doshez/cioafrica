import { useState, useMemo, useCallback, DragEvent, useRef } from 'react';
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
import { Folder, Link2, Search, Building2, ExternalLink, FileText, MoreVertical, Trash2, Download, Eye, ChevronRight, ArrowLeft, FolderPlus, Upload, LinkIcon, GripVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CreateFolderDialog } from './CreateFolderDialog';
import { CreateLinkDialog } from './CreateLinkDialog';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';
import { DocumentAccessDialog } from './DocumentAccessDialog';
import { DuplicateItemDialog, DuplicateItem } from './DuplicateItemDialog';
import { Document as DocType } from '@/hooks/useDocumentManagement';

interface Department { id: string; name: string; }
interface UnifiedDocumentBrowserProps { projectId: string; departments: Department[]; canManage: boolean; }

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

  const invalidateQueries = useCallback(() => {
    // Invalidate all folder/document queries regardless of currentFolderId
    queryClient.invalidateQueries({ queryKey: ['unified-folders'] });
    queryClient.invalidateQueries({ queryKey: ['unified-documents'] });
    queryClient.invalidateQueries({ queryKey: ['unified-links'] });
  }, [queryClient]);

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
    
    // Check for duplicate
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
    
    // Check for duplicate
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
    
    // Check for duplicate
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
      // Delete existing folder and create new one
      await supabase.from('document_folders').delete().eq('id', duplicateItem.existingId);
      await createFolderDirectly(duplicateItem.newName, duplicateItem.departmentId);
    } else if (duplicateItem.type === 'document' && duplicateItem.newFile) {
      // Delete existing document and upload new one
      await supabase.from('documents').delete().eq('id', duplicateItem.existingId);
      await uploadDocumentDirectly(duplicateItem.newFile);
    } else if (duplicateItem.type === 'link' && duplicateItem.newUrl) {
      // Delete existing link and create new one
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
    
    // Create custom drag image
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
      const { error } = await supabase
        .from('documents')
        .update({ folder_id: targetFolderId })
        .eq('id', docId);

      if (error) throw error;

      toast({ title: 'File moved successfully', description: 'The file has been moved to the folder.' });
      invalidateQueries();
    } catch (error) {
      console.error('Error moving document:', error);
      toast({ title: 'Move failed', description: 'Could not move the file to this folder.', variant: 'destructive' });
    }

    setDraggedDocId(null);
    setDropTargetFolderId(null);
  };

  const formatFileSize = (bytes: number | null) => { if (!bytes) return ''; if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; };
  const loading = foldersLoading || docsLoading || linksLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}><SelectTrigger className="w-full sm:w-[200px]"><Building2 className="h-4 w-4 mr-2" /><SelectValue placeholder="Filter" /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem><SelectItem value="general">General</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
        {canManage && <div className="flex gap-2">{activeTab === 'folders' && <><Button onClick={() => setCreateFolderOpen(true)} size="sm" variant="outline"><FolderPlus className="h-4 w-4 mr-2" />Folder</Button><Button size="sm" variant="outline" asChild><label className="cursor-pointer"><Upload className="h-4 w-4 mr-2" />Upload<input type="file" className="hidden" onChange={handleFileUpload} /></label></Button></>}{activeTab === 'links' && <Button onClick={() => setCreateLinkOpen(true)} size="sm" variant="outline"><LinkIcon className="h-4 w-4 mr-2" />Add Link</Button>}</div>}
      </div>

      {/* Drag hint */}
      {canManage && activeTab === 'folders' && filteredDocuments.length > 0 && filteredFolders.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <GripVertical className="h-3 w-3" />
          Tip: Drag files to move them into folders
        </p>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'folders' | 'links')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md"><TabsTrigger value="folders"><Folder className="h-4 w-4 mr-2" />Folders<Badge variant="secondary" className="ml-2 text-xs">{filteredFolders.length + filteredDocuments.length}</Badge></TabsTrigger><TabsTrigger value="links"><Link2 className="h-4 w-4 mr-2" />Links<Badge variant="secondary" className="ml-2 text-xs">{filteredLinks.length}</Badge></TabsTrigger></TabsList>

        <TabsContent value="folders" className="mt-6 space-y-4">
          {currentFolderId && <div className="flex items-center gap-2 text-sm flex-wrap mb-4">{breadcrumbs.map((c, i) => <div key={c.id || 'root'} className="flex items-center gap-2">{i > 0 && <ChevronRight className="h-4 w-4" />}<button onClick={() => setCurrentFolderId(c.id)} className={i === breadcrumbs.length - 1 ? 'font-medium' : 'text-muted-foreground hover:text-foreground'}>{c.name}</button></div>)}</div>}
          {currentFolderId && <Button variant="ghost" size="sm" onClick={() => setCurrentFolderId(breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2]?.id || null : null)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>}
          
          {loading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Card key={i}><CardContent className="p-4 h-24 bg-muted animate-pulse rounded" /></Card>)}</div> : (
            <>
              {/* Folders - Drop targets */}
              {filteredFolders.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Folders</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredFolders.map(f => (
                      <Card 
                        key={f.id} 
                        className={`group cursor-pointer transition-all ${
                          dropTargetFolderId === f.id 
                            ? 'ring-2 ring-primary bg-primary/5 shadow-lg scale-[1.02]' 
                            : 'hover:shadow-md'
                        }`}
                        onClick={() => !draggedDocId && setCurrentFolderId(f.id)}
                        onDragOver={(e) => handleDragOver(e, f.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, f.id)}
                      >
                        <CardContent className="p-4 flex items-start justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`p-2 rounded-lg transition-colors ${
                              dropTargetFolderId === f.id ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                            }`}>
                              <Folder className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{f.name}</p>
                              <Badge variant="outline" className="text-xs mt-1"><Building2 className="h-3 w-3 mr-1" />{f.department_name}</Badge>
                              {dropTargetFolderId === f.id && (
                                <p className="text-xs text-primary mt-1 font-medium">Drop here to move</p>
                              )}
                            </div>
                          </div>
                          {canManage && !draggedDocId && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={e => { e.stopPropagation(); setAccessDialogItem({ type: 'folder', id: f.id, name: f.name }); }}>
                                  <Eye className="h-4 w-4 mr-2" />Manage Access
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDelete('folder', f.id); }} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Files - Draggable */}
              {filteredDocuments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Files</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredDocuments.map(d => (
                      <Card 
                        key={d.id} 
                        className={`group transition-all ${
                          draggedDocId === d.id ? 'opacity-50 scale-95' : 'hover:shadow-md'
                        } ${canManage ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        draggable={canManage}
                        onDragStart={(e) => handleDragStart(e, d.id, d.name)}
                        onDragEnd={handleDragEnd}
                      >
                        <CardContent className="p-4 flex items-start justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {canManage && (
                              <div className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors cursor-grab">
                                <GripVertical className="h-4 w-4" />
                              </div>
                            )}
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{d.name}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(d.file_size)}</p>
                              <Badge variant="outline" className="text-xs mt-1"><Building2 className="h-3 w-3 mr-1" />{d.department_name}</Badge>
                            </div>
                          </div>
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
                                  <DropdownMenuItem onClick={() => setAccessDialogItem({ type: 'document', id: d.id, name: d.name })}>
                                    <Eye className="h-4 w-4 mr-2" />Manage Access
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDelete('document', d.id)} className="text-destructive">
                                    <Trash2 className="h-4 w-4 mr-2" />Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {filteredFolders.length === 0 && filteredDocuments.length === 0 && <div className="text-center py-16"><Folder className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><p className="text-lg font-medium text-muted-foreground">No folders or files found</p></div>}
            </>
          )}
        </TabsContent>

        <TabsContent value="links" className="mt-6">
          {loading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <Card key={i}><CardContent className="p-4 h-24 bg-muted animate-pulse rounded" /></Card>)}</div> : filteredLinks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filteredLinks.map(l => <Card key={l.id} className="group hover:shadow-md"><CardContent className="p-4 flex items-start justify-between gap-2"><div className="flex items-center gap-3 min-w-0 flex-1"><div className="p-2 rounded-lg bg-green-500/10 text-green-600"><Link2 className="h-5 w-5" /></div><div className="min-w-0 flex-1"><a href={l.url} target="_blank" rel="noopener noreferrer" className="font-medium truncate block hover:text-primary">{l.title}</a>{l.description && <p className="text-xs text-muted-foreground line-clamp-1">{l.description}</p>}<Badge variant="outline" className="text-xs mt-2"><Building2 className="h-3 w-3 mr-1" />{l.department_name}</Badge></div></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" asChild><a href={l.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>{canManage && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setAccessDialogItem({ type: 'link', id: l.id, name: l.title })}><Eye className="h-4 w-4 mr-2" />Manage Access</DropdownMenuItem><DropdownMenuItem onClick={() => handleDelete('link', l.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</div></CardContent></Card>)}</div>
          ) : <div className="text-center py-16"><Link2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><p className="text-lg font-medium text-muted-foreground">No links found</p></div>}
        </TabsContent>
      </Tabs>

      <CreateFolderDialog open={createFolderOpen} onOpenChange={setCreateFolderOpen} onCreateFolder={handleCreateFolder} departments={departments} />
      <CreateLinkDialog open={createLinkOpen} onOpenChange={setCreateLinkOpen} onCreateLink={handleCreateLink} departments={departments} />
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
