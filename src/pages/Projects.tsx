import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Calendar, Loader2, ArrowRight, Trash2, FolderKanban, Plus, MoreHorizontal, Power } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { EditProjectDialog } from '@/components/EditProjectDialog';
import { DuplicateProjectDialog } from '@/components/DuplicateProjectDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string;
  end_date: string | null;
  logo_url?: string | null;
  owner_id?: string | null;
  project_category?: string;
  client_name?: string | null;
}

interface ProjectWithStats extends Project {
  taskCount: number;
  completedCount: number;
  progress: number;
}

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isProjectManager } = useUserRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');

  useEffect(() => {
    if (user && (isAdmin !== undefined && isProjectManager !== undefined)) {
      fetchProjects();
    }
  }, [user, isAdmin, isProjectManager]);

  const fetchProjects = async () => {
    try {
      let projectsQuery = supabase
        .from('projects')
        .select('id, name, description, status, start_date, end_date, logo_url, owner_id, project_category, client_name')
        .order('created_at', { ascending: false });

      // Admin sees all projects; PM and regular users see only projects they own or are members of
      if (!isAdmin) {
        // Get projects where user is owner
        const { data: ownedProjects } = await supabase
          .from('projects')
          .select('id')
          .eq('owner_id', user?.id);

        // Get projects where user is a member
        const { data: memberProjects } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', user?.id);

        const ownedIds = (ownedProjects || []).map(p => p.id);
        const memberIds = (memberProjects || []).map(p => p.project_id);
        const allIds = [...new Set([...ownedIds, ...memberIds])];

        if (allIds.length > 0) {
          projectsQuery = projectsQuery.in('id', allIds);
        } else {
          setProjects([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await projectsQuery;
      if (error) throw error;

      // Fetch task stats for all projects
      const projectIds = (data || []).map(p => p.id);
      let taskStats: Record<string, { total: number; completed: number }> = {};
      
      if (projectIds.length > 0) {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, status, project_id')
          .in('project_id', projectIds);

        (tasks || []).forEach(t => {
          if (!taskStats[t.project_id]) taskStats[t.project_id] = { total: 0, completed: 0 };
          taskStats[t.project_id].total++;
          if (['done', 'completed', 'complete'].includes(t.status || '')) {
            taskStats[t.project_id].completed++;
          }
        });
      }

      const projectsWithStats: ProjectWithStats[] = (data || []).map(p => {
        const stats = taskStats[p.id] || { total: 0, completed: 0 };
        return {
          ...p,
          taskCount: stats.total,
          completedCount: stats.completed,
          progress: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        };
      });

      setProjects(projectsWithStats);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      const { error } = await supabase.from('projects').delete().eq('id', projectToDelete.id);
      if (error) throw error;
      toast({ title: "Success", description: "Project deleted successfully" });
      fetchProjects();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const handleToggleProjectStatus = async (project: Project) => {
    const newStatus = project.status === 'inactive' ? 'active' : 'inactive';
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', project.id);
      if (error) throw error;
      toast({ title: "Success", description: `Project marked as ${newStatus}` });
      fetchProjects();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const canToggleStatus = (project: Project) => {
    if (isAdmin) return true;
    if (isProjectManager && project.owner_id === user?.id) return true;
    return false;
  };

  // Get unique client names for filter
  const clientNames = [...new Set(projects.filter(p => p.client_name).map(p => p.client_name!))].sort();

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.client_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || project.project_category === categoryFilter;
    const matchesClient = clientFilter === 'all' || project.client_name === clientFilter;
    return matchesSearch && matchesStatus && matchesCategory && matchesClient;
  });

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'active': return 'border-success/30 text-success bg-success/5';
      case 'inactive': return 'border-muted-foreground/30 text-muted-foreground bg-muted/50';
      case 'review': return 'border-warning/30 text-warning bg-warning/5';
      case 'completed': return 'border-primary/30 text-primary bg-primary/5';
      default: return 'border-border text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statuses = ['all', ...new Set(projects.map(p => p.status))];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''} total
          </p>
        </div>
        {(isAdmin || isProjectManager) && (
          <Button className="gap-2" onClick={() => navigate('/projects/new')}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects or clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Category filter */}
          <div className="flex gap-1.5">
            {['all', 'cio_africa', 'client'].map(cat => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setCategoryFilter(cat); if (cat !== 'client') setClientFilter('all'); }}
                className="text-xs whitespace-nowrap"
              >
                {cat === 'all' ? 'All' : cat === 'cio_africa' ? 'CIO Africa' : 'Client'}
              </Button>
            ))}
          </div>
          {/* Client filter - shown when category is 'client' or 'all' and there are client projects */}
          {clientNames.length > 0 && categoryFilter !== 'cio_africa' && (
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clientNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Status filter */}
          <div className="flex gap-1.5">
            {statuses.map(status => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="capitalize text-xs whitespace-nowrap"
              >
                {status === 'all' ? 'All Status' : status}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">
              {searchQuery ? 'No projects match your search' : 'No projects yet'}
            </p>
            {(isAdmin || isProjectManager) && !searchQuery && (
              <div className="mt-4">
                <Button className="gap-2" onClick={() => navigate('/projects/new')}>
                  <Plus className="h-4 w-4" />
                  New Project
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card 
              key={project.id} 
              className="transition-smooth hover:shadow-md group cursor-pointer overflow-hidden"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {project.logo_url ? (
                      <img 
                        src={project.logo_url} 
                        alt="" 
                        className="h-10 w-10 rounded-lg object-contain bg-muted p-1 flex-shrink-0 border" 
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FolderKanban className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                        {project.name}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {project.description || 'No description'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
                          Open
                        </DropdownMenuItem>
                        {canToggleStatus(project) && (
                          <DropdownMenuItem onClick={() => handleToggleProjectStatus(project)}>
                            <Power className="h-4 w-4 mr-2" />
                            {project.status === 'inactive' ? 'Set Active' : 'Set Inactive'}
                          </DropdownMenuItem>
                        )}
                        {(isAdmin || project.owner_id === user?.id) && (
                          <DropdownMenuItem onClick={() => {}}>
                            Duplicate
                          </DropdownMenuItem>
                        )}
                        {isAdmin && (
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => {
                              setProjectToDelete(project);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Status & Date */}
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className={`text-[10px] ${getStatusStyles(project.status)}`}>
                    {project.status}
                  </Badge>
                  {project.end_date && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(project.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{project.completedCount}/{project.taskCount} tasks</span>
                    <span className="font-medium text-foreground">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{projectToDelete?.name}" and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
