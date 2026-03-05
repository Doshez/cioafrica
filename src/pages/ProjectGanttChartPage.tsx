import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, GanttChartSquare, Layers } from 'lucide-react';
import { InteractiveGanttChart } from '@/components/InteractiveGanttChart';
import { ProjectLoadingScreen } from '@/components/ProjectLoadingScreen';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  description: string;
  logo_url?: string | null;
  status: string;
}

export default function ProjectGanttChartPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description, logo_url, status')
        .eq('id', projectId)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        navigate('/projects');
        return;
      }
      
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ProjectLoadingScreen projectId={projectId} />;
  }

  const statusConfig: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-success/10 text-success border-success/20' },
    completed: { label: 'Completed', className: 'bg-primary/10 text-primary border-primary/20' },
    inactive: { label: 'Inactive', className: 'bg-muted text-muted-foreground border-border' },
    on_hold: { label: 'On Hold', className: 'bg-warning/10 text-warning border-warning/20' },
  };

  const currentStatus = statusConfig[project?.status || 'active'] || statusConfig['active'];

  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      {/* Modern Header */}
      <div className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(`/projects/${projectId}`)}
                className="h-9 w-9 rounded-lg flex-shrink-0 hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              {project?.logo_url ? (
                <img src={project.logo_url} alt="" className="h-9 w-9 rounded-xl object-contain flex-shrink-0 ring-1 ring-border" />
              ) : (
                <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                  <Layers className="h-4 w-4 text-primary-foreground" />
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">{project?.name}</h1>
                  <Badge variant="outline" className={cn('text-[10px] font-medium flex-shrink-0 border', currentStatus.className)}>
                    {currentStatus.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GanttChartSquare className="h-3 w-3" />
                  <span>Gantt Chart View</span>
                </div>
              </div>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(`/projects/${projectId}`)}
              className="hidden sm:flex gap-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Project
            </Button>
          </div>
        </div>
      </div>

      {/* Gantt Chart - Full Width */}
      <div className="w-full flex-1 overflow-hidden">
        <InteractiveGanttChart projectId={projectId!} />
      </div>
    </div>
  );
}
