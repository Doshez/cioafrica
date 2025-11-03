import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3, RefreshCw, Download, ArrowUpDown, Search, FileDown } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { 
  useProjectAnalytics, 
  formatCurrency, 
  formatPercentage, 
  formatWorkingDays,
  prepareCostStatusPieData,
  prepareCostVarianceBarData,
  prepareWorkingDaysBarData,
  prepareProgressOverTimeData
} from '@/hooks/useProjectAnalytics';

interface Project {
  id: string;
  name: string;
}

export default function ProjectAnalytics() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'title' | 'working_days' | 'estimated_cost' | 'actual_cost' | 'cost_variance'>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Use the analytics data layer hook
  const {
    tasks,
    filteredTaskAnalytics,
    kpis,
    budgetDistribution,
    loading,
    refreshData
  } = useProjectAnalytics({
    projectId: projectId || '',
    statusFilter,
    searchQuery
  });

  // Fetch project details
  useState(() => {
    if (projectId) {
      supabase
        .from('projects')
        .select('id, name')
        .eq('id', projectId)
        .single()
        .then(({ data }) => {
          if (data) setProject(data);
        });
    }
  });

  // Sort filtered tasks
  const sortedTasks = useMemo(() => {
    return [...filteredTaskAnalytics].sort((a, b) => {
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
  }, [filteredTaskAnalytics, sortField, sortDirection]);

  // Prepare chart data
  const costStatusPieData = useMemo(() => prepareCostStatusPieData(budgetDistribution), [budgetDistribution]);
  const costVarianceBarData = useMemo(() => prepareCostVarianceBarData(filteredTaskAnalytics), [filteredTaskAnalytics]);
  const workingDaysBarData = useMemo(() => prepareWorkingDaysBarData(filteredTaskAnalytics), [filteredTaskAnalytics]);
  const progressOverTimeData = useMemo(() => prepareProgressOverTimeData(tasks), [tasks]);

  const handleRefresh = async () => {
    toast.info('Refreshing analytics data...');
    await refreshData();
    toast.success('Analytics data refreshed!');
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
      pdf.save(`${project?.name || 'Project'}-Analytics-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast.success('PDF report generated successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF report');
    }
  };

  const handleExportExcel = () => {
    // Prepare CSV data
    const headers = ['Task ID', 'Task Name', 'Start Date', 'End Date', 'Working Days', 'Estimated Cost', 'Actual Cost', 'Cost Variance', 'Variance %', 'Status', 'Budget Status'];
    const rows = sortedTasks.map(task => [
      task.id,
      task.title,
      task.start_date || 'N/A',
      task.due_date || 'N/A',
      task.working_days,
      task.estimated_cost,
      task.actual_cost,
      task.cost_variance,
      task.cost_variance_pct !== null ? task.cost_variance_pct.toFixed(2) : 'N/A',
      task.status,
      task.budget_status_label
    ]);

    const csvContent = [
      [`Project: ${project?.name || 'Unknown'}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      [`Summary KPIs`],
      [`Total Estimated Cost: ${formatCurrency(kpis.totalEstimatedCost)}`],
      [`Total Actual Cost: ${formatCurrency(kpis.totalActualCost)}`],
      [`Overall Cost Variance: ${formatCurrency(kpis.overallCostVariance)} (${formatPercentage(kpis.overallCostVariancePct)})`],
      [`Average Working Days: ${kpis.averageWorkingDays.toFixed(1)} days`],
      [`Project Completion: ${kpis.projectCompletionPct.toFixed(1)}%`],
      [],
      headers,
      ...rows
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${project?.name || 'Project'}-Analytics-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Excel/CSV report exported successfully!');
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-muted-foreground">Loading analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Project Analytics</h1>
            <p className="text-muted-foreground">{project?.name || 'Unknown Project'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileDown className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Content */}
      <div id="analytics-dashboard" className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Estimated</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(kpis.totalEstimatedCost)}</div>
                <p className="text-xs text-muted-foreground mt-1">Budget allocation</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Actual</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(kpis.totalActualCost)}</div>
                <p className="text-xs text-muted-foreground mt-1">Actual spend</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Cost Variance</CardTitle>
                {kpis.overallCostVariance >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-red-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-green-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${kpis.overallCostVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(Math.abs(kpis.overallCostVariance))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{formatPercentage(kpis.overallCostVariancePct)}</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Working Days</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.averageWorkingDays.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground mt-1">Days per task</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Completion</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.projectCompletionPct.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">{kpis.completedTasks} of {kpis.totalTasks} tasks</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={costStatusPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {costStatusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cost Variance by Task */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Variance by Task</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costVarianceBarData.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold">{data.fullTitle}</p>
                            <p>Estimated: {formatCurrency(data.estimated)}</p>
                            <p>Actual: {formatCurrency(data.actual)}</p>
                            <p className="font-semibold">Variance: {formatCurrency(data.variance)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="variance" fill="#8884d8">
                    {costVarianceBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Working Days Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Working Days Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={workingDaysBarData.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold">{data.fullTitle}</p>
                            <p>Working Days: {data.days}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="days" fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Progress Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Progress Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={progressOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="completion" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Task Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('title')}>
                      <div className="flex items-center gap-2">
                        Task Name
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('working_days')}>
                      <div className="flex items-center gap-2">
                        Working Days
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('estimated_cost')}>
                      <div className="flex items-center gap-2">
                        Estimated
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('actual_cost')}>
                      <div className="flex items-center gap-2">
                        Actual
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('cost_variance')}>
                      <div className="flex items-center gap-2">
                        Variance
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Variance %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Budget Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No tasks found
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>{task.start_date || 'N/A'}</TableCell>
                        <TableCell>{task.due_date || 'N/A'}</TableCell>
                        <TableCell>{formatWorkingDays(task.working_days)}</TableCell>
                        <TableCell>{formatCurrency(task.estimated_cost)}</TableCell>
                        <TableCell>{formatCurrency(task.actual_cost)}</TableCell>
                        <TableCell className={task.cost_variance >= 0 ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(Math.abs(task.cost_variance))}
                        </TableCell>
                        <TableCell>{formatPercentage(task.cost_variance_pct)}</TableCell>
                        <TableCell>
                          <span className="capitalize">{task.status.replace('_', ' ')}</span>
                        </TableCell>
                        <TableCell>
                          <span className={task.budget_status_color}>{task.budget_status_label}</span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
