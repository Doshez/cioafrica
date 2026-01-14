import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DocumentBrowser } from '@/components/documents/DocumentBrowser';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

export default function ProjectDocuments() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId) return;

      try {
        // Fetch project
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('id, name')
          .eq('id', projectId)
          .single();

        if (projectError) throw projectError;
        setProject(projectData);

        // Fetch departments
        const { data: deptData, error: deptError } = await supabase
          .from('departments')
          .select('id, name')
          .eq('project_id', projectId)
          .order('name');

        if (deptError) throw deptError;
        setDepartments(deptData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-[600px] bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!project || !projectId) {
    return (
      <div className="container mx-auto py-6">
        <p>Project not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/projects/${projectId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">Document & Link Management</p>
        </div>
      </div>

      {/* Document Browser */}
      <DocumentBrowser projectId={projectId} departments={departments} />
    </div>
  );
}
