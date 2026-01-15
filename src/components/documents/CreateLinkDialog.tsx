import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { CloudProviderBadge } from './CloudProviderIcon';
import { detectCloudProvider, extractDomain } from '@/lib/cloudProviders';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreateLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateLink: (title: string, url: string, description?: string, departmentId?: string) => Promise<void>;
  departments: { id: string; name: string }[];
  defaultDepartmentId?: string;
  showDepartmentSelect?: boolean;
  existingLinks?: { id: string; title: string; url: string }[];
}

export function CreateLinkDialog({
  open,
  onOpenChange,
  onCreateLink,
  departments,
  defaultDepartmentId,
  showDepartmentSelect = true,
  existingLinks = [],
}: CreateLinkDialogProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Set default department when dialog opens
  useEffect(() => {
    if (open && defaultDepartmentId) {
      setDepartmentId(defaultDepartmentId);
    }
  }, [open, defaultDepartmentId]);

  // Detect cloud provider from URL
  const detectedProvider = useMemo(() => {
    if (!url.trim()) return null;
    try {
      new URL(url);
      return detectCloudProvider(url);
    } catch {
      return null;
    }
  }, [url]);

  // Check for duplicate URLs
  const duplicateLink = useMemo(() => {
    if (!url.trim()) return null;
    try {
      const normalizedUrl = url.toLowerCase().trim();
      return existingLinks.find(link => 
        link.url.toLowerCase().trim() === normalizedUrl
      );
    } catch {
      return null;
    }
  }, [url, existingLinks]);

  // Auto-suggest title from URL
  useEffect(() => {
    if (url && !title && detectedProvider) {
      // Don't auto-fill if user has already typed something
      const domain = extractDomain(url);
      if (domain && !title) {
        // Could auto-suggest but let user decide
      }
    }
  }, [url, title, detectedProvider]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;

    setLoading(true);
    try {
      const finalDepartmentId = defaultDepartmentId || (departmentId && departmentId !== 'none' ? departmentId : undefined);
      await onCreateLink(
        title.trim(),
        url.trim(),
        description.trim() || undefined,
        finalDepartmentId
      );
      setTitle('');
      setUrl('');
      setDescription('');
      setDepartmentId('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const isValidUrl = useMemo(() => {
    if (!url.trim()) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }, [url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Add Cloud Storage Link
          </DialogTitle>
          <DialogDescription>
            Add a link to OneDrive, Google Drive, Dropbox, or any external resource
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              required
              className={!isValidUrl ? 'border-destructive' : ''}
            />
            {url && (
              <div className="flex items-center gap-2 mt-1">
                {detectedProvider ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <CloudProviderBadge url={url} />
                    <span className="text-xs text-muted-foreground">detected</span>
                  </div>
                ) : isValidUrl ? (
                  <span className="text-xs text-muted-foreground">
                    External link: {extractDomain(url)}
                  </span>
                ) : (
                  <span className="text-xs text-destructive">Invalid URL format</span>
                )}
              </div>
            )}
          </div>

          {duplicateLink && (
            <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                <strong>Duplicate detected:</strong> A link with this URL already exists as "{duplicateLink.title}". 
                You can still add it if needed.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="link-title">Title</Label>
            <Input
              id="link-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a descriptive title..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-description">Description (Optional)</Label>
            <Textarea
              id="link-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this link contains..."
              rows={2}
            />
          </div>

          {showDepartmentSelect && !defaultDepartmentId && (
            <div className="space-y-2">
              <Label htmlFor="department">Department (Optional)</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a department..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !title.trim() || !url.trim() || !isValidUrl}
            >
              {loading ? 'Adding...' : 'Add Link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
