import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Users, FolderKanban, CheckSquare, TrendingUp, UserPlus, BarChart3, Shield, FileText } from "lucide-react";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";

interface Stats {
  totalUsers: number;
  totalProjects: number;
  totalTasks: number;
  activeTasks: number;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalProjects: 0,
    totalTasks: 0,
    activeTasks: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersRes, projectsRes, tasksRes, activeTasksRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
      ]);

      setStats({
        totalUsers: usersRes.count || 0,
        totalProjects: projectsRes.count || 0,
        totalTasks: tasksRes.count || 0,
        activeTasks: activeTasksRes.count || 0,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Total Projects",
      value: stats.totalProjects,
      icon: FolderKanban,
      color: "text-accent",
    },
    {
      title: "Total Tasks",
      value: stats.totalTasks,
      icon: CheckSquare,
      color: "text-secondary",
    },
    {
      title: "Active Tasks",
      value: stats.activeTasks,
      icon: TrendingUp,
      color: "text-green-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Overview of system statistics and management
          </p>
        </div>
        <div className="flex gap-2">
          <CreateProjectDialog onProjectCreated={fetchStats} />
          <CreateTaskDialog onTaskCreated={fetchStats} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Common administrative tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button
              onClick={() => navigate('/admin/users')}
              className="h-auto flex-col items-start p-4 gap-2"
              variant="outline"
            >
              <div className="flex items-center gap-2 w-full">
                <UserPlus className="h-5 w-5" />
                <span className="font-semibold">Manage Users</span>
              </div>
              <span className="text-xs text-muted-foreground text-left">
                Create users, assign roles, and manage permissions
              </span>
            </Button>

            <div>
              <CreateProjectDialog onProjectCreated={fetchStats} />
              <p className="text-xs text-muted-foreground mt-2">
                Start a new project with departments and tasks
              </p>
            </div>

            <Button
              onClick={() => navigate('/projects')}
              className="h-auto flex-col items-start p-4 gap-2"
              variant="outline"
            >
              <div className="flex items-center gap-2 w-full">
                <FileText className="h-5 w-5" />
                <span className="font-semibold">View All Projects</span>
              </div>
              <span className="text-xs text-muted-foreground text-left">
                Browse and manage all projects in the system
              </span>
            </Button>

            <div>
              <CreateTaskDialog onTaskCreated={fetchStats} />
              <p className="text-xs text-muted-foreground mt-2">
                Add a new task to any project
              </p>
            </div>

            <Button
              onClick={() => navigate('/analytics')}
              className="h-auto flex-col items-start p-4 gap-2"
              variant="outline"
            >
              <div className="flex items-center gap-2 w-full">
                <BarChart3 className="h-5 w-5" />
                <span className="font-semibold">Analytics</span>
              </div>
              <span className="text-xs text-muted-foreground text-left">
                View detailed analytics and reports
              </span>
            </Button>

            <Button
              onClick={() => navigate('/my-tasks')}
              className="h-auto flex-col items-start p-4 gap-2"
              variant="outline"
            >
              <div className="flex items-center gap-2 w-full">
                <TrendingUp className="h-5 w-5" />
                <span className="font-semibold">View All Tasks</span>
              </div>
              <span className="text-xs text-muted-foreground text-left">
                See all tasks across all projects
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
