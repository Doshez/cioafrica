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
  LogOut,
  Shield,
  UserCog,
  KeyRound,
  User,
  MessageSquare,
  Palette,
  Search,
  ChevronRight,
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
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface LayoutProps {
  children: ReactNode;
}

function AppSidebar({ 
  onOpenPasswordChange, 
  onOpenTheme 
}: { 
  onOpenPasswordChange: () => void; 
  onOpenTheme: () => void;
}) {
  const { user, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const userNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: CheckSquare, label: 'My Tasks', path: '/my-tasks' },
    { icon: FolderKanban, label: 'Projects', path: '/projects' },
  ];

  const adminNavItems = [
    { icon: Shield, label: 'Admin', path: '/admin' },
    { icon: UserCog, label: 'Users', path: '/admin/users' },
    { icon: FolderKanban, label: 'Projects', path: '/projects' },
    { icon: CheckSquare, label: 'Tasks', path: '/my-tasks' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  ];

  const navItems = isAdmin ? adminNavItems : userNavItems;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const getInitials = () => {
    const name = user?.user_metadata?.full_name || user?.email || '';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-3 min-h-[40px]">
          <img src={cioLogo} alt="CIO Africa" className="h-8 w-8 object-contain flex-shrink-0" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sm leading-tight">Project Planner</span>
              <span className="text-[10px] text-muted-foreground leading-tight">by CIO Africa</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <Separator className="mx-4 w-auto" />

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-3 mb-1">
            {collapsed ? '' : 'Navigation'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.path)}
                    tooltip={item.label}
                  >
                    <Link
                      to={item.path}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        isActive(item.path)
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 mt-auto">
        <Separator className="mb-3" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              'flex items-center gap-3 w-full rounded-lg p-2 hover:bg-muted transition-colors text-left',
              collapsed && 'justify-center'
            )}>
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user?.user_metadata?.full_name || 'User'}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
              )}
              {!collapsed && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenPasswordChange}>
              <KeyRound className="mr-2 h-4 w-4" />
              Change Password
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenTheme}>
              <Palette className="mr-2 h-4 w-4" />
              Change Theme
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function LayoutHeader({ 
  onOpenMessaging, 
  onOpenPasswordChange,
  onOpenTheme,
  totalUnreadCount 
}: { 
  onOpenMessaging: () => void;
  onOpenPasswordChange: () => void;
  onOpenTheme: () => void;
  totalUnreadCount: number;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
      <SidebarTrigger className="-ml-1" />
      
      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenMessaging}
              className="relative h-9 w-9"
            >
              <MessageSquare className="h-4 w-4" />
              {totalUnreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
                >
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Messages</TooltipContent>
        </Tooltip>
        
        <NotificationBell />
      </div>
    </header>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const { totalUnreadCount } = useGlobalUnreadMessages();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-primary shadow-glow mb-4 animate-pulse">
            <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

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
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar onOpenPasswordChange={() => setShowPasswordChange(true)} onOpenTheme={() => setThemeDialogOpen(true)} />
          <div className="flex-1 flex flex-col min-w-0">
            <LayoutHeader 
              onOpenMessaging={() => setMessagingOpen(true)}
              onOpenPasswordChange={() => setShowPasswordChange(true)}
              onOpenTheme={() => setThemeDialogOpen(true)}
              totalUnreadCount={totalUnreadCount}
            />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </>
  );
}
