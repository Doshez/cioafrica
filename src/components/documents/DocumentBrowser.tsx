import { useState, useEffect, useCallback, useRef } from 'react';
import { useDocumentManagement, DocumentFolder, Document, DocumentLink } from '@/hooks/useDocumentManagement';
import { useUserRole } from '@/hooks/useUserRole';
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
  Plus,
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

interface DocumentBrowserProps {
  projectId: string;
  departments: { id: string; name: string }[];
}

export function DocumentBrowser({ projectId, departments }: DocumentBrowserProps) {
  const {
    folders,
    documents,
    links,
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
  } = useDocumentManagement(projectId);

  const { isAdmin, isProjectManager } = useUserRole();
  const canManage = isAdmin || isProjectManager;

  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([]);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createLinkOpen, setCreateLinkOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    type: 'document' | 'link' | 'folder';
    item: Document | DocumentLink | DocumentFolder;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateBreadcrumbs = useCallback(async () => {
    const crumbs = await getBreadcrumbs();
    setBreadcrumbs(crumbs);
  }, [getBreadcrumbs]);

  useEffect(() => {
    updateBreadcrumbs();
  }, [currentFolderId, updateBreadcrumbs]);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      uploadDocument(file);
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

  const openAccessDialog = (type: 'document' | 'link' | 'folder', item: Document | DocumentLink | DocumentFolder) => {
    setSelectedItem({ type, item });
    setAccessDialogOpen(true);
  };

  const openPreviewDialog = (document: Document) => {
    setSelectedItem({ type: 'document', item: document });
    setPreviewDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Documents & Links
          </CardTitle>
          
          {canManage && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateFolderOpen(true)}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateLinkOpen(true)}
              >
                <Link2Icon className="h-4 w-4 mr-2" />
                Add Link
              </Button>
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
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
                onClick={() => navigateToFolder(crumb.id)}
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
        {/* Back button when in subfolder */}
        {currentFolderId && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => navigateToFolder(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Root
          </Button>
        )}

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg transition-colors min-h-[400px]",
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-transparent"
          )}
        >
          {isDragging ? (
            <div className="flex flex-col items-center justify-center h-[400px]">
              <Upload className="h-12 w-12 text-primary mb-4" />
              <p className="text-lg font-medium">Drop files to upload</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-400px)]">
              {folders.length === 0 && documents.length === 0 && links.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Folder className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">No documents yet</p>
                  <p className="text-sm">Upload files or create folders to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Folders */}
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => navigateToFolder(folder.id)}
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              openAccessDialog('folder', folder);
                            }}>
                              <Shield className="h-4 w-4 mr-2" />
                              Manage Access
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteFolder(folder.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  ))}

                  {/* Documents */}
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100"
                          onClick={() => openPreviewDialog(doc)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100"
                          onClick={() => window.open(doc.file_url, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openAccessDialog('document', doc)}>
                                <Shield className="h-4 w-4 mr-2" />
                                Manage Access
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteDocument(doc.id)}
                              >
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
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <LinkIcon className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-medium">{link.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {link.url}
                          </p>
                          {link.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {link.description}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100"
                          onClick={() => window.open(link.url, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openAccessDialog('link', link)}>
                                <Shield className="h-4 w-4 mr-2" />
                                Manage Access
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteLink(link.id)}
                              >
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
              )}
            </ScrollArea>
          )}
        </div>
      </CardContent>

      {/* Dialogs */}
      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        onCreateFolder={createFolder}
        departments={departments}
      />

      <CreateLinkDialog
        open={createLinkOpen}
        onOpenChange={setCreateLinkOpen}
        onCreateLink={createLink}
        departments={departments}
      />

      {selectedItem && (
        <>
          <DocumentAccessDialog
            open={accessDialogOpen}
            onOpenChange={setAccessDialogOpen}
            itemId={selectedItem.item.id}
            itemType={selectedItem.type}
            itemName={
              selectedItem.type === 'document' 
                ? (selectedItem.item as Document).name 
                : selectedItem.type === 'link' 
                  ? (selectedItem.item as DocumentLink).title 
                  : (selectedItem.item as DocumentFolder).name
            }
            projectId={projectId}
          />

          {selectedItem.type === 'document' && (
            <DocumentPreviewDialog
              open={previewDialogOpen}
              onOpenChange={setPreviewDialogOpen}
              document={selectedItem.item as Document}
            />
          )}
        </>
      )}
    </Card>
  );
}
