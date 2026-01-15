import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, ArrowRight, FolderOpen, FileText, Link } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Department {
  id: string;
  name: string;
}

interface SelectedItem {
  type: 'folder' | 'document' | 'link';
  id: string;
}

interface BulkMoveToDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: SelectedItem[];
  departments: Department[];
  onMove: (targetDepartmentId: string | null) => Promise<void>;
}

export function BulkMoveToDepartmentDialog({
  open,
  onOpenChange,
  selectedItems,
  departments,
  onMove,
}: BulkMoveToDepartmentDialogProps) {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);

  const folderCount = selectedItems.filter(i => i.type === 'folder').length;
  const documentCount = selectedItems.filter(i => i.type === 'document').length;
  const linkCount = selectedItems.filter(i => i.type === 'link').length;

  const handleMove = async () => {
    if (!selectedDepartmentId) return;
    
    setIsMoving(true);
    try {
      const targetId = selectedDepartmentId === 'general' ? null : selectedDepartmentId;
      await onMove(targetId);
      onOpenChange(false);
      setSelectedDepartmentId('');
    } finally {
      setIsMoving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedDepartmentId('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Move {selectedItems.length} Items
          </DialogTitle>
          <DialogDescription>
            Move the selected items to a different department.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected items summary */}
          <div className="space-y-2">
            <Label>Selected Items</Label>
            <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted">
              {folderCount > 0 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <FolderOpen className="h-3 w-3" />
                  {folderCount} folder{folderCount > 1 ? 's' : ''}
                </Badge>
              )}
              {documentCount > 0 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {documentCount} file{documentCount > 1 ? 's' : ''}
                </Badge>
              )}
              {linkCount > 0 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Link className="h-3 w-3" />
                  {linkCount} link{linkCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-department">Move To</Label>
            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
              <SelectTrigger id="target-department">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    General (Project Level)
                  </div>
                </SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {dept.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isMoving}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={!selectedDepartmentId || isMoving}>
            {isMoving ? 'Moving...' : `Move ${selectedItems.length} Items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
