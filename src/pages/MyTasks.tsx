import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock, Search, Filter, Plus, Percent, LayoutGrid, List, Columns3 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  start_date: string | null;
  project_id: string;
  element_id: string | null;
  progress_percentage: number;
  projects: {
    name: string;
  } | null;
  elements: {
    id: string;
    title: string;
  } | null;
}

interface Project {
  id: string;
  name: string;
}

interface GroupedTasks {
  elementId: string | null;
  elementTitle: string;
  tasks: Task[];
}

export default function MyTasks() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [groupedTasks, setGroupedTasks] = useState<GroupedTasks[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'kanban'>('cards');

  useEffect(() => {
    if (user) {
      fetchMyTasks();
      fetchProjects();
    }
  }, [user]);

  useEffect(() => {
    groupTasksByElement();
  }, [tasks, searchTerm, selectedProject]);

  const fetchMyTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          start_date,
          project_id,
          element_id,
          progress_percentage,
          projects (
            name
          ),
          elements (
            id,
            title
          )
        `)
        .eq('assignee_user_id', user?.id)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setTasks(data || []);
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

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
    }
  };

  const groupTasksByElement = () => {
    let filteredTasks = tasks;

    // Filter by search term
    if (searchTerm) {
      filteredTasks = filteredTasks.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.elements?.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by project
    if (selectedProject !== "all") {
      filteredTasks = filteredTasks.filter(task => task.project_id === selectedProject);
    }

    // Group by element
    const grouped = filteredTasks.reduce((acc, task) => {
      const elementId = task.element_id || 'no-element';
      const elementTitle = task.elements?.title || 'No Element';
      
      const existingGroup = acc.find(g => g.elementId === elementId);
      if (existingGroup) {
        existingGroup.tasks.push(task);
      } else {
        acc.push({
          elementId,
          elementTitle,
          tasks: [task]
        });
      }
      return acc;
    }, [] as GroupedTasks[]);

    setGroupedTasks(grouped);
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      let newPercentage = tasks.find(t => t.id === taskId)?.progress_percentage || 0;
      
      // Sync percentage with status
      if (newStatus === 'todo') {
        newPercentage = 0;
      } else if (newStatus === 'in_progress' && newPercentage === 0) {
        newPercentage = 1;
      } else if (newStatus === 'done') {
        newPercentage = 100;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          progress_percentage: newPercentage,
          ...(newStatus === 'done' && { completed_at: new Date().toISOString() })
        })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus, progress_percentage: newPercentage } : task
      ));

      toast({
        title: "Success",
        description: "Task status updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateTaskProgress = async (taskId: string, newProgress: number) => {
    try {
      // Determine status based on percentage
      let newStatus = 'todo';
      if (newProgress === 0) {
        newStatus = 'todo';
      } else if (newProgress > 0 && newProgress < 100) {
        newStatus = 'in_progress';
      } else if (newProgress === 100) {
        newStatus = 'done';
      }

      const { error } = await supabase
        .from('tasks')
        .update({ 
          progress_percentage: newProgress,
          status: newStatus,
          ...(newStatus === 'done' && { completed_at: new Date().toISOString() })
        })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, progress_percentage: newProgress, status: newStatus } : task
      ));

      toast({
        title: "Success",
        description: "Task progress updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === 'done') return false;
    return new Date(dueDate) < new Date();
  };

  const getStatusColor = (status: string, isTaskOverdue: boolean = false) => {
    if (isTaskOverdue) return 'bg-destructive text-destructive-foreground';
    
    switch (status) {
      case 'todo': return 'bg-secondary text-secondary-foreground';
      case 'in_progress': return 'bg-primary text-primary-foreground';
      case 'done': return 'bg-green-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-accent text-accent-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Tasks</h1>
          <p className="text-muted-foreground mt-2">
            Tasks assigned to you across all projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-auto">
            <TabsList>
              <TabsTrigger value="cards" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Cards</span>
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">List</span>
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-2">
                <Columns3 className="h-4 w-4" />
                <span className="hidden sm:inline">Board</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {isAdmin && <CreateTaskDialog onTaskCreated={fetchMyTasks} showTrigger={false} />}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks or elements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grouped Tasks */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : groupedTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchTerm || selectedProject !== "all"
                ? "No tasks found matching your filters"
                : "No tasks assigned to you yet"}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="space-y-6 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
          {groupedTasks.map((group) => (
            <Card key={group.elementId} className="overflow-hidden">
              <CardHeader className="bg-muted/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  {group.elementTitle}
                  <Badge variant="secondary" className="ml-auto">
                    {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <div className="flex gap-4 p-4 overflow-x-auto min-h-[200px] max-h-[calc(100vh-320px)]">
                    {group.tasks.map((task) => {
                      const taskOverdue = isOverdue(task.due_date, task.status);
                      return (
                        <Card 
                          key={task.id} 
                          className={`min-w-[340px] flex-shrink-0 hover:shadow-md transition-shadow ${
                            taskOverdue ? 'border-destructive' : ''
                          }`}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-base line-clamp-2">
                                {task.title}
                              </CardTitle>
                              <Badge className={getStatusColor(task.status, taskOverdue)}>
                                {taskOverdue ? 'Overdue' : task.status === 'in_progress' ? 'In Progress' : task.status === 'done' ? 'Done' : 'To Do'}
                              </Badge>
                            </div>
                            {task.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                                {task.description}
                              </p>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                              {task.projects && (
                                <Badge variant="outline" className="text-xs">
                                  {task.projects.name}
                                </Badge>
                              )}
                              <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                                {task.priority}
                              </Badge>
                            </div>

                            {task.due_date && (
                              <div className={`flex items-center gap-2 text-xs ${
                                taskOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                              }`}>
                                <Clock className="h-3 w-3" />
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </div>
                            )}

                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1">
                                  <Percent className="h-3 w-3" />
                                  <span className="text-muted-foreground">Progress</span>
                                </div>
                                <span className="font-medium text-base">{task.progress_percentage || 0}%</span>
                              </div>
                              <Slider
                                value={[task.progress_percentage || 0]}
                                onValueChange={(value) => updateTaskProgress(task.id, value[0])}
                                max={100}
                                step={1}
                                className="w-full"
                              />
                            </div>

                            <Select
                              value={task.status}
                              onValueChange={(value) => updateTaskStatus(task.id, value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todo">To Do (0%)</SelectItem>
                                <SelectItem value="in_progress">In Progress (1-99%)</SelectItem>
                                <SelectItem value="done">Done (100%)</SelectItem>
                              </SelectContent>
                            </Select>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
          <Card>
            <CardContent className="p-0">
            {groupedTasks.map((group) => (
              <div key={group.elementId} className="border-b last:border-b-0">
                <div className="bg-muted/50 px-4 py-2 font-semibold text-sm flex items-center justify-between">
                  <span>{group.elementTitle}</span>
                  <Badge variant="secondary">{group.tasks.length}</Badge>
                </div>
                <div className="divide-y">
                  {group.tasks.map((task) => {
                    const taskOverdue = isOverdue(task.due_date, task.status);
                    return (
                      <div 
                        key={task.id} 
                        className={`p-4 hover:bg-muted/50 transition-colors ${
                          taskOverdue ? 'bg-destructive/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className={`font-medium truncate ${taskOverdue ? 'text-destructive' : ''}`}>
                                {task.title}
                              </h4>
                              {taskOverdue && (
                                <Badge variant="destructive" className="text-xs shrink-0">Overdue</Badge>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs">
                              {task.projects && (
                                <Badge variant="outline" className="text-xs">
                                  {task.projects.name}
                                </Badge>
                              )}
                              <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                                {task.priority}
                              </Badge>
                              {task.due_date && (
                                <span className={taskOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {new Date(task.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="w-24">
                              <div className="text-xs text-muted-foreground mb-1">Progress</div>
                              <Slider
                                value={[task.progress_percentage || 0]}
                                onValueChange={(value) => updateTaskProgress(task.id, value[0])}
                                max={100}
                                step={1}
                                className="w-full"
                              />
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold">{task.progress_percentage || 0}%</div>
                            </div>
                            <Select
                              value={task.status}
                              onValueChange={(value) => updateTaskStatus(task.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background z-50">
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['todo', 'in_progress', 'done'].map((status) => {
            const statusTasks = groupedTasks.flatMap(g => 
              g.tasks.filter(t => t.status === status)
            );
            const statusLabel = status === 'todo' ? 'To Do' : status === 'in_progress' ? 'In Progress' : 'Done';
            
            return (
              <Card key={status}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{statusLabel}</span>
                    <Badge variant="secondary">{statusTasks.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ScrollArea className="h-[calc(100vh-360px)] pr-4">
                    {statusTasks.map((task) => {
                      const taskOverdue = isOverdue(task.due_date, task.status);
                      return (
                        <Card 
                          key={task.id} 
                          className={`mb-3 ${taskOverdue ? 'border-destructive' : ''}`}
                        >
                          <CardContent className="p-3">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className={`text-sm font-semibold line-clamp-2 ${
                                  taskOverdue ? 'text-destructive' : ''
                                }`}>
                                  {task.title}
                                </h4>
                                {taskOverdue && (
                                  <Badge variant="destructive" className="text-xs shrink-0">
                                    Overdue
                                  </Badge>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {task.projects && (
                                  <Badge variant="outline" className="text-xs">
                                    {task.projects.name}
                                  </Badge>
                                )}
                                <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                                  {task.priority}
                                </Badge>
                              </div>
                              {task.due_date && (
                                <div className={`flex items-center gap-1 text-xs ${
                                  taskOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                                }`}>
                                  <Clock className="h-3 w-3" />
                                  Due: {new Date(task.due_date).toLocaleDateString()}
                                </div>
                              )}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Progress</span>
                                  <span className="font-medium">{task.progress_percentage || 0}%</span>
                                </div>
                                <Slider
                                  value={[task.progress_percentage || 0]}
                                  onValueChange={(value) => updateTaskProgress(task.id, value[0])}
                                  max={100}
                                  step={1}
                                  className="w-full"
                                />
                              </div>
                              <Select
                                value={task.status}
                                onValueChange={(value) => updateTaskStatus(task.id, value)}
                              >
                                <SelectTrigger className="w-full h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background z-50">
                                  <SelectItem value="todo">To Do (0%)</SelectItem>
                                  <SelectItem value="in_progress">In Progress (1-99%)</SelectItem>
                                  <SelectItem value="done">Done (100%)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </ScrollArea>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
