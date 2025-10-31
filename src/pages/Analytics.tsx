import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart3, FolderKanban, ListTodo, Building2 } from "lucide-react";
import { AnalyticsGanttChart } from "@/components/AnalyticsGanttChart";

interface ProjectAnalytics {
  project_id: string;
  project_name: string;
  total_tasks: number;
  todo_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  total_departments: number;
  completion_percentage: number;
}

interface DepartmentAnalytics {
  department_id: string;
  department_name: string;
  project_id: string;
  total_tasks: number;
  todo_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
  earliest_start_date: string;
  latest_due_date: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

const Analytics = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [projectAnalytics, setProjectAnalytics] = useState<ProjectAnalytics[]>([]);
  const [departmentAnalytics, setDepartmentAnalytics] = useState<DepartmentAnalytics[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch project analytics
      const { data: projectData, error: projectError } = await supabase
        .from("project_analytics")
        .select("*")
        .order("project_name");

      if (projectError) throw projectError;

      // Fetch department analytics
      const { data: departmentData, error: departmentError } = await supabase
        .from("department_analytics")
        .select("*")
        .order("department_name");

      if (departmentError) throw departmentError;

      setProjectAnalytics(projectData || []);
      setDepartmentAnalytics(departmentData || []);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate overall stats
  const totalProjects = projectAnalytics.length;
  const totalTasks = projectAnalytics.reduce((sum, p) => sum + (p.total_tasks || 0), 0);
  const completedTasks = projectAnalytics.reduce((sum, p) => sum + (p.completed_tasks || 0), 0);
  const totalDepartments = departmentAnalytics.length;
  const overallCompletion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Prepare task status distribution data
  const taskStatusData = [
    { name: "To Do", value: projectAnalytics.reduce((sum, p) => sum + (p.todo_tasks || 0), 0) },
    { name: "In Progress", value: projectAnalytics.reduce((sum, p) => sum + (p.in_progress_tasks || 0), 0) },
    { name: "Completed", value: projectAnalytics.reduce((sum, p) => sum + (p.completed_tasks || 0), 0) },
  ];

  // Prepare project completion data for bar chart
  const projectCompletionData = projectAnalytics.slice(0, 10).map(p => ({
    name: p.project_name?.substring(0, 20) || "Unnamed",
    completion: Math.round(p.completion_percentage || 0),
  }));

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Comprehensive project and department insights</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Comprehensive project and department insights</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjects}</div>
            <p className="text-xs text-muted-foreground">Active projects across all departments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">{completedTasks} completed, {totalTasks - completedTasks} pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Completion</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallCompletion}%</div>
            <Progress value={overallCompletion} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDepartments}</div>
            <p className="text-xs text-muted-foreground">Active departments working on projects</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Task Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Task Status Distribution</CardTitle>
            <CardDescription>Overview of all tasks across projects</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={taskStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {taskStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Project Completion */}
        <Card>
          <CardHeader>
            <CardTitle>Project Completion Rates</CardTitle>
            <CardDescription>Top 10 projects by completion percentage</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectCompletionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="completion" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Project Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Project Overview</CardTitle>
          <CardDescription>Detailed breakdown of all projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projectAnalytics.map((project) => (
              <div key={project.project_id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h3 className="font-semibold">{project.project_name}</h3>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">{project.total_tasks} tasks</Badge>
                    <Badge variant="outline">{project.total_departments} departments</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Completion</div>
                    <div className="text-2xl font-bold">{Math.round(project.completion_percentage || 0)}%</div>
                  </div>
                  <div className="w-32">
                    <Progress value={project.completion_percentage || 0} />
                  </div>
                </div>
              </div>
            ))}
            {projectAnalytics.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No projects found. Create a project to see analytics.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Department Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Department Performance</CardTitle>
          <CardDescription>Task completion by department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {departmentAnalytics.map((dept) => (
              <div key={dept.department_id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h3 className="font-semibold">{dept.department_name}</h3>
                  <div className="flex gap-2 mt-2 text-sm text-muted-foreground">
                    <span>Todo: {dept.todo_tasks}</span>
                    <span>In Progress: {dept.in_progress_tasks}</span>
                    <span>Completed: {dept.completed_tasks}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Completion</div>
                    <div className="text-2xl font-bold">{Math.round(dept.completion_percentage || 0)}%</div>
                  </div>
                  <div className="w-32">
                    <Progress value={dept.completion_percentage || 0} />
                  </div>
                </div>
              </div>
            ))}
            {departmentAnalytics.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No department data available.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Overall Gantt Chart */}
      <AnalyticsGanttChart />
    </div>
  );
};

export default Analytics;
