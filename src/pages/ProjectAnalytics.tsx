import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3 } from 'lucide-react';
import { calculateWorkingDays, calculateCostVariance } from '@/lib/workingDays';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  estimated_cost: number;
  actual_cost: number;
  assignee_department_id: string;
}

interface Department {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

export default function ProjectAnalytics() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    try {
      const [projectData, tasksData, deptData] = await Promise.all([
        supabase.from('projects').select('id, name').eq('id', projectId).single(),
        supabase.from('tasks').select('*').eq('project_id', projectId),
        supabase.from('departments').select('id, name').eq('project_id', projectId)
      ]);

      if (projectData.data) setProject(projectData.data);
      if (tasksData.data) setTasks(tasksData.data);
      if (deptData.data) setDepartments(deptData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const analytics = useMemo(() => {
    const totalEstimatedCost = tasks.reduce((sum, t) => sum + (t.estimated_cost || 0), 0);
    const totalActualCost = tasks.reduce((sum, t) => sum + (t.actual_cost || 0), 0);
    const costVariance = calculateCostVariance(totalEstimatedCost, totalActualCost);

    const totalWorkingDays = tasks.reduce((sum, t) => {
      if (t.start_date && t.due_date) {
        return sum + calculateWorkingDays(t.start_date, t.due_date);
      }
      return sum;
    }, 0);

    const avgWorkingDaysPerTask = tasks.length > 0 
      ? totalWorkingDays / tasks.filter(t => t.start_date && t.due_date).length 
      : 0;

    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'done').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const todoTasks = tasks.filter(t => t.status === 'todo').length;

    const costByStatus = tasks.reduce((acc, task) => {
      const variance = calculateCostVariance(task.estimated_cost || 0, task.actual_cost || 0);
      acc[variance.status] = (acc[variance.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const departmentCosts = departments.map(dept => {
      const deptTasks = tasks.filter(t => t.assignee_department_id === dept.id);
      const estimated = deptTasks.reduce((sum, t) => sum + (t.estimated_cost || 0), 0);
      const actual = deptTasks.reduce((sum, t) => sum + (t.actual_cost || 0), 0);
      return {
        name: dept.name,
        estimated,
        actual,
        variance: actual - estimated
      };
    });

    const workingDaysByPriority = ['low', 'medium', 'high', 'urgent'].map(priority => {
      const priorityTasks = tasks.filter(t => t.priority === priority && t.start_date && t.due_date);
      const totalDays = priorityTasks.reduce((sum, t) => 
        sum + calculateWorkingDays(t.start_date!, t.due_date!), 0
      );
      return {
        priority,
        workingDays: totalDays,
        taskCount: priorityTasks.length
      };
    });

    return {
      totalEstimatedCost,
      totalActualCost,
      costVariance,
      totalWorkingDays,
      avgWorkingDaysPerTask,
      completedTasks,
      inProgressTasks,
      todoTasks,
      totalTasks: tasks.length,
      costByStatus,
      departmentCosts,
      workingDaysByPriority
    };
  }, [tasks, departments]);

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  const statusPieData = [
    { name: '🟢 Under Budget', value: analytics.costByStatus.under || 0 },
    { name: '🟡 On Budget', value: analytics.costByStatus.on || 0 },
    { name: '🔴 Over Budget', value: analytics.costByStatus.over || 0 },
  ].filter(d => d.value > 0);

  const taskStatusData = [
    { name: 'Completed', value: analytics.completedTasks },
    { name: 'In Progress', value: analytics.inProgressTasks },
    { name: 'To Do', value: analytics.todoTasks },
  ];

  if (loading) {
    return <div className="p-8">Loading analytics...</div>;
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-4 border-b">
        <div className="flex items-center gap-3 mb-4">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Project Analytics & Reports</h1>
            {project && <p className="text-sm text-muted-foreground">{project.name}</p>}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Estimated Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${analytics.totalEstimatedCost.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Actual Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${analytics.totalActualCost.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cost Variance</CardTitle>
              {analytics.costVariance.variance < 0 ? (
                <TrendingDown className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingUp className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${analytics.costVariance.statusColor}`}>
                ${Math.abs(analytics.costVariance.variance).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.costVariance.statusLabel} ({analytics.costVariance.variancePercentage.toFixed(1)}%)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Working Days/Task</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.avgWorkingDaysPerTask.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total: {analytics.totalWorkingDays} working days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Project Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Project Progress Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{analytics.completedTasks}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{analytics.inProgressTasks}</div>
                <div className="text-sm text-muted-foreground">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">{analytics.todoTasks}</div>
                <div className="text-sm text-muted-foreground">To Do</div>
              </div>
            </div>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={taskStatusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cost Variance by Department */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Variance by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.departmentCosts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                <Legend />
                <Bar dataKey="estimated" fill="#3b82f6" name="Estimated" />
                <Bar dataKey="actual" fill="#8b5cf6" name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks by Cost Status */}
          {statusPieData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tasks by Cost Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Working Days by Priority */}
          <Card>
            <CardHeader>
              <CardTitle>Working Days Distribution by Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.workingDaysByPriority}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="priority" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="workingDays" fill="#10b981" name="Working Days" />
                  <Bar dataKey="taskCount" fill="#6366f1" name="Task Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
