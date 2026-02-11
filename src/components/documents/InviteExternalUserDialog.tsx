import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, Eye, Upload, Download, Loader2, AlertCircle, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ExternalAccessLevel, ExternalUser, DuplicateCheckResult } from '@/hooks/useExternalUsers';

interface InviteExternalUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (
    email: string,
    fullName: string | undefined,
    accessLevel: ExternalAccessLevel,
    accessExpiresAt?: string
  ) => Promise<boolean>;
  checkDuplicate?: (email: string) => Promise<DuplicateCheckResult>;
  departmentName?: string;
  onAddExisting?: (user: ExternalUser) => void;
}

export function InviteExternalUserDialog({
  open,
  onOpenChange,
  onInvite,
  checkDuplicate,
  departmentName,
  onAddExisting
}: InviteExternalUserDialogProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [accessLevel, setAccessLevel] = useState<ExternalAccessLevel>('view_only');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Check for duplicates when email changes (debounced)
  useEffect(() => {
    if (!checkDuplicate || !email.trim() || !email.includes('@')) {
      setDuplicateResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicate(true);
      const result = await checkDuplicate(email.trim());
      setDuplicateResult(result);
      setCheckingDuplicate(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [email, checkDuplicate]);

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
      resetForm();
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setFullName('');
    setAccessLevel('view_only');
    setHasExpiry(false);
    setExpiryDate(undefined);
    setDuplicateResult(null);
  };

  const handleAddExisting = () => {
    if (duplicateResult?.externalUser && onAddExisting) {
      onAddExisting(duplicateResult.externalUser);
      resetForm();
    }
  };

  const accessLevelOptions = [
    { value: 'view_only' as const, label: 'View Only', description: 'Can open and read documents', icon: Eye },
    { value: 'upload_edit' as const, label: 'Upload & Edit', description: 'Can upload new documents and edit permitted files', icon: Upload },
    { value: 'edit_download' as const, label: 'Edit & Download', description: 'Can edit and download documents', icon: Download }
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite External User</DialogTitle>
          <DialogDescription>
            Authorize an external user to access documents in {departmentName || 'this department'}.
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
            {checkingDuplicate && (
              <p className="text-xs text-muted-foreground">Checking for existing user...</p>
            )}
          </div>

          {/* Duplicate Detection Alert */}
          {duplicateResult?.exists && duplicateResult.externalUser && (
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  User already exists under {duplicateResult.owningDepartmentName}
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  {duplicateResult.externalUser.full_name || duplicateResult.externalUser.email} is already registered.
                  Add them to {departmentName || 'your department'} instead?
                </p>
                {onAddExisting && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300"
                    onClick={handleAddExisting}
                  >
                    <Building2 className="mr-2 h-3.5 w-3.5" />
                    Add to {departmentName || 'Department'}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

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
                    accessLevel === option.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={option.value} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <option.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{option.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{option.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Expiry Date */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="hasExpiry">Set Expiry Date</Label>
              <Switch id="hasExpiry" checked={hasExpiry} onCheckedChange={setHasExpiry} />
            </div>
            {hasExpiry && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expiryDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiryDate ? format(expiryDate, "PPP") : "Select expiry date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={expiryDate} onSelect={setExpiryDate} disabled={(date) => date < new Date()} initialFocus />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !email.trim() || (duplicateResult?.exists ?? false)}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
