import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, CheckCircle2, AlertCircle, Clock, Loader2, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { isTaskDoneStatus } from '@/lib/taskStatus';

interface DashboardStats {
  activeProjects: number;
  completedTasks: number;
  overdueTasks: number;
  totalTasks: number;
}

interface OverdueTask {
  id: string;
  title: string;
  due_date: string;
  project_name: string;
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
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);

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

      // If user is not admin or project manager, filter to projects they own or are a member of
      if (!isAdmin && !isProjectManager) {
        const [memberProjectsRes, ownedProjectsRes] = await Promise.all([
          supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', user?.id),
          supabase
            .from('projects')
            .select('id')
            .eq('owner_id', user?.id),
        ]);

        if (memberProjectsRes.error) throw memberProjectsRes.error;
        if (ownedProjectsRes.error) throw ownedProjectsRes.error;

        const memberIds = (memberProjectsRes.data || []).map(p => p.project_id);
        const ownedIds = (ownedProjectsRes.data || []).map(p => p.id);
        const visibleProjectIds = [...new Set([...memberIds, ...ownedIds])];

        if (visibleProjectIds.length > 0) {
          projectsQuery = projectsQuery.in('id', visibleProjectIds);
        } else {
          setStats({
            activeProjects: 0,
            completedTasks: 0,
            overdueTasks: 0,
            totalTasks: 0,
          });
          setRecentProjects([]);
          setOverdueTasks([]);
          setLoading(false);
          return;
        }
      }

      const { data: projects, error: projectsError } = await projectsQuery;
      if (projectsError) throw projectsError;

      const projectIds = (projects || []).map(p => p.id);
      const activeProjects = projects?.filter(p => p.status === 'active').length || 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Admin/PM: show real project-wide numbers (not just tasks assigned to you)
      if (isAdmin || isProjectManager) {
        if (projectIds.length === 0) {
          setStats({ activeProjects, completedTasks: 0, overdueTasks: 0, totalTasks: 0 });
          setRecentProjects([]);
          setOverdueTasks([]);
          return;
        }

        const recent = (projects || []).slice(0, 3);
        const recentProjectIds = recent.map(p => p.id);

        const [totalRes, completedRes, overdueRes, progressTasksRes] = await Promise.all([
          supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .in('project_id', projectIds),

          supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .in('project_id', projectIds)
            .in('status', ['done', 'completed', 'complete', 'Done', 'Completed', 'DONE', 'COMPLETED']),

          supabase
            .from('tasks')
            .select(
              `
              id,
              title,
              due_date,
              project_id,
              projects (
                name
              )
            `,
              { count: 'exact' }
            )
            .in('project_id', projectIds)
            .not('due_date', 'is', null)
            .lt('due_date', today.toISOString())
            // include tasks where status is null OR not in done/completed
            .or('status.is.null,status.not.in.(done,completed,complete)')
            .order('due_date', { ascending: true })
            .limit(50),

          recentProjectIds.length > 0
            ? supabase.from('tasks').select('id, status, project_id').in('project_id', recentProjectIds)
            : (Promise.resolve({ data: [] as any[] }) as any),
        ]);

        if (totalRes.error) throw totalRes.error;
        if (completedRes.error) throw completedRes.error;
        if (overdueRes.error) throw overdueRes.error;
        if (progressTasksRes.error) throw progressTasksRes.error;

        const totalTasks = totalRes.count || 0;
        const completedTasks = completedRes.count || 0;
        const overdueTasksCount = overdueRes.count || 0;

        const overdueTasksList = overdueRes.data || [];
        setOverdueTasks(
          overdueTasksList.map((t: any) => ({
            id: t.id,
            title: t.title,
            due_date: t.due_date,
            project_name: (t.projects as any)?.name || 'Unknown Project',
          }))
        );

        const progressTasks = (progressTasksRes.data || []) as any[];
        const projectsWithProgress = recent.map(project => {
          const projectTasks = progressTasks.filter(t => t.project_id === project.id);
          const completedProjectTasks = projectTasks.filter(t => isTaskDoneStatus(t.status));
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
        });

        setStats({
          activeProjects,
          completedTasks,
          overdueTasks: overdueTasksCount,
          totalTasks,
        });

        setRecentProjects(projectsWithProgress);
        return;
      }

      // Non-admin / non-PM: also compute from all tasks in accessible projects
      if (projectIds.length === 0) {
        setStats({ activeProjects, completedTasks: 0, overdueTasks: 0, totalTasks: 0 });
        setRecentProjects([]);
        setOverdueTasks([]);
        return;
      }

      const recent = (projects || []).slice(0, 3);
      const recentProjectIds = recent.map(p => p.id);

      const [totalRes, completedRes, overdueRes, progressTasksRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .in('project_id', projectIds),

        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .in('project_id', projectIds)
          .in('status', ['done', 'completed', 'complete', 'Done', 'Completed', 'DONE', 'COMPLETED']),

        supabase
          .from('tasks')
          .select(
            `
            id,
            title,
            due_date,
            project_id,
            projects (
              name
            )
          `,
            { count: 'exact' }
          )
          .in('project_id', projectIds)
          .not('due_date', 'is', null)
          .lt('due_date', today.toISOString())
          .or('status.is.null,status.not.in.(done,completed,complete)')
          .order('due_date', { ascending: true })
          .limit(50),

        recentProjectIds.length > 0
          ? supabase.from('tasks').select('id, status, project_id').in('project_id', recentProjectIds)
          : (Promise.resolve({ data: [] as any[] }) as any),
      ]);

      if (totalRes.error) throw totalRes.error;
      if (completedRes.error) throw completedRes.error;
      if (overdueRes.error) throw overdueRes.error;
      if (progressTasksRes.error) throw progressTasksRes.error;

      const totalTasks = totalRes.count || 0;
      const completedTasks = completedRes.count || 0;
      const overdueTasksCount = overdueRes.count || 0;

      const overdueTasksList = overdueRes.data || [];
      setOverdueTasks(
        overdueTasksList.map((t: any) => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          project_name: (t.projects as any)?.name || 'Unknown Project',
        }))
      );

      const progressTasks = (progressTasksRes.data || []) as any[];
      const projectsWithProgress = recent.map(project => {
        const projectTasks = progressTasks.filter(t => t.project_id === project.id);
        const completedProjectTasks = projectTasks.filter(t => isTaskDoneStatus(t.status));
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
      });

      setStats({
        activeProjects,
        completedTasks,
        overdueTasks: overdueTasksCount,
        totalTasks,
      });

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
      change: 'In your projects',
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

      {/* Overdue Tasks Alert */}
      {stats.overdueTasks > 0 && (
        <Alert className="border-destructive bg-destructive/10 cursor-pointer hover:bg-destructive/20 transition-colors" onClick={() => navigate('/my-tasks?filter=overdue')}>
          <Bell className="h-5 w-5 text-destructive" />
          <AlertTitle className="text-destructive font-semibold">
            {stats.overdueTasks} Overdue Task{stats.overdueTasks > 1 ? 's' : ''} Require Attention
          </AlertTitle>
          <AlertDescription className="text-sm">
            <div className="mt-2 space-y-1">
              {overdueTasks.slice(0, 3).map((task) => (
                <div key={task.id} className="flex items-start justify-between gap-2">
                  <span className="text-xs line-clamp-1">{task.title}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(task.due_date).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {overdueTasks.length > 3 && (
                <p className="text-xs text-muted-foreground mt-2">
                  +{overdueTasks.length - 3} more overdue task{overdueTasks.length - 3 > 1 ? 's' : ''}
                </p>
              )}
            </div>
            <Button variant="destructive" size="sm" className="mt-3 w-full sm:w-auto">
              View All Overdue Tasks
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
