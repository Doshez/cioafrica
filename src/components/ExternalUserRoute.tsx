import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface ExternalUserRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard that checks if the current user is an external user.
 * If they are, redirect them to the external portal.
 * This prevents external users from accessing internal pages.
 */
export default function ExternalUserRoute({ children }: ExternalUserRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const [isExternalUser, setIsExternalUser] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkExternalUser = async () => {
      if (!user) {
        setIsExternalUser(false);
        setChecking(false);
        return;
      }

      try {
        const { data: externalUser } = await supabase
          .from('external_users')
          .select('id, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        setIsExternalUser(!!externalUser);
      } catch (error) {
        console.error('Error checking external user status:', error);
        setIsExternalUser(false);
      } finally {
        setChecking(false);
      }
    };

    if (!authLoading) {
      checkExternalUser();
    }
  }, [user, authLoading]);

  // Show loading state while checking
  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If not logged in, redirect to auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If external user, redirect to external portal
  if (isExternalUser) {
    return <Navigate to="/external" replace />;
  }

  // Internal user - allow access
  return <>{children}</>;
}
