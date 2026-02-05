import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Search, Filter, List, Columns, Table, Calendar, User } from 'lucide-react';
import type { ViewType, TaskFilters } from './types';

interface TaskViewSwitcherProps {
  viewType: ViewType;
  onViewChange: (view: ViewType) => void;
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  currentUserId?: string;
}

export function TaskViewSwitcher({ 
  viewType, 
  onViewChange, 
  filters, 
  onFiltersChange,
  currentUserId 
}: TaskViewSwitcherProps) {
  const updateFilter = (key: keyof TaskFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const viewOptions: { value: ViewType; label: string; icon: React.ReactNode }[] = [
    { value: 'list', label: 'List', icon: <List className="h-4 w-4" /> },
    { value: 'kanban', label: 'Kanban', icon: <Columns className="h-4 w-4" /> },
    { value: 'table', label: 'Table', icon: <Table className="h-4 w-4" /> },
    { value: 'calendar', label: 'Calendar', icon: <Calendar className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4">
      {/* View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          {viewOptions.map(option => (
            <Button
              key={option.value}
              variant={viewType === option.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange(option.value)}
              className="gap-2"
            >
              {option.icon}
              <span className="hidden sm:inline">{option.label}</span>
            </Button>
          ))}
        </div>

        {/* My Tasks Toggle */}
        {currentUserId && (
          <Toggle
            pressed={filters.myTasks}
            onPressedChange={(pressed) => updateFilter('myTasks', pressed)}
            aria-label="Show my tasks only"
            className="gap-2"
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">My Tasks</span>
          </Toggle>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter */}
        <Select value={filters.status} onValueChange={(v) => updateFilter('status', v)}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select value={filters.priority} onValueChange={(v) => updateFilter('priority', v)}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {(filters.search || filters.status !== 'all' || filters.priority !== 'all' || filters.myTasks) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFiltersChange({
              search: '',
              status: 'all',
              priority: 'all',
              assignee: 'all',
              myTasks: false,
            })}
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
