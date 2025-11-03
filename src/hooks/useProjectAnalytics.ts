import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { computeTaskAnalytics, computeProjectKPIs, computeBudgetStatusDistribution, TaskAnalytics, ProjectKPIs, BudgetStatusDistribution } from '@/lib/workingDays';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface Task {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  status: string;
  progress_percentage: number;
  priority: string;
  estimated_cost: number;
  actual_cost: number;
  assignee_department_id: string | null;
  project_id: string;
}

interface UseProjectAnalyticsOptions {
  projectId: string;
  statusFilter?: string;
  searchQuery?: string;
}

interface UseProjectAnalyticsReturn {
  tasks: Task[];
  taskAnalytics: TaskAnalytics[];
  filteredTaskAnalytics: TaskAnalytics[];
  kpis: ProjectKPIs;
  budgetDistribution: BudgetStatusDistribution;
  loading: boolean;
  refreshData: () => Promise<void>;
}

/**
 * Custom hook for project analytics data layer
 * Handles fetching, computation, filtering, and real-time updates
 */
export function useProjectAnalytics({
  projectId,
  statusFilter = 'all',
  searchQuery = ''
}: UseProjectAnalyticsOptions): UseProjectAnalyticsReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch data from Supabase
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;
      if (data) setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  // Real-time subscription for live updates
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`tasks:project_id=eq.${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`
        },
        (payload: RealtimePostgresChangesPayload<Task>) => {
          console.log('Real-time task update:', payload);
          
          // Handle INSERT
          if (payload.eventType === 'INSERT' && payload.new) {
            setTasks(prev => [...prev, payload.new as Task]);
          }
          
          // Handle UPDATE
          if (payload.eventType === 'UPDATE' && payload.new) {
            setTasks(prev => prev.map(t => 
              t.id === payload.new.id ? payload.new as Task : t
            ));
          }
          
          // Handle DELETE
          if (payload.eventType === 'DELETE' && payload.old) {
            setTasks(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Compute analytics for all tasks
  const taskAnalytics = useMemo(() => {
    return tasks.map(task => computeTaskAnalytics({
      ...task,
      progress: task.progress_percentage
    }));
  }, [tasks]);

  // Filter tasks based on status and search query
  const filteredTaskAnalytics = useMemo(() => {
    return taskAnalytics.filter(task => {
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [taskAnalytics, statusFilter, searchQuery]);

  // Compute KPIs from filtered tasks
  const kpis = useMemo(() => {
    return computeProjectKPIs(filteredTaskAnalytics);
  }, [filteredTaskAnalytics]);

  // Compute budget distribution
  const budgetDistribution = useMemo(() => {
    return computeBudgetStatusDistribution(filteredTaskAnalytics);
  }, [filteredTaskAnalytics]);

  return {
    tasks,
    taskAnalytics,
    filteredTaskAnalytics,
    kpis,
    budgetDistribution,
    loading,
    refreshData: fetchData
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: 'USD' | 'KES' = 'USD'): string {
  return new Intl.NumberFormat(currency === 'KES' ? 'en-KE' : 'en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number | null): string {
  if (value === null) return 'N/A';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

/**
 * Format working days for display
 */
export function formatWorkingDays(days: number): string {
  if (days === 0) return '0 days';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/**
 * Get color class for budget status
 */
export function getBudgetStatusColor(status: 'under' | 'on' | 'over' | 'na'): string {
  switch (status) {
    case 'under':
      return 'hsl(var(--chart-2))'; // Green
    case 'on':
      return 'hsl(var(--chart-3))'; // Yellow
    case 'over':
      return 'hsl(var(--chart-1))'; // Red
    default:
      return 'hsl(var(--muted))'; // Gray
  }
}

/**
 * Prepare data for Cost Status Pie Chart
 */
export function prepareCostStatusPieData(distribution: BudgetStatusDistribution) {
  return [
    { name: 'Under Budget', value: distribution.underBudget, color: 'hsl(var(--chart-2))' },
    { name: 'On Budget', value: distribution.onBudget, color: 'hsl(var(--chart-3))' },
    { name: 'Over Budget', value: distribution.overBudget, color: 'hsl(var(--chart-1))' }
  ].filter(item => item.value > 0); // Only show categories with values
}

/**
 * Prepare data for Cost Variance Bar Chart
 */
export function prepareCostVarianceBarData(tasks: TaskAnalytics[]) {
  return tasks
    .filter(t => t.estimated_cost > 0) // Only show tasks with estimates
    .map(task => ({
      name: task.title.length > 20 ? task.title.substring(0, 20) + '...' : task.title,
      variance: task.cost_variance,
      color: getBudgetStatusColor(task.budget_status),
      fullTitle: task.title,
      estimated: task.estimated_cost,
      actual: task.actual_cost
    }));
}

/**
 * Prepare data for Working Days Distribution Chart
 */
export function prepareWorkingDaysBarData(tasks: TaskAnalytics[]) {
  return tasks
    .filter(t => t.working_days > 0)
    .map(task => ({
      name: task.title.length > 15 ? task.title.substring(0, 15) + '...' : task.title,
      days: task.working_days,
      fullTitle: task.title
    }));
}

/**
 * Prepare data for Progress Over Time Line Chart
 * Groups tasks by completion date to show cumulative progress
 */
export function prepareProgressOverTimeData(tasks: Task[]) {
  const completedTasks = tasks.filter(t => t.status === 'completed');
  
  // Group by date (stub - in production, use actual completion timestamps)
  const dateGroups = new Map<string, number>();
  
  completedTasks.forEach(task => {
    // Use due_date as proxy for completion date
    if (task.due_date) {
      const count = dateGroups.get(task.due_date) || 0;
      dateGroups.set(task.due_date, count + 1);
    }
  });

  // Convert to cumulative series
  const sortedDates = Array.from(dateGroups.keys()).sort();
  let cumulative = 0;
  
  return sortedDates.map(date => {
    cumulative += dateGroups.get(date) || 0;
    const completionPct = tasks.length > 0 ? (cumulative / tasks.length) * 100 : 0;
    return {
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      completion: Math.round(completionPct)
    };
  });
}
