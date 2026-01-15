import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useTheme } from '@/contexts/ThemeContext';
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
  User,
  MessageSquare,
  Palette
} from 'lucide-react';
import cioLogo from '@/assets/cio-africa-logo.png';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';
import { supabase } from '@/integrations/supabase/client';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import { GlobalMessagingCenter } from '@/components/GlobalMessagingCenter';
import { useGlobalUnreadMessages } from '@/hooks/useGlobalUnreadMessages';
import { Badge } from '@/components/ui/badge';
import { ThemeSelector } from '@/components/ThemeSelector';
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
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const { totalUnreadCount } = useGlobalUnreadMessages();

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
      <GlobalMessagingCenter
        open={messagingOpen}
        onOpenChange={setMessagingOpen}
      />
      <ThemeSelector 
        open={themeDialogOpen} 
        onOpenChange={setThemeDialogOpen}
      />
      <div className="min-h-screen gradient-subtle transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <Link to="/" className="flex items-center gap-2">
              <img src={cioLogo} alt="CIO Africa" className="h-8 sm:h-10 w-auto" />
              <span className="font-semibold text-sm sm:text-lg hidden sm:inline">Project Planner</span>
            </Link>

            <nav className="hidden md:flex items-center gap-0.5 lg:gap-1">
              {navItems.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={location.pathname === item.path ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-1.5 lg:gap-2 px-2 lg:px-3',
                      location.pathname === item.path && 'bg-primary/10 text-primary hover:bg-primary/20'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="hidden lg:inline text-sm">{item.label}</span>
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Global Messaging Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMessagingOpen(true)}
              className="relative h-9 w-9"
              title="Messaging Center"
            >
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
              {totalUnreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-4 sm:h-5 min-w-4 sm:min-w-5 px-1 text-[10px] sm:text-xs flex items-center justify-center"
                >
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </Badge>
              )}
            </Button>
            
            <NotificationBell />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs sm:text-sm">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowPasswordChange(true)} className="text-sm">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Change Password
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setThemeDialogOpen(true)} className="text-sm">
                  <Palette className="mr-2 h-4 w-4" />
                  Change Theme
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-sm">
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
        <div className="md:hidden border-b bg-background/95 backdrop-blur fixed top-14 left-0 right-0 z-40">
          <nav className="container py-3 sm:py-4 px-4 flex flex-col gap-1.5 sm:gap-2">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant={location.pathname === item.path ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full justify-start gap-2 text-sm',
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
      <main className="container py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
    </>
  );
}
