import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Users, FolderKanban, CheckSquare, TrendingUp, UserPlus, BarChart3, Shield, FileText } from "lucide-react";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";

interface RawData {
  users: number;
  projects: number;
  tasks: { id: string; status: string | null }[];
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rawData, setRawData] = useState<RawData>({
    users: 0,
    projects: 0,
    tasks: [],
  });
  const [loading, setLoading] = useState(true);

  // Compute analytics from raw data for real-time accuracy
  const stats = useMemo(() => {
    const tasks = rawData.tasks;
    return {
      totalUsers: rawData.users,
      totalProjects: rawData.projects,
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.status === 'in_progress').length,
      completedTasks: tasks.filter(t => t.status === 'done').length,
      todoTasks: tasks.filter(t => t.status === 'todo' || !t.status).length,
    };
  }, [rawData]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, projectsRes, tasksRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id, status'),
      ]);

      setRawData({
        users: usersRes.count || 0,
        projects: projectsRes.count || 0,
        tasks: tasksRes.data || [],
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

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Real-time subscription for tasks
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          // Refetch tasks on any change
          supabase.from('tasks').select('id, status').then(({ data }) => {
            if (data) {
              setRawData(prev => ({ ...prev, tasks: data }));
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
          <CreateProjectDialog onProjectCreated={fetchData} />
          <CreateTaskDialog onTaskCreated={fetchData} showTrigger={false} />
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
              <CreateProjectDialog onProjectCreated={fetchData} />
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
