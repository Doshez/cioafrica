import { useState, useEffect } from 'react';
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
import { Link } from 'lucide-react';

interface CreateLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateLink: (title: string, url: string, description?: string, departmentId?: string) => Promise<void>;
  departments: { id: string; name: string }[];
  defaultDepartmentId?: string;
  showDepartmentSelect?: boolean;
}

export function CreateLinkDialog({
  open,
  onOpenChange,
  onCreateLink,
  departments,
  defaultDepartmentId,
  showDepartmentSelect = true,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Add External Link
          </DialogTitle>
          <DialogDescription>
            Add a link to an external resource or website
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="link-title">Title</Label>
            <Input
              id="link-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter link title..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-description">Description (Optional)</Label>
            <Textarea
              id="link-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this link..."
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
            <Button type="submit" disabled={loading || !title.trim() || !url.trim()}>
              {loading ? 'Adding...' : 'Add Link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
