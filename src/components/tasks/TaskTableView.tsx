import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { TaskViewProps, TaskWithProfile } from './types';

type SortField = 'title' | 'status' | 'priority' | 'due_date' | 'progress_percentage';
type SortDirection = 'asc' | 'desc';

export function TaskTableView({ 
  tasks, 
  onStatusUpdate, 
  onProgressUpdate,
  onDateUpdate,
  onEditTask,
  onDeleteTask,
  canEdit = true,
  canDelete = false,
  showProject = false
}: TaskViewProps) {
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: string } | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const toggleSelectAll = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map(t => t.id)));
    }
  };

  const toggleSelect = (taskId: string) => {
    const newSet = new Set(selectedTasks);
    if (newSet.has(taskId)) {
      newSet.delete(taskId);
    } else {
      newSet.add(taskId);
    }
    setSelectedTasks(newSet);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'todo': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (!dueDate || status === 'done') return false;
    return new Date(dueDate) < new Date();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const handleInlineDateChange = (taskId: string, field: 'start_date' | 'due_date', value: string) => {
    if (onDateUpdate) {
      onDateUpdate(taskId, field, value);
    }
    setEditingCell(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px] rounded-md border">
      <div className="flex-1 overflow-auto">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={selectedTasks.size === tasks.length && tasks.length > 0}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('title')}
            >
              <div className="flex items-center gap-1">
                Title
                <SortIcon field="title" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 w-32"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center gap-1">
                Status
                <SortIcon field="status" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 w-28"
              onClick={() => handleSort('priority')}
            >
              <div className="flex items-center gap-1">
                Priority
                <SortIcon field="priority" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 w-40"
              onClick={() => handleSort('progress_percentage')}
            >
              <div className="flex items-center gap-1">
                Progress
                <SortIcon field="progress_percentage" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 w-32"
              onClick={() => handleSort('due_date')}
            >
              <div className="flex items-center gap-1">
                Due Date
                <SortIcon field="due_date" />
              </div>
            </TableHead>
            <TableHead className="w-24">Assignees</TableHead>
            <TableHead className="w-20">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No tasks found
              </TableCell>
            </TableRow>
          ) : (
            sortedTasks.map(task => {
              const taskOverdue = isOverdue(task.due_date, task.status);
              const progress = task.progress_percentage ?? 0;

              return (
                <TableRow 
                  key={task.id} 
                  className={`${taskOverdue ? 'bg-destructive/5' : ''} ${selectedTasks.has(task.id) ? 'bg-muted/50' : ''}`}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedTasks.has(task.id)}
                      onCheckedChange={() => toggleSelect(task.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{task.title}</span>
                      {task.element_name && (
                        <span className="text-xs text-muted-foreground">{task.element_name}</span>
                      )}
                      {showProject && task.projects && (
                        <span className="text-xs text-muted-foreground">{task.projects.name}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Select 
                        value={task.status} 
                        onValueChange={(value) => onStatusUpdate(task.id, value)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(task.status)}`} />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(task.status)}`} />
                        <span className="text-sm capitalize">{task.status.replace('_', ' ')}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Select 
                        value={task.priority} 
                        onValueChange={(value) => {
                          // Would need to add onPriorityUpdate handler
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                        {task.priority}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[progress]}
                          onValueChange={(value) => onProgressUpdate(task.id, value[0])}
                          max={100}
                          step={5}
                          className="w-20"
                        />
                        <span className="text-xs w-8">{progress}%</span>
                      </div>
                    ) : (
                      <span className="text-sm">{progress}%</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEdit && editingCell?.taskId === task.id && editingCell.field === 'due_date' ? (
                      <Input
                        type="date"
                        defaultValue={task.due_date}
                        className="h-8 text-xs"
                        onBlur={(e) => handleInlineDateChange(task.id, 'due_date', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleInlineDateChange(task.id, 'due_date', (e.target as HTMLInputElement).value);
                          }
                          if (e.key === 'Escape') {
                            setEditingCell(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <span 
                        className={`text-sm cursor-pointer hover:underline ${taskOverdue ? 'text-destructive font-medium' : ''}`}
                        onClick={() => canEdit && setEditingCell({ taskId: task.id, field: 'due_date' })}
                      >
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.assigned_users && task.assigned_users.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {task.assigned_users.slice(0, 2).map(user => (
                          <Badge key={user.id} variant="outline" className="text-xs">
                            {user.name.split(' ')[0]}
                          </Badge>
                        ))}
                        {task.assigned_users.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{task.assigned_users.length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {onEditTask && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEditTask(task)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete && onDeleteTask && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => onDeleteTask(task.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
