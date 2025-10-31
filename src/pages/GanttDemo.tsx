import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InteractiveGanttChart } from '@/components/InteractiveGanttChart';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

/**
 * Demo page showcasing the Interactive Gantt Chart component
 * 
 * Features demonstrated:
 * 1. ✅ Horizontal bars per task, grouped by department
 * 2. ✅ Task bars show title, progress (filled portion), tooltips, color-coded, clickable
 * 3. ✅ Department labels on left, timeline dates across top
 * 4. ✅ Vertical "Today" line marker
 * 5. ✅ Framer Motion animations on data updates
 * 6. ✅ Zoom & pan support (day/week/month toggle)
 * 7. ✅ shadcn/ui components (Card, Tooltip, Modal, Select, Progress)
 * 8. ✅ Tailwind styling with gradients, shadows, rounded edges
 * 9. ✅ Department color legend with completion percentages
 * 10. ✅ Responsive layout (desktop/tablet/mobile)
 * 11. ✅ Filter by department or status
 * 12. ✅ Export chart to PDF
 * 13. ✅ Task detail modal on click
 * 14. ✅ Mini task count bar chart under timeline
 * 15. ✅ Analytics view toggle
 * 
 * Sample Data Structure:
 * - Uses real Supabase data from the connected project
 * - Departments: Marketing, Production, etc.
 * - Tasks: Design Event Banner, Venue Setup, etc.
 */

export default function GanttDemo() {
  const navigate = useNavigate();
  
  // For demo purposes, using a sample project ID
  // Replace with actual project ID from your database
  const DEMO_PROJECT_ID = '7f224ce1-1f9f-470d-a650-caf08da48b7e';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background p-8">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate('/')}
            className="hover-scale"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Interactive Gantt Chart Demo
            </h1>
            <p className="text-muted-foreground mt-1">
              Modern, responsive project timeline visualization
            </p>
          </div>
        </div>

        {/* Feature Highlights */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="text-lg">🎯 Key Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <FeatureItem 
                icon="📊" 
                title="Interactive Timeline"
                description="Horizontal task bars with progress indicators"
              />
              <FeatureItem 
                icon="🎨" 
                title="Department Colors"
                description="Color-coded tasks by department with gradients"
              />
              <FeatureItem 
                icon="📅" 
                title="Today Marker"
                description="Vertical line showing current date"
              />
              <FeatureItem 
                icon="🔍" 
                title="Zoom & Pan"
                description="Day/week/month views with scroll navigation"
              />
              <FeatureItem 
                icon="✨" 
                title="Smooth Animations"
                description="Framer Motion transitions on all interactions"
              />
              <FeatureItem 
                icon="📱" 
                title="Fully Responsive"
                description="Optimized for desktop, tablet, and mobile"
              />
              <FeatureItem 
                icon="🔽" 
                title="Export to PDF"
                description="Download your Gantt chart as PDF"
              />
              <FeatureItem 
                icon="🎯" 
                title="Smart Filters"
                description="Filter by department or task status"
              />
              <FeatureItem 
                icon="📈" 
                title="Analytics View"
                description="Switch to analytics with completion metrics"
              />
            </div>
          </CardContent>
        </Card>

        {/* The Gantt Chart Component */}
        <InteractiveGanttChart projectId={DEMO_PROJECT_ID} />

        {/* Usage Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>💻 Implementation Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Component Usage</h3>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`import { InteractiveGanttChart } from '@/components/InteractiveGanttChart';

// In your component
<InteractiveGanttChart projectId="your-project-id" />`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. Data Requirements</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>Tasks must have both <code className="bg-muted px-1 rounded">start_date</code> and <code className="bg-muted px-1 rounded">due_date</code></li>
                <li>Tasks should be assigned to departments via <code className="bg-muted px-1 rounded">assignee_department_id</code></li>
                <li>Progress tracked with <code className="bg-muted px-1 rounded">progress_percentage</code> (0-100)</li>
                <li>Status field supports: <code className="bg-muted px-1 rounded">todo</code>, <code className="bg-muted px-1 rounded">in_progress</code>, <code className="bg-muted px-1 rounded">completed</code></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">3. Interactions</h3>
              <div className="grid gap-2 text-sm text-muted-foreground">
                <p>• <strong>Click task bar</strong> - Opens detailed modal</p>
                <p>• <strong>Hover task bar</strong> - Shows quick info tooltip</p>
                <p>• <strong>Use chevron buttons</strong> - Pan timeline left/right</p>
                <p>• <strong>Toggle view mode</strong> - Switch between day/week/month</p>
                <p>• <strong>Apply filters</strong> - Filter by department or status</p>
                <p>• <strong>Switch modes</strong> - Toggle between Gantt and Analytics views</p>
                <p>• <strong>Export button</strong> - Download as PDF</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { 
  icon: string; 
  title: string; 
  description: string;
}) {
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-card hover:bg-muted/50 transition-colors">
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div>
        <h4 className="font-semibold text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
