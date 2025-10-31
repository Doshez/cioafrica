import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  FolderKanban, 
  CheckSquare, 
  BarChart3, 
  Users, 
  LogOut,
  Menu,
  Shield,
  UserCog,
  KeyRound,
  User
} from 'lucide-react';
import cioLogo from '@/assets/cio-africa-logo.png';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';
import { supabase } from '@/integrations/supabase/client';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, loading, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Check if user must change password on mount
  useEffect(() => {
    const checkPasswordChange = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('must_change_password')
          .eq('id', user.id)
          .single();

        if (profile?.must_change_password) {
          setShowPasswordChange(true);
        }
      }
    };

    checkPasswordChange();
  }, [user]);

  const handlePasswordChangeSuccess = () => {
    setShowPasswordChange(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-glow mb-4 animate-pulse">
            <LayoutDashboard className="h-8 w-8 text-white" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: CheckSquare, label: 'My Tasks', path: '/my-tasks' },
    { icon: FolderKanban, label: 'Projects', path: '/projects' },
  ];

  const adminNavItems = [
    { icon: Shield, label: 'Admin Dashboard', path: '/admin' },
    { icon: UserCog, label: 'User Management', path: '/admin/users' },
    { icon: FolderKanban, label: 'All Projects', path: '/projects' },
    { icon: CheckSquare, label: 'All Tasks', path: '/my-tasks' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  ];

  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <>
      <ChangePasswordDialog 
        open={showPasswordChange} 
        onSuccess={handlePasswordChangeSuccess}
      />
      <div className="min-h-screen gradient-subtle">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <Link to="/" className="flex items-center gap-2">
              <img src={cioLogo} alt="CIO Africa" className="h-10 w-auto" />
              <span className="font-semibold text-lg hidden sm:inline">Project Planner</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={location.pathname === item.path ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-2',
                      location.pathname === item.path && 'bg-primary/10 text-primary hover:bg-primary/20'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowPasswordChange(true)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Change Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b bg-background/95 backdrop-blur">
          <nav className="container py-4 flex flex-col gap-2">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant={location.pathname === item.path ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full justify-start gap-2',
                    location.pathname === item.path && 'bg-primary/10 text-primary hover:bg-primary/20'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="container py-6">
        {children}
      </main>
    </div>
    </>
  );
}
