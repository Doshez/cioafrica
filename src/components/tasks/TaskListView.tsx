import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Percent, Edit } from 'lucide-react';
import type { TaskViewProps, TaskWithProfile } from './types';
import { useMemo } from 'react';

interface TaskListViewProps extends Omit<TaskViewProps, 'onStatusUpdate' | 'onProgressUpdate'> {
  groupByElement?: boolean;
  onStatusUpdate?: (taskId: string, status: string) => void;
  onProgressUpdate?: (taskId: string, progress: number) => void;
}

interface GroupedTasks {
  elementId: string | null;
  elementTitle: string;
  tasks: TaskWithProfile[];
}

export function TaskListView({ 
  tasks, 
  onStatusUpdate,
  onProgressUpdate,
  onEditTask,
  canEdit = true,
  showProject = false,
  groupByElement = true
}: TaskListViewProps) {
  const groupedTasks = useMemo(() => {
    if (!groupByElement) {
      return [{
        elementId: 'all',
        elementTitle: 'All Tasks',
        tasks
      }];
    }
    
    return tasks.reduce((acc, task) => {
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
  }, [tasks, groupByElement]);

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

  return (
    <div className="space-y-6 max-h-[calc(100vh-280px)] overflow-y-auto pr-2 scrollbar-thin">
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
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {onEditTask && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => onEditTask(task)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Badge className={getStatusColor(task.status, taskOverdue)}>
                              {taskOverdue ? 'Overdue' : task.status === 'in_progress' ? 'In Progress' : task.status === 'done' ? 'Done' : 'To Do'}
                            </Badge>
                          </div>
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                            {task.description}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {showProject && task.projects && (
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
                          {onProgressUpdate && canEdit && (
                            <Slider
                              value={[task.progress_percentage || 0]}
                              onValueChange={(value) => onProgressUpdate(task.id, value[0])}
                              max={100}
                              step={1}
                              className="w-full"
                            />
                          )}
                        </div>

                        {onStatusUpdate && canEdit && (
                          <Select
                            value={task.status}
                            onValueChange={(value) => onStatusUpdate(task.id, value)}
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
                        )}
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
  );
}
