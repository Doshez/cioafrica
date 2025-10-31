import { ReactNode, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  FolderKanban, 
  CheckSquare, 
  BarChart3, 
  Users, 
  Bell,
  LogOut,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: CheckSquare, label: 'My Tasks', path: '/my-tasks' },
    { icon: FolderKanban, label: 'Projects', path: '/projects' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: Users, label: 'Team', path: '/team' },
  ];

  return (
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
              <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary shadow-glow">
                <LayoutDashboard className="h-5 w-5 text-white" />
              </div>
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
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary"></span>
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-5 w-5" />
            </Button>
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
  );
}
