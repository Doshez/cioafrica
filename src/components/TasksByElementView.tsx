import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Edit, User, Percent, Trash2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AssignedUser {
  id: string;
  name: string;
  email?: string;
}

interface TaskWithProfile {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  assignee_department_id: string;
  assignee_user_id?: string;
  description?: string;
  progress_percentage?: number;
  estimate_hours?: number;
  logged_hours?: number;
  assigned_users?: AssignedUser[];
  element_id?: string;
  element_name?: string;
}

interface Element {
  id: string;
  title: string;
  description?: string;
}

interface TasksByElementViewProps {
  tasks: TaskWithProfile[];
  elements?: Element[];
  onStatusUpdate: (taskId: string, status: string) => void;
  onProgressUpdate: (taskId: string, progress: number) => void;
  onEditTask?: (task: TaskWithProfile) => void;
  onEditElement?: (elementId: string, elementName: string) => void;
  onDeleteElement?: (elementId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  canDelete?: boolean;
}

export function TasksByElementView({ 
  tasks, 
  elements = [],
  onStatusUpdate, 
  onProgressUpdate,
  onEditTask,
  onEditElement,
  onDeleteElement,
  onDeleteTask,
  canDelete = false
}: TasksByElementViewProps) {
  const [deletingElementId, setDeletingElementId] = React.useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = React.useState<string | null>(null);
  // Group tasks by element
  const tasksByElement = tasks.reduce((acc, task) => {
    const elementId = task.element_id || 'ungrouped';
    const elementName = task.element_name || 'Ungrouped Tasks';
    
    if (!acc[elementId]) {
      acc[elementId] = {
        id: elementId,
        name: elementName,
        tasks: []
      };
    }
    acc[elementId].tasks.push(task);
    
    return acc;
  }, {} as Record<string, { id: string; name: string; tasks: TaskWithProfile[] }>);

  // Add elements without tasks
  elements.forEach(element => {
    if (!tasksByElement[element.id]) {
      tasksByElement[element.id] = {
        id: element.id,
        name: element.title,
        tasks: []
      };
    }
  });

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

  const isOverdue = (dueDate: string, status: string) => {
    if (!dueDate || status === 'done') return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max">
        {Object.entries(tasksByElement).map(([elementId, elementData]) => (
          <div key={elementId} className="flex-shrink-0 w-[380px]">
            {/* Element Header */}
            <div className="mb-4 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{elementData.name}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">
                    {elementData.tasks.length} {elementData.tasks.length === 1 ? 'task' : 'tasks'}
                  </Badge>
                  {elementId !== 'ungrouped' && onEditElement && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEditElement(elementId, elementData.name)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {elementId !== 'ungrouped' && canDelete && onDeleteElement && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingElementId(elementId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Tasks - Scrollable */}
            <div className="space-y-3 max-h-[calc(100vh-240px)] overflow-y-auto pr-2">
              {elementData.tasks.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8">
                    <p className="text-sm text-muted-foreground text-center">
                      No tasks in this element yet
                    </p>
                  </CardContent>
                </Card>
              ) : (
                elementData.tasks.map((task) => {
                const progress = task.progress_percentage ?? (task.status === 'done' ? 100 : task.status === 'in_progress' ? 50 : 0);
                const taskOverdue = isOverdue(task.due_date, task.status);
                
                return (
                  <Card key={task.id} className={`hover:shadow-md transition-shadow ${taskOverdue ? 'border-destructive' : ''}`}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Title, Priority, and Edit Button */}
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <h4 className="text-sm font-semibold flex-1 leading-tight">{task.title}</h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                                {task.priority}
                              </Badge>
                              {taskOverdue && (
                                <Badge variant="destructive" className="text-xs">
                                  Overdue
                                </Badge>
                              )}
                              {onEditTask && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => onEditTask(task)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                              {canDelete && onDeleteTask && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => setDeletingTaskId(task.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {/* Show assigned users */}
                          {task.assigned_users && task.assigned_users.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {task.assigned_users.map(user => (
                                <Badge key={user.id} variant="outline" className="text-xs">
                                  <User className="h-3 w-3 mr-1" />
                                  {user.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        {/* Dates */}
                        <div className="flex flex-wrap gap-2 text-xs">
                          {task.start_date && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(task.start_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {task.due_date && (
                            <div className={`flex items-center gap-1 ${taskOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                              <Clock className="h-3 w-3" />
                              <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {task.estimate_hours && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{task.estimate_hours}h est.</span>
                            </div>
                          )}
                        </div>

                        {/* Progress Control with Slider */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1">
                              <Percent className="h-3 w-3" />
                              <span className="text-muted-foreground">Progress</span>
                            </div>
                            <span className="font-medium text-base">{progress}%</span>
                          </div>
                          <Slider
                            value={[progress]}
                            onValueChange={(value) => onProgressUpdate(task.id, value[0])}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>

                        {/* Status Control */}
                        <Select 
                          value={task.status} 
                          onValueChange={(value) => onStatusUpdate(task.id, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
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
              })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Delete Element Confirmation Dialog */}
      <AlertDialog open={!!deletingElementId} onOpenChange={(open) => !open && setDeletingElementId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Element</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this element? This action cannot be undone. All tasks in this element will become ungrouped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingElementId && onDeleteElement) {
                  onDeleteElement(deletingElementId);
                  setDeletingElementId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Task Confirmation Dialog */}
      <AlertDialog open={!!deletingTaskId} onOpenChange={(open) => !open && setDeletingTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingTaskId && onDeleteTask) {
                  onDeleteTask(deletingTaskId);
                  setDeletingTaskId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
