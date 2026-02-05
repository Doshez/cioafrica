import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateDepartmentDialog } from '@/components/CreateDepartmentDialog';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { ProjectMembersCard } from '@/components/ProjectMembersCard';
import { useUserRole } from '@/hooks/useUserRole';
import { UpdateProjectLogoDialog } from '@/components/UpdateProjectLogoDialog';
import { ProjectLoadingScreen } from '@/components/ProjectLoadingScreen';
import { MessagingCenter } from '@/components/MessagingCenter';
import { ChatSettingsDialog } from '@/components/ChatSettingsDialog';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import {
  ArrowLeft, 
  Folder, 
  CheckCircle2, 
  Clock, 
  ListTodo,
  TrendingUp,
  ExternalLink,
  GanttChartSquare,
  Grid3x3,
  List,
  Filter,
  User,
  MessageSquare,
  BarChart3,
  Search,
  LayoutGrid,
  Table,
  FileText
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
  owner_id: string;
  logo_url?: string | null;
}

interface Department {
  id: string;
  name: string;
  description: string;
}

interface DepartmentAnalytics {
  department_id: string;
  department_name: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  todo_tasks: number;
  completion_percentage: number;
  earliest_start_date: string;
  latest_due_date: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  assignee_department_id: string;
  assignee_user_id?: string;
  assigned_user_ids?: string[]; // from task_assignments
}

