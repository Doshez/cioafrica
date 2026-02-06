import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  Folder, 
  Link as LinkIcon, 
  Download, 
  Eye, 
  Upload,
  LogOut,
  Clock,
  Building2,
  Briefcase,
  Loader2,
  Plus
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { FileTypeIcon } from '@/components/documents/FileTypeIcon';

interface ExternalUserData {
  id: string;
  email: string;
  full_name: string | null;
  department_id: string;
  project_id: string;
  access_level: 'view_only' | 'upload_edit' | 'edit_download';
  access_expires_at: string | null;
  must_change_password: boolean;
  departments: { name: string } | null;
  projects: { name: string } | null;
}

interface DocumentItem {
  id: string;
  name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  folder_id: string | null;
}

interface FolderItem {
  id: string;
  name: string;
  created_at: string;
  parent_folder_id: string | null;
}

interface LinkItem {
  id: string;
  title: string;
  url: string;
  description: string | null;
  created_at: string;
  folder_id: string | null;
}

const accessLevelConfig = {
  view_only: { label: 'View Only', icon: Eye, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  upload_edit: { label: 'Upload & Edit', icon: Upload, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  edit_download: { label: 'Edit & Download', icon: Download, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
};

export default function ExternalUserPortal() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  
  const [externalUser, setExternalUser] = useState<ExternalUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Root' }]);
  
  // Password change dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // File upload state
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useState<HTMLInputElement | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=external');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchExternalUserData();
    }
  }, [user, authLoading]);

  const fetchExternalUserData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Check if user is an external user
      const { data: externalData, error } = await supabase
        .from('external_users')
        .select('*, departments(name), projects(name)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (!externalData) {
        // User is not an external user, redirect to main app
        toast({
          title: 'Access Denied',
          description: 'This portal is for external users only.',
          variant: 'destructive'
        });
        navigate('/');
        return;
      }

      // Check if access has expired
      if (externalData.access_expires_at && new Date(externalData.access_expires_at) < new Date()) {
        toast({
          title: 'Access Expired',
          description: 'Your document access has expired. Please contact the administrator.',
          variant: 'destructive'
        });
        await signOut();
        return;
      }

      setExternalUser(externalData as ExternalUserData);
      
      // Check if password change is required
      if (externalData.must_change_password) {
        setShowPasswordDialog(true);
      }

      // Fetch documents
      await fetchDocuments(externalData.department_id, externalData.project_id, null);
    } catch (error: any) {
      console.error('Error fetching external user data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = useCallback(async (departmentId: string, projectId: string, folderId: string | null) => {
    try {
      // Fetch folders, documents, and links for the department
      const folderQuery = supabase
        .from('document_folders')
        .select('id, name, created_at, parent_folder_id')
        .eq('department_id', departmentId)
        .eq('project_id', projectId);
        
      const docQuery = supabase
        .from('documents')
        .select('id, name, file_url, file_type, file_size, created_at, folder_id')
        .eq('department_id', departmentId)
        .eq('project_id', projectId);
        
      const linkQuery = supabase
        .from('document_links')
        .select('id, title, url, description, created_at, folder_id')
        .eq('department_id', departmentId)
        .eq('project_id', projectId);

      if (folderId) {
        folderQuery.eq('parent_folder_id', folderId);
        docQuery.eq('folder_id', folderId);
        linkQuery.eq('folder_id', folderId);
      } else {
        folderQuery.is('parent_folder_id', null);
        docQuery.is('folder_id', null);
        linkQuery.is('folder_id', null);
      }

      const [foldersResult, docsResult, linksResult] = await Promise.all([
        folderQuery.order('name'),
        docQuery.order('name'),
        linkQuery.order('title')
      ]);

      if (foldersResult.error) throw foldersResult.error;
      if (docsResult.error) throw docsResult.error;
      if (linksResult.error) throw linksResult.error;

      setFolders(foldersResult.data || []);
      setDocuments(docsResult.data || []);
      setLinks(linksResult.data || []);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const handleFolderClick = async (folder: FolderItem) => {
    if (!externalUser) return;
    
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    await fetchDocuments(externalUser.department_id, externalUser.project_id, folder.id);
    
    // Log activity
    await logActivity('folder_access', undefined, folder.id);
  };

  const handleBreadcrumbClick = async (index: number) => {
    if (!externalUser) return;
    
    const newPath = folderPath.slice(0, index + 1);
    const folderId = newPath[newPath.length - 1].id;
    
    setFolderPath(newPath);
    setCurrentFolderId(folderId);
    await fetchDocuments(externalUser.department_id, externalUser.project_id, folderId);
  };

  const handleDocumentView = async (doc: DocumentItem) => {
    // Log activity
    await logActivity('view', doc.id);
    window.open(doc.file_url, '_blank');
  };

  const handleDocumentDownload = async (doc: DocumentItem) => {
    if (!externalUser || externalUser.access_level === 'view_only') {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to download this document.',
        variant: 'destructive'
      });
      return;
    }
    
    // Log activity
    await logActivity('download', doc.id);
    
    // Trigger download
    const link = document.createElement('a');
    link.href = doc.file_url;
    link.download = doc.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLinkClick = async (linkItem: LinkItem) => {
    // Log activity
    await logActivity('view');
    window.open(linkItem.url, '_blank');
  };

  const logActivity = async (action: string, documentId?: string, folderId?: string) => {
    if (!externalUser) return;
    
    try {
      await supabase.from('external_user_activity_log').insert({
        external_user_id: externalUser.id,
        action,
        document_id: documentId || null,
        folder_id: folderId || null,
        details: { timestamp: new Date().toISOString() }
      });
      
      // Update last activity
      await supabase
        .from('external_users')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', externalUser.id);
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive'
      });
      return;
    }
    
    if (newPassword.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters',
        variant: 'destructive'
      });
      return;
    }
    
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;
      
      // Update external user record
      await supabase
        .from('external_users')
        .update({ must_change_password: false })
        .eq('id', externalUser?.id);
      
      // Update profile
      await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user?.id);
      
      setShowPasswordDialog(false);
      setExternalUser(prev => prev ? { ...prev, must_change_password: false } : null);
      
      toast({
        title: 'Success',
        description: 'Your password has been updated successfully.'
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to change password',
        variant: 'destructive'
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!externalUser || !e.target.files || e.target.files.length === 0) return;
    
    const canUpload = externalUser.access_level === 'upload_edit' || externalUser.access_level === 'edit_download';
    if (!canUpload) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to upload files.',
        variant: 'destructive'
      });
      return;
    }
    
    setUploading(true);
    const file = e.target.files[0];
    
    try {
      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `documents/${externalUser.project_id}/${externalUser.department_id}/${fileName}`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);
      
      // Create document record
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
          project_id: externalUser.project_id,
          department_id: externalUser.department_id,
          folder_id: currentFolderId,
          uploaded_by: user?.id
        });
      
      if (docError) throw docError;
      
      // Log activity
      await logActivity('upload');
      
      // Refresh documents
      await fetchDocuments(externalUser.department_id, externalUser.project_id, currentFolderId);
      
      toast({
        title: 'Success',
        description: 'File uploaded successfully.'
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload file. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (e.target) e.target.value = '';
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = bytes;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Show loading while auth is being checked
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect happens in useEffect, show nothing while redirecting
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-48 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!externalUser) {
    return null;
  }

  const config = accessLevelConfig[externalUser.access_level];
  const AccessIcon = config.icon;
  const canDownload = externalUser.access_level !== 'view_only';
  const canUpload = externalUser.access_level === 'upload_edit' || externalUser.access_level === 'edit_download';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold">Document Portal</h1>
              <p className="text-sm text-muted-foreground">
                {externalUser.full_name || externalUser.email}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Access Info Card */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="text-muted-foreground">Project:</span>{' '}
                  <strong>{externalUser.projects?.name}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="text-muted-foreground">Department:</span>{' '}
                  <strong>{externalUser.departments?.name}</strong>
                </span>
              </div>
              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                <AccessIcon className="h-3 w-3" />
                {config.label}
              </div>
              {externalUser.access_expires_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Expires {format(new Date(externalUser.access_expires_at), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          {folderPath.map((item, index) => (
            <div key={item.id || 'root'} className="flex items-center gap-2">
              {index > 0 && <span className="text-muted-foreground">/</span>}
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className={`hover:text-primary transition-colors ${
                  index === folderPath.length - 1 ? 'font-medium' : 'text-muted-foreground'
                }`}
              >
                {item.name}
          </button>
            </div>
          ))}
          
          {/* Upload Button */}
          {canUpload && (
            <div className="flex items-center gap-2">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <Button
                variant="default"
                size="sm"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {uploading ? 'Uploading...' : 'Upload File'}
              </Button>
            </div>
          )}
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Folders */}
          {folders.map(folder => (
            <Card 
              key={folder.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleFolderClick(folder)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Folder className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{folder.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(folder.created_at))} ago
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Documents */}
          {documents.map(doc => (
            <Card key={doc.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <FileTypeIcon fileType={doc.file_type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{doc.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDocumentView(doc)}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canDownload && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDocumentDownload(doc)}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Links */}
          {links.map(link => (
            <Card 
              key={link.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleLinkClick(link)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <LinkIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{link.title}</h4>
                    {link.description && (
                      <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {folders.length === 0 && documents.length === 0 && links.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No documents yet</p>
                <p className="text-sm mt-1">Documents shared with you will appear here</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Change Your Password</DialogTitle>
            <DialogDescription>
              You must set a new password before continuing. Your temporary password has limited validity.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={8}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set New Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
