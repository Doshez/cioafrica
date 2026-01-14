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
import { AlertTriangle, FileText, Folder, Link2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export interface DuplicateItem {
  type: 'folder' | 'document' | 'link';
  existingId: string;
  existingName: string;
  existingCreatedAt?: string;
  existingDepartment?: string;
  newName: string;
  newFile?: File;
  newUrl?: string;
  newDescription?: string;
  departmentId?: string;
}

interface DuplicateItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateItem: DuplicateItem | null;
  onReplace: () => Promise<void>;
  onRename: (newName: string) => Promise<void>;
  onCancel: () => void;
}

export function DuplicateItemDialog({
  open,
  onOpenChange,
  duplicateItem,
  onReplace,
  onRename,
  onCancel,
}: DuplicateItemDialogProps) {
  const [renameValue, setRenameValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'choose' | 'rename'>('choose');

  if (!duplicateItem) return null;

  const getIcon = () => {
    switch (duplicateItem.type) {
      case 'folder':
        return <Folder className="h-5 w-5 text-primary" />;
      case 'document':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'link':
        return <Link2 className="h-5 w-5 text-green-600" />;
    }
  };

  const getTypeLabel = () => {
    switch (duplicateItem.type) {
      case 'folder':
        return 'Folder';
      case 'document':
        return 'File';
      case 'link':
        return 'Link';
    }
  };

  const handleReplace = async () => {
    setLoading(true);
    try {
      await onReplace();
      onOpenChange(false);
      setMode('choose');
      setRenameValue('');
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim()) return;
    setLoading(true);
    try {
      await onRename(renameValue.trim());
      onOpenChange(false);
      setMode('choose');
      setRenameValue('');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
    setMode('choose');
    setRenameValue('');
  };

  const getSuggestedName = () => {
    const name = duplicateItem.newName;
    if (duplicateItem.type === 'document') {
      const lastDot = name.lastIndexOf('.');
      if (lastDot > 0) {
        const baseName = name.substring(0, lastDot);
        const ext = name.substring(lastDot);
        return `${baseName} (copy)${ext}`;
      }
    }
    return `${name} (copy)`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Duplicate {getTypeLabel()} Found
          </DialogTitle>
          <DialogDescription>
            A {duplicateItem.type} with this name already exists in this location.
          </DialogDescription>
        </DialogHeader>

        {mode === 'choose' ? (
          <>
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-sm font-medium text-muted-foreground mb-2">Existing {getTypeLabel()}:</p>
                <div className="flex items-center gap-3">
                  {getIcon()}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{duplicateItem.existingName}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {duplicateItem.existingCreatedAt && (
                        <span className="text-xs text-muted-foreground">
                          Created {format(new Date(duplicateItem.existingCreatedAt), 'MMM d, yyyy')}
                        </span>
                      )}
                      {duplicateItem.existingDepartment && (
                        <Badge variant="outline" className="text-xs">
                          {duplicateItem.existingDepartment}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                What would you like to do with the new {duplicateItem.type}?
              </p>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setRenameValue(getSuggestedName());
                  setMode('rename');
                }}
                disabled={loading}
              >
                Rename New {getTypeLabel()}
              </Button>
              <Button
                variant="destructive"
                onClick={handleReplace}
                disabled={loading}
              >
                {loading ? 'Replacing...' : `Replace Existing`}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">New {getTypeLabel()} Name</Label>
                <Input
                  id="new-name"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder={`Enter new ${duplicateItem.type} name...`}
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setMode('choose')} disabled={loading}>
                Back
              </Button>
              <Button
                onClick={handleRename}
                disabled={loading || !renameValue.trim()}
              >
                {loading ? 'Saving...' : `Save with New Name`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
