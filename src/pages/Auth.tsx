import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import ForgotPasswordDialog from '@/components/ForgotPasswordDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import cioDxLogo from '@/assets/cio-dx-logo.png';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      // Handle specific error cases
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Invalid email or password. Please check and try again.');
      } else {
        toast.error(error.message || 'Failed to sign in');
      }
      setLoading(false);
      return;
    }

    // Check if user needs to change password
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('must_change_password, temporary_password_expires_at')
        .eq('id', user.id)
        .single();

      // Check if temporary password has expired
      if (profile?.temporary_password_expires_at) {
        const expiryDate = new Date(profile.temporary_password_expires_at);
        const now = new Date();
        
        if (now > expiryDate) {
          // Temporary password expired - sign out and show error
          await supabase.auth.signOut();
          toast.error('This temporary password has expired. Ask your admin for a new one.', {
            duration: 5000
          });
          setLoading(false);
          return;
        }
      }

      if (profile?.must_change_password) {
        setShowPasswordChange(true);
        setLoading(false);
        return;
      }
    }

    toast.success('Welcome back!', {
      icon: <CheckCircle2 className="h-4 w-4" />
    });
    setLoading(false);
  };

  const handlePasswordChangeSuccess = () => {
    setShowPasswordChange(false);
    toast.success('Password changed successfully! Redirecting...');
    navigate('/dashboard');
  };

  return (
    <>
      <ChangePasswordDialog 
        open={showPasswordChange} 
        onSuccess={handlePasswordChangeSuccess}
        isForced={true}
      />
      <ForgotPasswordDialog 
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
      />
      <div className="min-h-screen gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={cioDxLogo} alt="CIO Africa DX5" className="mx-auto mb-3 h-16" />
          <h1 className="text-3xl font-bold">Project Planner</h1>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="text-center">
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
            <div className="mt-4 text-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      Forgot your password? We've got your back 💙
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Click to ask an admin for a reset — they'll send you a temporary password by email.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
