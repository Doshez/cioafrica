import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Progress } from '@/components/ui/progress';

interface DashboardStats {
  activeProjects: number;
  completedTasks: number;
  overdueTasks: number;
  totalTasks: number;
}

interface ProjectWithProgress {
  id: string;
  name: string;
  description: string;
  status: string;
  progress: number;
  tasks: {
    total: number;
    completed: number;
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, isProjectManager } = useUserRole();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    completedTasks: 0,
    overdueTasks: 0,
    totalTasks: 0,
  });
  const [recentProjects, setRecentProjects] = useState<ProjectWithProgress[]>([]);

  useEffect(() => {
    if (user && (isAdmin !== undefined && isProjectManager !== undefined)) {
      fetchDashboardData();
    }
  }, [user, isAdmin, isProjectManager]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      let projectsQuery = supabase
        .from('projects')
        .select('id, name, description, status')
        .order('created_at', { ascending: false });

      // If user is not admin or project manager, filter by assigned projects
      if (!isAdmin && !isProjectManager) {
        // Get user's assigned projects
        const { data: assignedProjects } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', user?.id);

        if (assignedProjects && assignedProjects.length > 0) {
          const projectIds = assignedProjects.map(p => p.project_id);
          projectsQuery = projectsQuery.in('id', projectIds);
        } else {
          // User has no assigned projects, return empty
          setStats({
            activeProjects: 0,
            completedTasks: 0,
            overdueTasks: 0,
            totalTasks: 0,
          });
          setRecentProjects([]);
          setLoading(false);
          return;
        }
      }

      const { data: projects, error: projectsError } = await projectsQuery;

      if (projectsError) throw projectsError;

      // Fetch user's tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, status, due_date, project_id, title')
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Calculate stats
      const activeProjects = projects?.filter(p => p.status === 'active').length || 0;
      const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
      const totalTasks = tasks?.length || 0;
      
      const today = new Date();
      const overdueTasks = tasks?.filter(t => {
        if (!t.due_date || t.status === 'completed') return false;
        return new Date(t.due_date) < today;
      }).length || 0;

      setStats({
        activeProjects,
        completedTasks,
        overdueTasks,
        totalTasks,
      });

      // Calculate project progress
      const projectsWithProgress = projects?.slice(0, 3).map(project => {
        const projectTasks = tasks?.filter(t => t.project_id === project.id) || [];
        const completedProjectTasks = projectTasks.filter(t => t.status === 'completed');
        const progress = projectTasks.length > 0 
          ? Math.round((completedProjectTasks.length / projectTasks.length) * 100)
          : 0;

        return {
          ...project,
          progress,
          tasks: {
            total: projectTasks.length,
            completed: completedProjectTasks.length,
          },
        };
      }) || [];

      setRecentProjects(projectsWithProgress);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const statsCards = [
    {
      title: 'Active Projects',
      value: stats.activeProjects.toString(),
      change: 'Currently active',
      icon: TrendingUp,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Tasks Completed',
      value: stats.completedTasks.toString(),
      change: `Out of ${stats.totalTasks} total`,
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Overdue Tasks',
      value: stats.overdueTasks.toString(),
      change: stats.overdueTasks > 0 ? 'Needs attention' : 'All on track',
      icon: AlertCircle,
      color: stats.overdueTasks > 0 ? 'text-destructive' : 'text-success',
      bgColor: stats.overdueTasks > 0 ? 'bg-destructive/10' : 'bg-success/10',
    },
    {
      title: 'Total Tasks',
      value: stats.totalTasks.toString(),
      change: 'Assigned to you',
      icon: Clock,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user?.user_metadata?.full_name || user?.email || 'there'}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your projects today
          </p>
        </div>
        {(isAdmin || isProjectManager) && (
          <Button className="gap-2" onClick={() => navigate('/projects')}>
            <Plus className="h-4 w-4" />
            View Projects
          </Button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="transition-smooth hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Projects</CardTitle>
              <CardDescription>Projects you have access to</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/projects')}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {recentProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No projects assigned yet
            </p>
          ) : (
            recentProjects.map((project) => (
              <div 
                key={project.id} 
                className="space-y-2 cursor-pointer hover:bg-muted/50 p-3 rounded-lg transition-smooth"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{project.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {project.tasks.completed} of {project.tasks.total} tasks completed
                    </p>
                  </div>
                  <span className="text-sm font-medium">{project.progress}%</span>
                </div>
                <Progress value={project.progress} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
