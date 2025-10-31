import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Users, FolderKanban, CheckSquare, TrendingUp } from "lucide-react";
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

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Access user management, project assignments, and system settings through the navigation menu.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
