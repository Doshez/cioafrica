import { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@/components/ui/dropdown-menu';
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
} from 'lucide-react';
import { CreateFolderDialog } from './CreateFolderDialog';
import { CreateLinkDialog } from './CreateLinkDialog';
import { DocumentAccessDialog } from './DocumentAccessDialog';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';
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

interface DepartmentDocumentBrowserProps {
  projectId: string;
  departmentId: string;
  departmentName: string;
}

export function DepartmentDocumentBrowser({ projectId, departmentId, departmentName }: DepartmentDocumentBrowserProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, isProjectManager } = useUserRole();
  const { isCurrentUserLead } = useDepartmentLead(departmentId);
  
  const canManage = isAdmin || isProjectManager || isCurrentUserLead;

  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [links, setLinks] = useState<DocumentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([]);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch folders for this department - use .is() for null comparison
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
      
      const { data: foldersData } = await foldersQuery.order('name');

      // Fetch documents for this department - use .is() for null comparison
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
      
      const { data: documentsData } = await documentsQuery.order('name');

      // Fetch links for this department - use .is() for null comparison
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
      
      const { data: linksData } = await linksQuery.order('title');

      // Get uploader names
      const uploaderIds = [...new Set(documentsData?.map(d => d.uploaded_by).filter(Boolean))];
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

      setFolders(foldersData || []);
      setDocuments((documentsData || []).map(d => ({
        ...d,
        uploader_name: d.uploaded_by ? userProfiles[d.uploaded_by] : undefined,
      })));
      setLinks(linksData || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({ title: 'Error', description: 'Failed to load documents', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [projectId, departmentId, currentFolderId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build breadcrumbs
  useEffect(() => {
    const buildBreadcrumbs = async () => {
      const crumbs: { id: string | null; name: string }[] = [{ id: null, name: departmentName }];
      
      if (!currentFolderId) {
        setBreadcrumbs(crumbs);
        return;
      }

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

      setBreadcrumbs([...crumbs, ...folderPath]);
    };

    buildBreadcrumbs();
  }, [currentFolderId, departmentName]);

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`dept-docs-${departmentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `department_id=eq.${departmentId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_links', filter: `department_id=eq.${departmentId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_folders', filter: `department_id=eq.${departmentId}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId, fetchData]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !user) return;

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
        fetchData();
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
      fetchData();
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
      fetchData();
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
      fetchData();
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      toast({ title: 'Error', description: `Failed to delete ${type}`, variant: 'destructive' });
    }
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
          </CardTitle>
          
          {canManage && (
            <div className="flex items-center gap-2">
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
            </div>
          )}
        </div>

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
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {/* Folders */}
                {filteredFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => setCurrentFolderId(folder.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Folder className="h-8 w-8 text-amber-500" />
                      <div>
                        <p className="font-medium">{folder.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {format(new Date(folder.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedItem({ type: 'folder', item: folder }); setAccessDialogOpen(true); }}>
                            <Shield className="h-4 w-4 mr-2" />
                            Manage Access
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete('folder', folder.id); }}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}

                {/* Documents */}
                {filteredDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-3">
                      {getFileIcon(doc.file_type)}
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size)} • {doc.uploader_name || 'Unknown'} • {format(new Date(doc.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => { setSelectedItem({ type: 'document', item: doc }); setPreviewDialogOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => window.open(doc.file_url, '_blank')}>
                        <Download className="h-4 w-4" />
                      </Button>
                      
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedItem({ type: 'document', item: doc }); setAccessDialogOpen(true); }}>
                              <Shield className="h-4 w-4 mr-2" />
                              Manage Access
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete('document', doc.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}

                {/* Links */}
                {filteredLinks.map((link) => (
                  <div key={link.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <LinkIcon className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="font-medium">{link.title}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[300px]">{link.url}</p>
                        {link.description && <p className="text-xs text-muted-foreground mt-1">{link.description}</p>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => window.open(link.url, '_blank')}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedItem({ type: 'link', item: link }); setAccessDialogOpen(true); }}>
                              <Shield className="h-4 w-4 mr-2" />
                              Manage Access
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete('link', link.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}
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
    </Card>
  );
}
