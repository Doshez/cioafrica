import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      // First, check if user is registered
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', email.trim().toLowerCase())
        .single();

      if (profileError || !profiles) {
        toast.error('No account found with that email address. Please check your email or contact your admin.');
        setLoading(false);
        return;
      }

      // Create password reset request
      const { error: requestError } = await supabase
        .from('password_reset_requests')
        .insert({
          user_id: profiles.id,
          user_email: profiles.email,
          user_full_name: profiles.full_name,
          status: 'pending'
        });

      if (requestError) {
        console.error('Error creating reset request:', requestError);
        toast.error(`Failed to create reset request: ${requestError.message}`);
        setLoading(false);
        return;
      }

      // Call edge function to notify admins
      const { data, error: notifyError } = await supabase.functions.invoke('notify-admin-password-reset', {
        body: {
          userEmail: profiles.email,
          userFullName: profiles.full_name
        }
      });

      if (notifyError) {
        console.error('Error notifying admin:', notifyError);
        toast.error(`Failed to notify admin: ${notifyError.message}`);
        setLoading(false);
        return;
      }

      console.log('Admin notification sent successfully:', data);

      toast.success('Request sent — your admin has been notified. Check your email for a temporary password.', {
        icon: <Mail className="h-4 w-4" />
      });
      
      setEmail('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast.error(`Something went wrong: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Need a reset?</DialogTitle>
          <DialogDescription>
            Tell us your account email and we'll let your admin know. They'll send a temporary password to your inbox so you can get back in — then we'll ask you to choose a new one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email address</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="flex gap-2 justify-end">
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
              Send request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
