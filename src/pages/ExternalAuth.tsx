import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, FileText, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import cioDxLogo from '@/assets/cio-dx-logo.png';

export default function ExternalAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkExternalUser = async () => {
      if (user) {
        // Check if user is an external user
        const { data: externalUser } = await supabase
          .from('external_users')
          .select('id, must_change_password')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (externalUser) {
          // External user - redirect to portal
          navigate('/external');
        } else {
          // Not an external user - sign out and show error
          await supabase.auth.signOut();
          toast.error('This portal is for external users only. Please use the main login page.');
        }
      }
    };
    
    checkExternalUser();
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Invalid email or password. Please check and try again.');
      } else {
        toast.error(error.message || 'Failed to sign in');
      }
      setLoading(false);
      return;
    }

    // Check if user is an external user
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (authUser) {
      const { data: externalUser } = await supabase
        .from('external_users')
        .select('id, must_change_password, temporary_password_expires_at')
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!externalUser) {
        // Not an external user - sign out and show error
        await supabase.auth.signOut();
        toast.error('This portal is for external users only. Please use the main login page.');
        setLoading(false);
        return;
      }

      // Check if temporary password has expired
      if (externalUser.temporary_password_expires_at) {
        const expiryDate = new Date(externalUser.temporary_password_expires_at);
        const now = new Date();
        
        if (now > expiryDate) {
          await supabase.auth.signOut();
          toast.error('Your temporary password has expired. Please contact the administrator for a new one.', {
            duration: 5000
          });
          setLoading(false);
          return;
        }
      }

      // Check if password change is required
      if (externalUser.must_change_password) {
        setShowPasswordChange(true);
        setLoading(false);
        return;
      }

      toast.success('Welcome to the Document Portal!', {
        icon: <CheckCircle2 className="h-4 w-4" />
      });
    }

    setLoading(false);
  };

  const handlePasswordChangeSuccess = async () => {
    setShowPasswordChange(false);
    
    // Get current user
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (authUser) {
      // Update external_users table
      await supabase
        .from('external_users')
        .update({ must_change_password: false })
        .eq('user_id', authUser.id);
      
      // Update profiles table
      await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', authUser.id);
      
      // Refresh session to update any cached data
      await supabase.auth.refreshSession();
    }
    
    toast.success('Password changed successfully! Redirecting to Document Portal...');
    navigate('/external');
  };

  return (
    <>
      <ChangePasswordDialog 
        open={showPasswordChange} 
        onSuccess={handlePasswordChangeSuccess}
        isForced={true}
      />
      <div className="min-h-screen gradient-subtle flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={cioDxLogo} alt="CIO Africa DX5" className="mx-auto mb-3 h-16" />
            <h1 className="text-3xl font-bold">Document Portal</h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                External Access
              </Badge>
            </div>
          </div>

          <Card className="shadow-lg border-border/50">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>External User Login</CardTitle>
              <CardDescription>
                Sign in to access your assigned documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="external-email">Email</Label>
                  <Input
                    id="external-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="external-password">Password</Label>
                  <Input
                    id="external-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Access Documents
                </Button>
              </form>
              
              <div className="mt-6 pt-4 border-t text-center">
                <p className="text-xs text-muted-foreground">
                  This portal is exclusively for external stakeholders.
                  <br />
                  For internal access, please use the{' '}
                  <a href="/auth" className="text-primary hover:underline">
                    main login page
                  </a>.
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Need help? Contact your department administrator.
          </p>
        </div>
      </div>
    </>
  );
}
