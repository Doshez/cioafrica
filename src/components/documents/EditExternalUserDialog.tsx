import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, Eye, Upload, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ExternalUser, ExternalAccessLevel } from '@/hooks/useExternalUsers';

interface EditExternalUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ExternalUser | null;
  onUpdate: (
    userId: string,
    updates: {
      accessLevel?: ExternalAccessLevel;
      accessExpiresAt?: string | null;
    }
  ) => Promise<boolean>;
}

export function EditExternalUserDialog({
  open,
  onOpenChange,
  user,
  onUpdate
}: EditExternalUserDialogProps) {
  const [accessLevel, setAccessLevel] = useState<ExternalAccessLevel>('view_only');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setAccessLevel(user.access_level);
      setHasExpiry(!!user.access_expires_at);
      setExpiryDate(user.access_expires_at ? new Date(user.access_expires_at) : undefined);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    setLoading(true);
    const success = await onUpdate(user.id, {
      accessLevel,
      accessExpiresAt: hasExpiry && expiryDate ? expiryDate.toISOString() : null
    });
    setLoading(false);
    
    if (success) {
      onOpenChange(false);
    }
  };

  const accessLevelOptions = [
    {
      value: 'view_only' as const,
      label: 'View Only',
      description: 'Can open and read documents',
      icon: Eye
    },
    {
      value: 'upload_edit' as const,
      label: 'Upload & Edit',
      description: 'Can upload new documents and edit permitted files',
      icon: Upload
    },
    {
      value: 'edit_download' as const,
      label: 'Edit & Download',
      description: 'Can edit and download documents',
      icon: Download
    }
  ];

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Access Permissions</DialogTitle>
          <DialogDescription>
            Update access level for {user.full_name || user.email}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Access Level */}
          <div className="space-y-3">
            <Label>Access Level</Label>
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
                    accessLevel === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={option.value} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <option.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{option.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {option.description}
                    </p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>
          
          {/* Expiry Date */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="hasExpiry">Set Expiry Date</Label>
              <Switch
                id="hasExpiry"
                checked={hasExpiry}
                onCheckedChange={setHasExpiry}
              />
            </div>
            
            {hasExpiry && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !expiryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiryDate ? format(expiryDate, "PPP") : "Select expiry date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expiryDate}
                    onSelect={setExpiryDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
