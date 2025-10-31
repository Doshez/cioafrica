import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, MoreVertical, Calendar, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { useUserRole } from '@/hooks/useUserRole';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string;
  end_date: string | null;
  logo_url?: string | null;
}

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isProjectManager } = useUserRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && (isAdmin !== undefined && isProjectManager !== undefined)) {
      fetchProjects();
    }
  }, [user, isAdmin, isProjectManager]);

  const fetchProjects = async () => {
    try {
      let projectsQuery = supabase
        .from('projects')
        .select('id, name, description, status, start_date, end_date, logo_url')
        .order('created_at', { ascending: false });

      // If user is not admin or project manager, filter by assigned projects
      if (!isAdmin && !isProjectManager) {
        // Get user's assigned projects
        const { data: assignedProjects } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', user?.id);

        if (assignedProjects && assignedProjects.length > 0) {
          const projectIds = assignedProjects.map(p => p.project_id);
          projectsQuery = projectsQuery.in('id', projectIds);
        } else {
          // User has no assigned projects, return empty
          setProjects([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await projectsQuery;

      if (error) throw error;
      setProjects(data || []);
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

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success/10 text-success border-success/20';
      case 'review':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'completed':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-muted text-muted-foreground';
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Projects</h1>
          <p className="text-muted-foreground">
            Manage and track all your projects
          </p>
        </div>
        {(isAdmin || isProjectManager) && (
          <CreateProjectDialog onProjectCreated={fetchProjects} />
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? 'No projects match your search' : 'No projects assigned to you yet'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredProjects.map((project) => (
            <Card 
              key={project.id} 
              className="transition-smooth hover:shadow-lg group cursor-pointer"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  {project.logo_url && (
                    <img src={project.logo_url} alt={`${project.name} logo`} className="h-10 w-10 object-contain rounded flex-shrink-0" />
                  )}
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-xl group-hover:text-primary transition-smooth truncate">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-smooth flex-shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getStatusColor(project.status)}>
                    {project.status}
                  </Badge>
                </div>
                
                {/* Dates */}
                <div className="flex items-center justify-between">
                  {project.end_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Due: {new Date(project.end_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/projects/${project.id}`);
                  }}>
                    View Details <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
