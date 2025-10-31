import { InteractiveGanttChart } from '@/components/InteractiveGanttChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function GanttDemo() {
  // Demo project ID - replace with actual project ID
  const demoProjectId = "your-project-id-here";

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gantt Chart Demo</h1>
        <p className="text-muted-foreground mt-2">
          Interactive Gantt chart visualization with department grouping, filters, and export
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="font-semibold">✨ Interactive Elements</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Click tasks to view details</li>
              <li>• Hover for quick info tooltips</li>
              <li>• Animated progress bars</li>
              <li>• Today marker indicator</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">🎨 Visual Features</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Department color coding</li>
              <li>• Gradient task bars</li>
              <li>• Smooth animations</li>
              <li>• Responsive design</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">🔍 Filters & Controls</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Filter by department</li>
              <li>• Filter by status</li>
              <li>• Day/Week/Month views</li>
              <li>• Timeline navigation</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">📊 Export & Share</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Export to PDF</li>
              <li>• High-quality output</li>
              <li>• Print-ready format</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* The Interactive Gantt Chart Component */}
      <InteractiveGanttChart projectId={demoProjectId} />
    </div>
  );
}
