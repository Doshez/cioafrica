import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportSettingsPanel } from '@/components/reports/ReportSettingsPanel';
import Layout from '@/components/Layout';

export default function ProjectReportSettings() {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) {
    return (
      <Layout>
        <div className="p-8 text-center text-muted-foreground">
          Project not found
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/projects/${projectId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Report Settings</h1>
            <p className="text-muted-foreground">
              Configure automated daily project summary reports
            </p>
          </div>
        </div>

        <ReportSettingsPanel projectId={projectId} />
      </div>
    </Layout>
  );
}
