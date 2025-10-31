import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { InteractiveGanttChart } from '@/components/InteractiveGanttChart';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Project {
  id: string;
  name: string;
  description: string;
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
        .select('id, name, description')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen w-full">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-full">
          <div className="flex items-center gap-3 min-w-0">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate(`/projects/${projectId}`)}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">Gantt Chart</h1>
              {project && (
                <p className="text-sm text-muted-foreground truncate">{project.name}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Gantt Chart - Full Width */}
      <div className="w-full">
        <InteractiveGanttChart projectId={projectId!} />
      </div>
    </div>
  );
}
