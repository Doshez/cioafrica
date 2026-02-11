import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Eye, Upload, Download, Loader2, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExternalAccessLevel, ExternalUser } from '@/hooks/useExternalUsers';

interface AddToDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingUser: ExternalUser | null;
  departmentName: string;
  onAdd: (externalUserId: string, accessLevel: ExternalAccessLevel) => Promise<boolean>;
}

export function AddToDepartmentDialog({
  open,
  onOpenChange,
  existingUser,
  departmentName,
  onAdd
}: AddToDepartmentDialogProps) {
  const [accessLevel, setAccessLevel] = useState<ExternalAccessLevel>('view_only');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingUser) return;

    setLoading(true);
    const success = await onAdd(existingUser.id, accessLevel);
    setLoading(false);

    if (success) {
      setAccessLevel('view_only');
      onOpenChange(false);
    }
  };

  const accessLevelOptions = [
    { value: 'view_only' as const, label: 'View Only', description: 'Can open and read documents', icon: Eye },
    { value: 'upload_edit' as const, label: 'Upload & Edit', description: 'Can upload new documents and edit permitted files', icon: Upload },
    { value: 'edit_download' as const, label: 'Edit & Download', description: 'Can edit and download documents', icon: Download }
  ];

  if (!existingUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Add to Department
          </DialogTitle>
          <DialogDescription>
            Add <strong>{existingUser.full_name || existingUser.email}</strong> to <strong>{departmentName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-3 mb-2">
          <p className="text-sm font-medium">{existingUser.full_name || existingUser.email}</p>
          <p className="text-xs text-muted-foreground">{existingUser.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              <Building2 className="mr-1 h-3 w-3" />
              Owner: {existingUser.department_name}
            </Badge>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>Access Level for {departmentName}</Label>
            <RadioGroup
              value={accessLevel}
              onValueChange={(v) => setAccessLevel(v as ExternalAccessLevel)}
              className="space-y-2"
            >
              {accessLevelOptions.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    accessLevel === option.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={option.value} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <option.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{option.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add to Department
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
