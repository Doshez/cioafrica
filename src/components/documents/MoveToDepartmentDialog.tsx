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
import { Building2, ArrowRight } from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

interface MoveToDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: 'folder' | 'document' | 'link';
  itemName: string;
  currentDepartmentId: string | null;
  departments: Department[];
  onMove: (targetDepartmentId: string | null) => Promise<void>;
}

export function MoveToDepartmentDialog({
  open,
  onOpenChange,
  itemType,
  itemName,
  currentDepartmentId,
  departments,
  onMove,
}: MoveToDepartmentDialogProps) {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);

  const currentDepartmentName = currentDepartmentId 
    ? departments.find(d => d.id === currentDepartmentId)?.name || 'Unknown'
    : 'General';

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
            Move to Department
          </DialogTitle>
          <DialogDescription>
            Move "{itemName}" to a different department. This will change where the {itemType} appears.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Location</Label>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{currentDepartmentName}</span>
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
                {currentDepartmentId !== null && (
                  <SelectItem value="general">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      General (Project Level)
                    </div>
                  </SelectItem>
                )}
                {departments
                  .filter(d => d.id !== currentDepartmentId)
                  .map(dept => (
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
            {isMoving ? 'Moving...' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
