import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, ArrowRight, Check, Upload, X, Loader2, 
  Plus, Trash2, FileText, Folder, ListTodo, Users, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WizardDepartment {
  tempId: string;
  name: string;
  description: string;
}

interface WizardElement {
  tempId: string;
  title: string;
  description: string;
  departmentTempId: string;
  priority: string;
}

interface WizardTask {
  tempId: string;
  title: string;
  description: string;
  elementTempId: string;
  departmentTempId: string;
  priority: string;
  status: string;
}

const STEPS = [
  { id: 'details', label: 'Details', icon: FileText },
  { id: 'departments', label: 'Departments', icon: Folder },
  { id: 'elements', label: 'Briefs & Elements', icon: ListTodo },
  { id: 'review', label: 'Review & Create', icon: Check },
];

const SUGGESTED_DEPARTMENTS = [
  'Production', 'Marketing', 'Media', 'Design', 'Finance', 'Logistics', 'Technical', 'Operations'
];

export default function ProjectWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [creating, setCreating] = useState(false);

  // Step 1 - Project details
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    status: 'active',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    project_category: 'cio_africa' as 'cio_africa' | 'client',
    client_name: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Step 2 - Departments
  const [departments, setDepartments] = useState<WizardDepartment[]>([]);
  const [newDeptName, setNewDeptName] = useState('');

  // Step 3 - Elements (briefs)
  const [elements, setElements] = useState<WizardElement[]>([]);

  // Step 4 - Tasks
  const [tasks, setTasks] = useState<WizardTask[]>([]);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: 'Error', description: 'Logo must be less than 2MB', variant: 'destructive' });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addDepartment = (name: string) => {
    if (!name.trim() || departments.some(d => d.name.toLowerCase() === name.toLowerCase())) return;
    setDepartments(prev => [...prev, { tempId: crypto.randomUUID(), name: name.trim(), description: '' }]);
    setNewDeptName('');
  };

  const removeDepartment = (tempId: string) => {
    setDepartments(prev => prev.filter(d => d.tempId !== tempId));
    setElements(prev => prev.filter(e => e.departmentTempId !== tempId));
    setTasks(prev => prev.filter(t => t.departmentTempId !== tempId));
  };

  const addElement = () => {
    if (departments.length === 0) return;
    setElements(prev => [...prev, {
      tempId: crypto.randomUUID(),
      title: '',
      description: '',
      departmentTempId: departments[0].tempId,
      priority: 'medium',
    }]);
  };

  const updateElement = (tempId: string, updates: Partial<WizardElement>) => {
    setElements(prev => prev.map(e => e.tempId === tempId ? { ...e, ...updates } : e));
  };

  const removeElement = (tempId: string) => {
    setElements(prev => prev.filter(e => e.tempId !== tempId));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return projectData.name.trim() && projectData.start_date && (projectData.project_category === 'cio_africa' || projectData.client_name.trim());
      case 1: return true; // departments optional
      case 2: return true; // elements optional
      case 3: return true;
      default: return false;
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    try {
      // 1. Upload logo
      let logoUrl = null;
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('project-logos').upload(fileName, logoFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('project-logos').getPublicUrl(fileName);
        logoUrl = publicUrl;
      }

      // 2. Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectData.name,
          description: projectData.description,
          status: projectData.status,
          start_date: projectData.start_date,
          end_date: projectData.end_date || null,
          owner_id: user.id,
          logo_url: logoUrl,
          project_category: projectData.project_category,
          client_name: projectData.project_category === 'client' ? projectData.client_name : null,
        } as any)
        .select('id')
        .single();
      if (projectError) throw projectError;

      const projectId = project.id;

      // 3. Add creator as project member
      await supabase.from('project_members').insert({
        project_id: projectId,
        user_id: user.id,
        role: 'owner',
      });

      // 4. Create departments and map tempId -> realId
      const deptIdMap: Record<string, string> = {};
      for (const dept of departments) {
        const { data: deptData, error: deptError } = await supabase
          .from('departments')
          .insert({ name: dept.name, description: dept.description, project_id: projectId })
          .select('id')
          .single();
        if (deptError) throw deptError;
        deptIdMap[dept.tempId] = deptData.id;
      }

      // 5. Create elements
      const elementIdMap: Record<string, string> = {};
      for (const el of elements) {
        if (!el.title.trim()) continue;
        const { data: elData, error: elError } = await supabase
          .from('elements')
          .insert({
            title: el.title,
            description: el.description,
            project_id: projectId,
            department_id: deptIdMap[el.departmentTempId] || null,
            priority: el.priority,
          })
          .select('id')
          .single();
        if (elError) throw elError;
        elementIdMap[el.tempId] = elData.id;
      }

      toast({ title: 'Project created!', description: 'Your project workspace is ready.' });
      navigate(`/projects/${projectId}?onboarding=true`);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="text-sm font-medium text-muted-foreground">
            Step {currentStep + 1} of {STEPS.length}
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-6">
          <Progress value={progress} className="h-1" />
        </div>
      </div>

      {/* Step indicators */}
      <div className="max-w-3xl mx-auto px-6 pt-8 pb-6">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => idx <= currentStep && setCurrentStep(idx)}
                disabled={idx > currentStep}
                className={cn(
                  'flex items-center gap-2 text-xs font-medium transition-colors',
                  idx === currentStep ? 'text-primary' : idx < currentStep ? 'text-success' : 'text-muted-foreground'
                )}
              >
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center border-2 transition-all text-xs',
                  idx === currentStep ? 'border-primary bg-primary text-primary-foreground' :
                  idx < currentStep ? 'border-success bg-success text-white' : 'border-border'
                )}>
                  {idx < currentStep ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className={cn('flex-1 h-px', idx < currentStep ? 'bg-success' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Details */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Project Details</h2>
              <p className="text-sm text-muted-foreground mt-1">Set up the basics for your new project.</p>
            </div>
            <div className="space-y-4">
              {/* Project Category */}
              <div className="space-y-2">
                <Label>Project Category *</Label>
                <Select value={projectData.project_category} onValueChange={(v: 'cio_africa' | 'client') => setProjectData({ ...projectData, project_category: v, client_name: v === 'cio_africa' ? '' : projectData.client_name })}>
                  <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cio_africa">CIO Africa Project</SelectItem>
                    <SelectItem value="client">Client Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {projectData.project_category === 'client' && (
                <div className="space-y-2">
                  <Label>Client Name *</Label>
                  <Input
                    value={projectData.client_name}
                    onChange={e => setProjectData({ ...projectData, client_name: e.target.value })}
                    placeholder="e.g., Safaricom, KCB Group"
                    className="bg-card"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Project Name *</Label>
                <Input
                  value={projectData.name}
                  onChange={e => setProjectData({ ...projectData, name: e.target.value })}
                  placeholder="e.g., Annual Conference 2026"
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={projectData.description}
                  onChange={e => setProjectData({ ...projectData, description: e.target.value })}
                  placeholder="Brief project overview..."
                  rows={3}
                  className="bg-card"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={projectData.start_date}
                    onChange={e => setProjectData({ ...projectData, start_date: e.target.value })}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={projectData.end_date}
                    onChange={e => setProjectData({ ...projectData, end_date: e.target.value })}
                    className="bg-card"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={projectData.status} onValueChange={v => setProjectData({ ...projectData, status: v })}>
                    <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Logo (Optional)</Label>
                  {logoPreview ? (
                    <div className="relative inline-block">
                      <img src={logoPreview} alt="" className="h-12 w-12 rounded-lg object-contain border" />
                      <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                        onClick={() => { setLogoFile(null); setLogoPreview(null); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Input id="wizard-logo" type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                      <Label htmlFor="wizard-logo" className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted text-sm">
                        <Upload className="h-4 w-4" /> Upload
                      </Label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Departments */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Departments</h2>
              <p className="text-sm text-muted-foreground mt-1">Organize your project into departments. You can add more later.</p>
            </div>
            {/* Quick add suggestions */}
            <div>
              <Label className="text-xs text-muted-foreground">Quick add</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {SUGGESTED_DEPARTMENTS.filter(s => !departments.some(d => d.name === s)).map(name => (
                  <Button key={name} variant="outline" size="sm" className="text-xs gap-1" onClick={() => addDepartment(name)}>
                    <Plus className="h-3 w-3" /> {name}
                  </Button>
                ))}
              </div>
            </div>
            {/* Custom add */}
            <div className="flex gap-2">
              <Input
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
                placeholder="Custom department name..."
                className="bg-card"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDepartment(newDeptName))}
              />
              <Button onClick={() => addDepartment(newDeptName)} disabled={!newDeptName.trim()} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {/* Department list */}
            <div className="space-y-2">
              {departments.map((dept, idx) => (
                <Card key={dept.tempId}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{dept.name}</p>
                        <Input
                          value={dept.description}
                          onChange={e => setDepartments(prev => prev.map(d => d.tempId === dept.tempId ? { ...d, description: e.target.value } : d))}
                          placeholder="Add description..."
                          className="text-xs h-7 border-0 bg-transparent px-0 text-muted-foreground focus-visible:ring-0"
                        />
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeDepartment(dept.tempId)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {departments.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No departments added yet. Use the suggestions above or type a custom name.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Elements / Briefs */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Briefs & Elements</h2>
              <p className="text-sm text-muted-foreground mt-1">Break your project into briefs or elements under each department.</p>
            </div>
            {departments.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  <Folder className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Add departments first to create elements.
                </CardContent>
              </Card>
            ) : (
              <>
                <Button onClick={addElement} variant="outline" size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Element
                </Button>
                <div className="space-y-3">
                  {elements.map(el => (
                    <Card key={el.tempId}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex gap-3">
                          <Input
                            value={el.title}
                            onChange={e => updateElement(el.tempId, { title: e.target.value })}
                            placeholder="Element title (e.g., Stage Setup)"
                            className="bg-background flex-1"
                          />
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeElement(el.tempId)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Select value={el.departmentTempId} onValueChange={v => updateElement(el.tempId, { departmentTempId: v })}>
                            <SelectTrigger className="text-xs h-8 bg-background"><SelectValue placeholder="Department" /></SelectTrigger>
                            <SelectContent>
                              {departments.map(d => (
                                <SelectItem key={d.tempId} value={d.tempId}>{d.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={el.priority} onValueChange={v => updateElement(el.tempId, { priority: v })}>
                            <SelectTrigger className="text-xs h-8 bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          value={el.description}
                          onChange={e => updateElement(el.tempId, { description: e.target.value })}
                          placeholder="Description..."
                          rows={2}
                          className="text-xs bg-background"
                        />
                      </CardContent>
                    </Card>
                  ))}
                  {elements.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No elements yet. You can add them now or later in the project workspace.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">Review & Create</h2>
              <p className="text-sm text-muted-foreground mt-1">Everything looks good? Let's create your project.</p>
            </div>
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  {logoPreview && <img src={logoPreview} alt="" className="h-10 w-10 rounded-lg object-contain border" />}
                  <div>
                    <h3 className="font-bold">{projectData.name}</h3>
                    <p className="text-xs text-muted-foreground">{projectData.description || 'No description'}</p>
                  </div>
                  <div className="ml-auto flex gap-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {projectData.project_category === 'cio_africa' ? 'CIO Africa' : 'Client'}
                    </Badge>
                    {projectData.client_name && (
                      <Badge variant="outline" className="text-xs">{projectData.client_name}</Badge>
                    )}
                    <Badge variant="outline" className="capitalize text-xs">{projectData.status}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Departments</p>
                    <p className="text-lg font-bold">{departments.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Elements</p>
                    <p className="text-lg font-bold">{elements.filter(e => e.title.trim()).length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Dates</p>
                    <p className="text-xs font-medium">{projectData.start_date}{projectData.end_date ? ` → ${projectData.end_date}` : ''}</p>
                  </div>
                </div>
                {departments.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Departments</p>
                    <div className="flex flex-wrap gap-1.5">
                      {departments.map(d => (
                        <Badge key={d.tempId} variant="secondary" className="text-xs">{d.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {elements.filter(e => e.title.trim()).length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Elements</p>
                    <div className="flex flex-wrap gap-1.5">
                      {elements.filter(e => e.title.trim()).map(e => (
                        <Badge key={e.tempId} variant="outline" className="text-xs">{e.title}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Users className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                After creating, you'll be prompted to <span className="font-medium text-foreground">add team members</span> to your project.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-8 border-t mt-8">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={currentStep === 0}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
              className="gap-1.5"
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={creating || !canProceed()} className="gap-1.5">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {creating ? 'Creating...' : 'Create Project'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
