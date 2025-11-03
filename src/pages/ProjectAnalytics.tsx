import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3, RefreshCw, Download, ArrowUpDown, Search, FileDown } from 'lucide-react';
import { calculateWorkingDays, calculateCostVariance } from '@/lib/workingDays';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof Task>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [tasks, statusFilter, searchQuery]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      const modifier = sortDirection === 'asc' ? 1 : -1;
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * modifier;
      }
      return ((aValue as number) - (bValue as number)) * modifier;
    });
  }, [filteredTasks, sortField, sortDirection]);

  const analytics = useMemo(() => {
    const totalEstimatedCost = filteredTasks.reduce((sum, t) => sum + (t.estimated_cost || 0), 0);
    const totalActualCost = filteredTasks.reduce((sum, t) => sum + (t.actual_cost || 0), 0);
    const costVariance = calculateCostVariance(totalEstimatedCost, totalActualCost);

    const totalWorkingDays = filteredTasks.reduce((sum, t) => {
      if (t.start_date && t.due_date) {
        return sum + calculateWorkingDays(t.start_date, t.due_date);
      }
      return sum;
    }, 0);

    const avgWorkingDaysPerTask = filteredTasks.length > 0 
      ? totalWorkingDays / filteredTasks.filter(t => t.start_date && t.due_date).length 
      : 0;

    const completedTasks = filteredTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
    const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress').length;
    const todoTasks = filteredTasks.filter(t => t.status === 'todo').length;

    const costByStatus = filteredTasks.reduce((acc, task) => {
      const variance = calculateCostVariance(task.estimated_cost || 0, task.actual_cost || 0);
      acc[variance.status] = (acc[variance.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const departmentCosts = departments.map(dept => {
      const deptTasks = filteredTasks.filter(t => t.assignee_department_id === dept.id);
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
      const priorityTasks = filteredTasks.filter(t => t.priority === priority && t.start_date && t.due_date);
      const totalDays = priorityTasks.reduce((sum, t) => 
        sum + calculateWorkingDays(t.start_date!, t.due_date!), 0
      );
      return {
        priority,
        workingDays: totalDays,
        taskCount: priorityTasks.length
      };
    });

    const progressOverTime = filteredTasks
      .filter(t => t.start_date)
      .sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime())
      .reduce((acc, task, index) => {
        const date = new Date(task.start_date!).toLocaleDateString();
        const completed = filteredTasks.slice(0, index + 1).filter(t => t.status === 'completed' || t.status === 'done').length;
        const percentage = (completed / filteredTasks.length) * 100;
        
        const existing = acc.find(item => item.date === date);
        if (existing) {
          existing.percentage = percentage;
        } else {
          acc.push({ date, percentage: Math.round(percentage) });
        }
        return acc;
      }, [] as Array<{ date: string; percentage: number }>);

    return {
      totalEstimatedCost,
      totalActualCost,
      costVariance,
      totalWorkingDays,
      avgWorkingDaysPerTask,
      completedTasks,
      inProgressTasks,
      todoTasks,
      totalTasks: filteredTasks.length,
      costByStatus,
      departmentCosts,
      workingDaysByPriority,
      progressOverTime
    };
  }, [filteredTasks, departments]);

  const handleSort = (field: keyof Task) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
    toast.success('Dashboard refreshed');
  };

  const handleExportPDF = async () => {
    toast.info('Generating PDF report...');
    try {
      const element = document.getElementById('analytics-dashboard');
      if (!element) return;

      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${project?.name || 'Project'}_Analytics_Report.pdf`);
      
      toast.success('PDF report downloaded');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

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
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Project Analytics & Reports</h1>
            {project && <p className="text-sm text-muted-foreground">{project.name}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div id="analytics-dashboard" className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Summary Cards with Animations */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Estimated Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${analytics.totalEstimatedCost.toLocaleString()}</div>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  <span className="text-xs text-muted-foreground">Budget baseline</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Actual Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${analytics.totalActualCost.toLocaleString()}</div>
                <div className="flex items-center gap-1 mt-1">
                  {analytics.totalActualCost <= analytics.totalEstimatedCost ? (
                    <>
                      <TrendingDown className="h-3 w-3 text-green-600" />
                      <span className="text-xs text-green-600">Within budget</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-3 w-3 text-red-600" />
                      <span className="text-xs text-red-600">Over budget</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
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
                <div className="text-2xl font-bold">
                  {analytics.costVariance.variance >= 0 ? '+' : '-'}
                  ${Math.abs(analytics.costVariance.variance).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.costVariance.statusLabel} ({analytics.costVariance.variancePercentage.toFixed(1)}%)
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Working Days</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.avgWorkingDaysPerTask.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total: {analytics.totalWorkingDays} days
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Project Completion</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.totalTasks > 0 ? Math.round((analytics.completedTasks / analytics.totalTasks) * 100) : 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.completedTasks} of {analytics.totalTasks} tasks
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Task Status Distribution
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
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={taskStatusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Progress Over Time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Project Progress Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.progressOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="percentage" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Completion %" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

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

        {/* Detailed Task Data Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Detailed Task Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('title')} className="h-8 px-2">
                        Task Name
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('start_date')} className="h-8 px-2">
                        Start Date
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('due_date')} className="h-8 px-2">
                        End Date
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Working Days</TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleSort('estimated_cost')} className="h-8 px-2">
                        Est. Cost
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleSort('actual_cost')} className="h-8 px-2">
                        Actual Cost
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Variance %</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('status')} className="h-8 px-2">
                        Status
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTasks.map((task) => {
                    const workingDays = task.start_date && task.due_date 
                      ? calculateWorkingDays(task.start_date, task.due_date)
                      : 0;
                    const variance = calculateCostVariance(task.estimated_cost || 0, task.actual_cost || 0);
                    
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>{task.start_date ? new Date(task.start_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell className="text-right">{workingDays}</TableCell>
                        <TableCell className="text-right">${(task.estimated_cost || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">${(task.actual_cost || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <span className={variance.variance < 0 ? 'text-green-600' : variance.variance > 0 ? 'text-red-600' : ''}>
                            ${Math.abs(variance.variance).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={variance.variance < 0 ? 'text-green-600' : variance.variance > 0 ? 'text-red-600' : ''}>
                            {variance.variancePercentage.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize">
                            {task.status === 'completed' || task.status === 'done' ? '✅' : 
                             task.status === 'in_progress' ? '🔄' : '📋'} {task.status.replace('_', ' ')}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
