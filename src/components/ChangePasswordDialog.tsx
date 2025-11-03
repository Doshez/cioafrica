import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Lock } from 'lucide-react';

interface ChangePasswordDialogProps {
  open: boolean;
  onSuccess: () => void;
  isForced?: boolean;
}

export default function ChangePasswordDialog({ open, onSuccess, isForced = false }: ChangePasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match — try again.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    // Check password strength
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSymbol) {
      toast.error('Password must include uppercase, lowercase, number, and symbol');
      return;
    }

    setLoading(true);

    try {
      // Update password in Supabase Auth
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (passwordError) throw passwordError;

      // Always update must_change_password flag and clear temp password expiry
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            must_change_password: false,
            temporary_password_expires_at: null
          })
          .eq('id', user.id);

        if (profileError) throw profileError;
      }

      toast.success("Password saved — you're all set! ✅");
      setNewPassword('');
      setConfirmPassword('');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isForced ? () => {} : () => onSuccess()}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => isForced && e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>{isForced ? "One last step — create a new password ✨" : "Update Password"}</DialogTitle>
          </div>
          <DialogDescription>
            {isForced 
              ? "For security we require a new permanent password. Make it something only you'd know (8+ characters, mix of letters, numbers & symbols)."
              : "Enter your new password below to update your account security."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className={newPassword.length >= 8 ? 'text-green-600' : ''}>
                ✓ At least 8 characters
              </p>
              <p className={/[A-Z]/.test(newPassword) ? 'text-green-600' : ''}>
                ✓ Uppercase letter
              </p>
              <p className={/[a-z]/.test(newPassword) ? 'text-green-600' : ''}>
                ✓ Lowercase letter
              </p>
              <p className={/[0-9]/.test(newPassword) ? 'text-green-600' : ''}>
                ✓ Number
              </p>
              <p className={/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? 'text-green-600' : ''}>
                ✓ Symbol
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {!isForced && (
              <Button variant="outline" type="button" onClick={() => onSuccess()} className="w-full sm:w-auto">
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save new password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
