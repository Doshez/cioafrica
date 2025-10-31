import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MoreVertical, Users, Calendar } from 'lucide-react';

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState('');

  const projects = [
    {
      id: '1',
      name: 'Connected Africa Summit 2025',
      description: 'Annual technology conference planning and execution',
      status: 'active',
      progress: 65,
      department: 'Events',
      owner: 'Sarah Johnson',
      startDate: '2025-01-15',
      endDate: '2025-06-30',
      tasksCount: 48,
      teamSize: 12,
    },
    {
      id: '2',
      name: 'Marketing Campaign Q1',
      description: 'Social media and digital marketing initiatives',
      status: 'active',
      progress: 40,
      department: 'Marketing',
      owner: 'Michael Chen',
      startDate: '2025-01-01',
      endDate: '2025-03-31',
      tasksCount: 24,
      teamSize: 6,
    },
    {
      id: '3',
      name: 'Website Redesign',
      description: 'Complete overhaul of corporate website',
      status: 'review',
      progress: 85,
      department: 'IT',
      owner: 'Emily Davis',
      startDate: '2024-11-01',
      endDate: '2025-02-28',
      tasksCount: 32,
      teamSize: 8,
    },
  ];

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
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
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
        {projects.map((project) => (
          <Card key={project.id} className="transition-smooth hover:shadow-lg group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-xl group-hover:text-primary transition-smooth">
                    {project.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {project.description}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-smooth">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{project.progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="gradient-primary h-2 rounded-full transition-smooth"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{project.teamSize} members</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{project.tasksCount} tasks</span>
                </div>
              </div>

              {/* Status & Department */}
              <div className="flex items-center gap-2 pt-2">
                <Badge variant="outline" className={getStatusColor(project.status)}>
                  {project.status}
                </Badge>
                <Badge variant="outline">
                  {project.department}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
