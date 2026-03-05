import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Users, FolderKanban, CheckSquare, TrendingUp, UserPlus, BarChart3, Shield, FileText, Loader2, ArrowRight } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { OverdueReminderSettings } from "@/components/OverdueReminderSettings";

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

  const completionRate = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;

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
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        supabase.from('tasks').select('id, status').then(({ data }) => {
          if (data) setRawData(prev => ({ ...prev, tasks: data }));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    { title: "Users", value: stats.totalUsers, icon: Users, color: "text-primary", bgColor: "bg-primary/10" },
    { title: "Projects", value: stats.totalProjects, icon: FolderKanban, color: "text-accent", bgColor: "bg-accent/10" },
    { title: "Total Tasks", value: stats.totalTasks, icon: CheckSquare, color: "text-foreground", bgColor: "bg-muted" },
    { title: "Active", value: stats.activeTasks, icon: TrendingUp, color: "text-success", bgColor: "bg-success/10" },
  ];

  const quickActions = [
    { label: "Manage Users", desc: "Create, assign roles, manage permissions", icon: UserPlus, onClick: () => navigate('/admin/users') },
    { label: "View Projects", desc: "Browse and manage all projects", icon: FolderKanban, onClick: () => navigate('/projects') },
    { label: "View Tasks", desc: "See all tasks across projects", icon: CheckSquare, onClick: () => navigate('/my-tasks') },
    { label: "Analytics", desc: "View detailed reports", icon: BarChart3, onClick: () => navigate('/analytics') },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">System overview and management</p>
        </div>
        <Button className="gap-2 shadow-sm" onClick={() => navigate('/projects')}>
          <FolderKanban className="h-4 w-4" />
          View Projects
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="transition-smooth hover:shadow-md">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.title}</span>
                <div className={`h-8 w-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Completion + Overdue Settings side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Completion Overview */}
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium">Task Completion</p>
                <p className="text-xs text-muted-foreground">{stats.completedTasks} of {stats.totalTasks} tasks completed</p>
              </div>
              <span className="text-2xl font-bold">{completionRate}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
            <div className="flex gap-6 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Done: {stats.completedTasks}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Active: {stats.activeTasks}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Todo: {stats.todoTasks}</span>
            </div>
          </CardContent>
        </Card>

        {/* Overdue Reminder Settings */}
        <OverdueReminderSettings />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Card 
              key={action.label} 
              className="cursor-pointer transition-smooth hover:shadow-md group"
              onClick={action.onClick}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <action.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
