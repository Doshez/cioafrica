import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  const stats = [
    {
      title: 'Active Projects',
      value: '12',
      change: '+2 this month',
      icon: TrendingUp,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Tasks Completed',
      value: '148',
      change: '+18 this week',
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Overdue Tasks',
      value: '3',
      change: 'Needs attention',
      icon: AlertCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      title: 'Hours Logged',
      value: '324',
      change: 'This month',
      icon: Clock,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
  ];

  const recentProjects = [
    {
      name: 'Connected Africa Summit 2025',
      progress: 65,
      tasks: { total: 48, completed: 31 },
      status: 'active',
    },
    {
      name: 'Marketing Campaign Q1',
      progress: 40,
      tasks: { total: 24, completed: 10 },
      status: 'active',
    },
    {
      name: 'Website Redesign',
      progress: 85,
      tasks: { total: 32, completed: 27 },
      status: 'review',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user?.user_metadata?.full_name || 'there'}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your projects today
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
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
          <CardTitle>Recent Projects</CardTitle>
          <CardDescription>Projects you've been working on</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {recentProjects.map((project) => (
            <div key={project.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{project.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {project.tasks.completed} of {project.tasks.total} tasks completed
                  </p>
                </div>
                <span className="text-sm font-medium">{project.progress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="gradient-primary h-2 rounded-full transition-smooth"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