export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isProjectManager } = useUserRole();
  
  const [project, setProject] = useState<Project | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentAnalytics, setDepartmentAnalytics] = useState<DepartmentAnalytics[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact' | 'table'>('grid');
  const [filterMode, setFilterMode] = useState<'all' | 'my' | 'active'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messagingOpen, setMessagingOpen] = useState(false);
  const { unreadCount } = useUnreadMessages(projectId || null);

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);

      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) throw projectError;
      
      if (!projectData) {
        toast({
          title: 'Error',
          description: 'Project not found or you do not have access',
          variant: 'destructive',
        });
        navigate('/projects');
        return;
      }
      
      setProject(projectData);

      // Fetch departments
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .eq('project_id', projectId)
        .order('name');

      if (deptError) throw deptError;
      setDepartments(deptData || []);

      // Fetch department analytics
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('department_analytics')
        .select('*')
        .eq('project_id', projectId);

      if (analyticsError) throw analyticsError;
      setDepartmentAnalytics(analyticsData || []);

      // Fetch all tasks for this project
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Fetch task assignments to know which users are assigned to which tasks
      const taskIds = (tasksData || []).map(t => t.id);
      let taskAssignmentsMap: Record<string, string[]> = {};
      
      if (taskIds.length > 0) {
        const { data: assignmentsData } = await supabase
          .from('task_assignments')
          .select('task_id, user_id')
          .in('task_id', taskIds);
        
        // Group user_ids by task_id
        (assignmentsData || []).forEach(a => {
          if (!taskAssignmentsMap[a.task_id]) {
            taskAssignmentsMap[a.task_id] = [];
          }
          taskAssignmentsMap[a.task_id].push(a.user_id);
        });
      }

      // Add assigned_user_ids to each task
      const tasksWithAssignments = (tasksData || []).map(task => ({
        ...task,
        assigned_user_ids: taskAssignmentsMap[task.id] || []
      }));

      setTasks(tasksWithAssignments);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-500';
      case 'in_progress':
        return 'bg-blue-500';
      case 'todo':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getDepartmentTasks = (departmentId: string) => {
    return tasks.filter(task => task.assignee_department_id === departmentId);
  };

  const userHasTasksInDepartment = (departmentId: string) => {
    if (isAdmin || isProjectManager) return true;
    return tasks.some(task => 
      task.assignee_department_id === departmentId && 
      (task.assignee_user_id === user?.id || task.assigned_user_ids?.includes(user?.id || ''))
    );
  };

  const getUserTaskCount = (departmentId: string) => {
    return tasks.filter(task => 
      task.assignee_department_id === departmentId && 
      (task.assignee_user_id === user?.id || task.assigned_user_ids?.includes(user?.id || ''))
    ).length;
  };

  const getFilteredAndSortedDepartments = () => {
    let filtered = [...departments];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(dept => 
        dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dept.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply filter
    if (filterMode === 'my' && !isAdmin && !isProjectManager) {
      filtered = filtered.filter(dept => userHasTasksInDepartment(dept.id));
    } else if (filterMode === 'active') {
      filtered = filtered.filter(dept => {
        const analytics = departmentAnalytics.find(a => a.department_id === dept.id);
        return analytics && analytics.in_progress_tasks > 0;
      });
    }

    // Sort: departments with user's tasks first, then by name
    return filtered.sort((a, b) => {
      const aHasTasks = userHasTasksInDepartment(a.id);
      const bHasTasks = userHasTasksInDepartment(b.id);
      
      if (aHasTasks && !bHasTasks) return -1;
      if (!aHasTasks && bHasTasks) return 1;
      
      // If both have or don't have tasks, sort by task count then name
      const aTaskCount = getUserTaskCount(a.id);
      const bTaskCount = getUserTaskCount(b.id);
      
      if (aTaskCount !== bTaskCount) return bTaskCount - aTaskCount;
      
      return a.name.localeCompare(b.name);
    });
  };

  if (loading || !project) {
    return <ProjectLoadingScreen projectId={projectId} />;
  }

  // Calculate project progress based on completed tasks
  const completedCount = tasks.filter(t => t.status === 'done').length;
  const projectProgress = tasks.length > 0 
    ? Math.round((completedCount / tasks.length) * 100)
    : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/projects')} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {project?.logo_url && (
            <img src={project.logo_url} alt={`${project.name} logo`} className="h-12 w-12 sm:h-16 sm:w-16 object-contain rounded flex-shrink-0" />
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{project?.name || 'Loading...'}</h1>
            <p className="text-sm text-muted-foreground line-clamp-2">{project?.description}</p>
          </div>
        </div>
        {(isAdmin || isProjectManager) && (
          <div className="flex flex-wrap gap-2">
            <UpdateProjectLogoDialog
              projectId={projectId!}
              currentLogoUrl={project.logo_url}
              onLogoUpdated={fetchProjectData}
            />
            <CreateDepartmentDialog 
              projectId={projectId!} 
              onDepartmentCreated={fetchProjectData}
            />
            <CreateTaskDialog 
              projectId={projectId}
              onTaskCreated={fetchProjectData}
              showTrigger={false}
            />
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="text-lg sm:text-xl">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <Button 
              onClick={() => navigate(`/projects/${projectId}/gantt`)}
              className="gap-1.5 sm:gap-2 text-xs sm:text-sm"
              size="default"
            >
              <GanttChartSquare className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden xs:inline">View </span>Gantt
            </Button>
            <Button 
              onClick={() => navigate(`/projects/${projectId}/documents`)}
              className="gap-1.5 sm:gap-2 text-xs sm:text-sm"
              size="default"
              variant="outline"
            >
              <Folder className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden xs:inline">Documents</span>
              <span className="xs:hidden">Docs</span>
            </Button>
            <Button 
              onClick={() => navigate(`/projects/${projectId}/analytics`)}
              className="gap-1.5 sm:gap-2 text-xs sm:text-sm"
              size="default"
              variant="outline"
            >
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
              Analytics
            </Button>
            <Button 
              onClick={() => setMessagingOpen(true)}
              className="gap-1.5 sm:gap-2 relative text-xs sm:text-sm"
              size="default"
              variant="outline"
            >
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden xs:inline">Messages</span>
              <span className="xs:hidden">Chat</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 min-w-5 px-1 text-[10px] sm:text-xs">
                  {unreadCount}
                </Badge>
              )}
            </Button>
            {isAdmin && (
              <Button 
                onClick={() => navigate(`/projects/${projectId}/reports`)}
                className="gap-1.5 sm:gap-2 text-xs sm:text-sm"
                size="default"
                variant="outline"
              >
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden xs:inline">Reports</span>
                <span className="xs:hidden">Reports</span>
              </Button>
            )}
            {(isAdmin || isProjectManager) && (
              <ChatSettingsDialog projectId={projectId!} />
            )}
          </div>
        </CardContent>
      </Card>

      <MessagingCenter 
        open={messagingOpen}
        onOpenChange={setMessagingOpen}
        projectId={projectId!}
      />

      {/* Project Overview and Members */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              Project Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs sm:text-sm">
                <span>Overall Completion</span>
                <span className="font-semibold">{projectProgress}%</span>
              </div>
              <Progress value={projectProgress} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Departments</p>
                <p className="text-lg sm:text-2xl font-bold">{departments.length}</p>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-lg sm:text-2xl font-bold">{tasks.length}</p>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Completed</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600">
                  {tasks.filter(t => t.status === 'done').length}
                </p>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground">In Progress</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-600">
                  {tasks.filter(t => t.status === 'in_progress').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Members */}
        <ProjectMembersCard projectId={projectId!} projectOwnerId={project.owner_id} />
      </div>

      {/* Departments and Analytics */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <h2 className="text-xl sm:text-2xl font-bold">Departments</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-[200px] lg:w-[240px]"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterMode} onValueChange={(value: any) => setFilterMode(value)}>
                <SelectTrigger className="flex-1 sm:w-[140px] lg:w-[180px]">
                  <Filter className="h-4 w-4 mr-1 sm:mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="my">My Depts</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border rounded-lg p-0.5 sm:p-1 flex-shrink-0">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="px-1.5 sm:px-2 h-8"
                  title="Grid View"
                >
                  <Grid3x3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant={viewMode === 'compact' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('compact')}
                  className="px-1.5 sm:px-2 h-8 hidden sm:flex"
                  title="Compact View"
                >
                  <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="px-1.5 sm:px-2 h-8"
                  title="List View"
                >
                  <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="px-1.5 sm:px-2 h-8 hidden md:flex"
                  title="Table View"
                >
                  <Table className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        {getFilteredAndSortedDepartments().length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {filterMode === 'my' ? (
                <p>You don't have any assigned tasks in this project yet.</p>
              ) : filterMode === 'active' ? (
                <p>No departments with active tasks.</p>
              ) : isAdmin || isProjectManager ? (
                <p>No departments yet. Create one to get started.</p>
              ) : (
                <div className="space-y-2">
                  <p>You don't have access to any departments yet.</p>
                  <p className="text-sm">You can only view departments where you have assigned tasks.</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'table' ? (
          <div className="max-h-[600px] overflow-y-auto">
            <div className="rounded-lg border">
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-4 font-semibold">Department</th>
                    <th className="text-left p-4 font-semibold">Description</th>
                    <th className="text-center p-4 font-semibold">Total</th>
                    <th className="text-center p-4 font-semibold">Completed</th>
                    <th className="text-center p-4 font-semibold">In Progress</th>
                    <th className="text-center p-4 font-semibold">Todo</th>
                    <th className="text-center p-4 font-semibold">Progress</th>
                    <th className="text-right p-4 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredAndSortedDepartments().map((dept) => {
                    const analytics = departmentAnalytics.find(a => a.department_id === dept.id);
                    const myTaskCount = getUserTaskCount(dept.id);
                    const hasMyTasks = userHasTasksInDepartment(dept.id);
                    
                    return (
                      <tr key={dept.id} className={`border-t hover:bg-muted/30 ${hasMyTasks && !isAdmin && !isProjectManager ? 'bg-primary/5' : ''}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{dept.name}</span>
                            {hasMyTasks && !isAdmin && !isProjectManager && (
                              <Badge variant="default" className="text-xs">
                                {myTaskCount}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground max-w-xs truncate">{dept.description}</td>
                        <td className="p-4 text-center font-semibold">{analytics?.total_tasks || 0}</td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            {analytics?.completed_tasks || 0}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center gap-1 text-blue-600">
                            <Clock className="h-4 w-4" />
                            {analytics?.in_progress_tasks || 0}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <ListTodo className="h-4 w-4" />
                            {analytics?.todo_tasks || 0}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-semibold">{analytics?.completion_percentage || 0}%</span>
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/projects/${projectId}/department/${dept.id}`)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
            <div className={
              viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2' : 
              viewMode === 'compact' ? 'grid gap-3 md:grid-cols-3 lg:grid-cols-4' : 
              'space-y-4'
            }>
              {getFilteredAndSortedDepartments().map((dept) => {
              const analytics = departmentAnalytics.find(a => a.department_id === dept.id);
              const deptTasks = getDepartmentTasks(dept.id);
              const myTaskCount = getUserTaskCount(dept.id);
              const hasMyTasks = userHasTasksInDepartment(dept.id);

              return viewMode === 'compact' ? (
                <Card key={dept.id} className={`${hasMyTasks && !isAdmin && !isProjectManager ? 'border-primary' : ''}`}>
                  <CardHeader className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Folder className="h-4 w-4 flex-shrink-0" />
                          <CardTitle className="text-base truncate">{dept.name}</CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0"
                          onClick={() => navigate(`/projects/${projectId}/department/${dept.id}`)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                      {hasMyTasks && !isAdmin && !isProjectManager && (
                        <Badge variant="default" className="text-xs w-fit">
                          {myTaskCount}
                        </Badge>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {analytics?.completed_tasks || 0}
                        </span>
                        <span className="text-blue-600 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {analytics?.in_progress_tasks || 0}
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <ListTodo className="h-3 w-3" />
                          {analytics?.todo_tasks || 0}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-center">
                        {analytics?.completion_percentage || 0}%
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ) : (
                <Card key={dept.id} className={hasMyTasks && !isAdmin && !isProjectManager ? 'border-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="flex items-center gap-2">
                            <Folder className="h-5 w-5" />
                            {dept.name}
                          </CardTitle>
                          {hasMyTasks && !isAdmin && !isProjectManager && (
                            <Badge variant="default" className="gap-1">
                              <User className="h-3 w-3" />
                              {myTaskCount} My {myTaskCount === 1 ? 'Task' : 'Tasks'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{dept.description}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/projects/${projectId}/department/${dept.id}`)}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analytics && (
                      <>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Completion</span>
                            <span className="font-semibold">{analytics.completion_percentage || 0}%</span>
                          </div>
                          <Progress value={analytics.completion_percentage || 0} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="space-y-1">
                            <CheckCircle2 className="h-4 w-4 mx-auto text-green-600" />
                            <p className="text-xs text-muted-foreground">Completed</p>
                            <p className="font-semibold">{analytics.completed_tasks}</p>
                          </div>
                          <div className="space-y-1">
                            <Clock className="h-4 w-4 mx-auto text-blue-600" />
                            <p className="text-xs text-muted-foreground">In Progress</p>
                            <p className="font-semibold">{analytics.in_progress_tasks}</p>
                          </div>
                          <div className="space-y-1">
                            <ListTodo className="h-4 w-4 mx-auto text-gray-600" />
                            <p className="text-xs text-muted-foreground">To Do</p>
                            <p className="font-semibold">{analytics.todo_tasks}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
