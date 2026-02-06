import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, Eye, Upload, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ExternalAccessLevel } from '@/hooks/useExternalUsers';

interface InviteExternalUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (
    email: string,
    fullName: string | undefined,
    accessLevel: ExternalAccessLevel,
    accessExpiresAt?: string
  ) => Promise<boolean>;
}

export function InviteExternalUserDialog({
  open,
  onOpenChange,
  onInvite
}: InviteExternalUserDialogProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [accessLevel, setAccessLevel] = useState<ExternalAccessLevel>('view_only');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) return;
    
    setLoading(true);
    const success = await onInvite(
      email.trim(),
      fullName.trim() || undefined,
      accessLevel,
      hasExpiry && expiryDate ? expiryDate.toISOString() : undefined
    );
    setLoading(false);
    
    if (success) {
      setEmail('');
      setFullName('');
      setAccessLevel('view_only');
      setHasExpiry(false);
      setExpiryDate(undefined);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite External User</DialogTitle>
          <DialogDescription>
            Authorize an external user to access documents in this department.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name (Optional)</Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          
          {/* Access Level */}
          <div className="space-y-3">
            <Label>Access Level *</Label>
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
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
