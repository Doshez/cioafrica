import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Code, 
  Palette, 
  Zap, 
  Layout, 
  Database,
  Check
} from 'lucide-react';

export default function GanttDocumentation() {
  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-background to-muted/20">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Interactive Gantt Chart
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A beautiful, modern, and fully-featured Gantt chart component built with React, TypeScript, and Tailwind CSS
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            <Badge variant="secondary">React 18</Badge>
            <Badge variant="secondary">TypeScript</Badge>
            <Badge variant="secondary">Tailwind CSS</Badge>
            <Badge variant="secondary">Framer Motion</Badge>
            <Badge variant="secondary">shadcn/ui</Badge>
            <Badge variant="secondary">Supabase</Badge>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-success" />
                Core Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>✅ Task bars grouped by department</li>
                <li>✅ Progress indicators with animations</li>
                <li>✅ Interactive tooltips on hover</li>
                <li>✅ Clickable tasks with detail modal</li>
                <li>✅ Today marker line</li>
                <li>✅ Color-coded departments</li>
                <li>✅ Real-time data from Supabase</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-warning" />
                Advanced Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>⚡ Zoom & pan controls</li>
                <li>⚡ Day/week/month views</li>
                <li>⚡ Department & status filters</li>
                <li>⚡ PDF export functionality</li>
                <li>⚡ Analytics view with metrics</li>
                <li>⚡ Task count visualization</li>
                <li>⚡ Smooth Framer Motion animations</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Documentation */}
        <Tabs defaultValue="usage" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="usage">
              <Code className="h-4 w-4 mr-2" />
              Usage
            </TabsTrigger>
            <TabsTrigger value="data">
              <Database className="h-4 w-4 mr-2" />
              Data Schema
            </TabsTrigger>
            <TabsTrigger value="styling">
              <Palette className="h-4 w-4 mr-2" />
              Styling
            </TabsTrigger>
            <TabsTrigger value="layout">
              <Layout className="h-4 w-4 mr-2" />
              Layout
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Import the component:</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`import { InteractiveGanttChart } from '@/components/InteractiveGanttChart';`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Use in your page:</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`export default function ProjectPage() {
  const projectId = "your-project-id";
  
  return (
    <div className="p-8">
      <InteractiveGanttChart projectId={projectId} />
    </div>
  );
}`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Props:</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <code className="text-sm">projectId: string</code>
                    <p className="text-sm text-muted-foreground mt-2">
                      The UUID of the project to display tasks for. The component will fetch all tasks and departments for this project.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Schema Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Task Interface:</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`interface Task {
  id: string;                        // UUID
  title: string;                     // Task name
  description?: string;              // Optional description
  status: string;                    // 'todo' | 'in_progress' | 'completed'
  priority: string;                  // 'low' | 'medium' | 'high'
  start_date: string;                // ISO date (REQUIRED)
  due_date: string;                  // ISO date (REQUIRED)
  assignee_department_id: string;    // Department UUID
  progress_percentage: number;       // 0-100
  assignee_user_id?: string;         // Optional user UUID
}`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Department Interface:</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`interface Department {
  id: string;              // UUID
  name: string;            // Department name
  description?: string;    // Optional description
  project_id: string;      // Parent project UUID
}`}
                  </pre>
                </div>

                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                  <p className="text-sm font-semibold text-warning mb-2">⚠️ Important Notes:</p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Tasks <strong>must</strong> have both start_date and due_date</li>
                    <li>• Tasks without dates will not appear on the Gantt chart</li>
                    <li>• Department colors are auto-assigned from a predefined palette</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="styling" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Visual Design</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Department Colors:</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Auto-assigned from a vibrant color palette:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'].map(color => (
                      <div key={color} className="flex items-center gap-2">
                        <div 
                          className="w-8 h-8 rounded-lg shadow-md"
                          style={{ backgroundColor: color }}
                        />
                        <code className="text-xs">{color}</code>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Task Bar Styling:</h4>
                  <ul className="text-sm space-y-2 text-muted-foreground">
                    <li>• <strong>Gradient backgrounds</strong> - Linear gradient from department color to lighter tone</li>
                    <li>• <strong>Progress overlay</strong> - White semi-transparent overlay showing completion %</li>
                    <li>• <strong>Rounded corners</strong> - 8px border radius for modern look</li>
                    <li>• <strong>Drop shadows</strong> - Subtle elevation with hover enhancement</li>
                    <li>• <strong>Smooth animations</strong> - Framer Motion scale and fade transitions</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Responsive Breakpoints:</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// Department label column
w-48 lg:w-64        // 192px → 256px on large screens

// Timeline grid
min-w-[600px]       // Horizontal scroll on small screens
overflow-x-auto     // Enable scrolling when needed`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="layout" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Layout Structure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Chart Sections:</h4>
                  <ol className="space-y-3 text-sm">
                    <li>
                      <strong>1. Header Controls</strong>
                      <p className="text-muted-foreground ml-4">
                        View mode toggle (Day/Week/Month), scroll buttons, export button
                      </p>
                    </li>
                    <li>
                      <strong>2. Filters Row</strong>
                      <p className="text-muted-foreground ml-4">
                        Department filter, status filter, clear filters button
                      </p>
                    </li>
                    <li>
                      <strong>3. Department Legend</strong>
                      <p className="text-muted-foreground ml-4">
                        Color-coded legend with completion percentages (in analytics mode)
                      </p>
                    </li>
                    <li>
                      <strong>4. Timeline Header</strong>
                      <p className="text-muted-foreground ml-4">
                        Date labels with highlighted current day
                      </p>
                    </li>
                    <li>
                      <strong>5. Department Rows</strong>
                      <p className="text-muted-foreground ml-4">
                        Each department with its tasks as horizontal bars
                      </p>
                    </li>
                    <li>
                      <strong>6. Task Count Bar</strong>
                      <p className="text-muted-foreground ml-4">
                        Vertical bars showing task density per day
                      </p>
                    </li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Interactions:</h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">Hover</Badge>
                      <p className="text-muted-foreground">Task bar scales up, shows tooltip with dates</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">Click</Badge>
                      <p className="text-muted-foreground">Opens modal with full task details</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">Scroll</Badge>
                      <p className="text-muted-foreground">Pan timeline using chevron buttons</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">Toggle</Badge>
                      <p className="text-muted-foreground">Switch between Gantt and Analytics views</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Integration Example */}
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <CardHeader>
            <CardTitle>Integration in ProjectDetails Page</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              The Gantt chart is already integrated in the ProjectDetails page. Here's the implementation:
            </p>
            <pre className="bg-background p-4 rounded-lg overflow-x-auto text-sm border">
{`// src/pages/ProjectDetails.tsx
import { InteractiveGanttChart } from '@/components/InteractiveGanttChart';

export default function ProjectDetails() {
  const { projectId } = useParams();
  
  return (
    <div className="p-8 space-y-6">
      {/* Project overview cards */}
      <Card>...</Card>
      
      {/* Departments section */}
      <div className="space-y-4">...</div>
      
      {/* Interactive Gantt Chart */}
      <InteractiveGanttChart projectId={projectId!} />
    </div>
  );
}`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
