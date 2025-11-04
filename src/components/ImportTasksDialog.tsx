import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { Progress } from '@/components/ui/progress';

const taskRowSchema = z.object({
  'Task Title': z.string().min(1, 'Task title is required'),
  'Element': z.string().optional(),
  'Status': z.enum(['todo', 'in_progress', 'done', 'on_hold']).optional(),
  'Priority': z.enum(['low', 'medium', 'high']).optional(),
  'Start Date': z.union([z.string(), z.number()]).optional(),
  'Due Date': z.union([z.string(), z.number()]).optional(),
  'Description': z.string().optional(),
  'Estimated Cost': z.union([z.number(), z.string()]).optional(),
  'Actual Cost': z.union([z.number(), z.string()]).optional(),
});

interface ImportTasksDialogProps {
  projectId: string;
  departmentId: string;
  onTasksImported: () => void;
}

export function ImportTasksDialog({
  projectId,
  departmentId,
  onTasksImported,
}: ImportTasksDialogProps) {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const downloadTemplate = async () => {
    try {
      // Fetch department and elements data
      const { data: department } = await supabase
        .from('departments')
        .select('name')
        .eq('id', departmentId)
        .single();

      const { data: elements } = await supabase
        .from('elements')
        .select('title, description')
        .eq('department_id', departmentId)
        .order('title');

      const departmentName = department?.name || 'Department';
      const elementNames = elements?.map(el => el.title) || [];

      // Create main template with example rows
      const template = [
        {
          'Task Title': 'Example Task 1',
          'Element': elementNames[0] || 'Element Name',
          'Status': 'todo',
          'Priority': 'medium',
          'Start Date': '01-01-2025',
          'Due Date': '01-31-2025',
          'Description': 'Task description',
          'Estimated Cost': 1000,
          'Actual Cost': 0,
        },
        {
          'Task Title': 'Example Task 2',
          'Element': elementNames[1] || elementNames[0] || 'Element Name',
          'Status': 'in_progress',
          'Priority': 'high',
          'Start Date': '02-01-2025',
          'Due Date': '02-28-2025',
          'Description': 'Another task description',
          'Estimated Cost': 2000,
          'Actual Cost': 500,
        },
      ];

      const wb = XLSX.utils.book_new();
      
      // Main tasks sheet
      const ws = XLSX.utils.json_to_sheet(template);
      ws['!cols'] = [
        { wch: 30 }, // Task Title
        { wch: 20 }, // Element
        { wch: 15 }, // Status
        { wch: 10 }, // Priority
        { wch: 12 }, // Start Date
        { wch: 12 }, // Due Date
        { wch: 40 }, // Description
        { wch: 15 }, // Estimated Cost
        { wch: 15 }, // Actual Cost
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Tasks Template');

      // Reference sheet with department info and available elements
      const referenceData = [
        { 'Information': 'Department', 'Value': departmentName },
        { 'Information': '', 'Value': '' },
        { 'Information': 'Available Elements:', 'Value': '' },
        ...elementNames.map(name => ({ 'Information': '  • ' + name, 'Value': '' })),
        { 'Information': '', 'Value': '' },
        { 'Information': 'Valid Status Values:', 'Value': 'todo, in_progress, done, on_hold' },
        { 'Information': 'Valid Priority Values:', 'Value': 'low, medium, high' },
        { 'Information': 'Date Format:', 'Value': 'MM-DD-YYYY (e.g., 01-31-2025)' },
      ];

      const wsRef = XLSX.utils.json_to_sheet(referenceData);
      wsRef['!cols'] = [
        { wch: 30 }, // Information
        { wch: 50 }, // Value
      ];
      XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');

      XLSX.writeFile(wb, `task-import-template-${departmentName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.xlsx`);
      
      toast({
        title: 'Template Downloaded',
        description: `Template for "${departmentName}" with ${elementNames.length} available elements`,
      });
    } catch (error) {
      console.error('Error downloading template:', error);
      toast({
        title: 'Error',
        description: 'Failed to download template',
        variant: 'destructive',
      });
    }
  };

  const parseExcelDate = (serial: any): string | null => {
    if (!serial) return null;
    
    // If it's already a string in YYYY-MM-DD format (for database storage)
    if (typeof serial === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(serial)) {
      return serial;
    }
    
    // If it's in MM-DD-YYYY format (our template format)
    if (typeof serial === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(serial)) {
      const [month, day, year] = serial.split('-');
      return `${year}-${month}-${day}`;
    }
    
    // Helper function to format date as YYYY-MM-DD in local timezone
    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // If it's an Excel serial number
    if (typeof serial === 'number') {
      const date = new Date((serial - 25569) * 86400 * 1000);
      return formatLocalDate(date);
    }
    
    // Try to parse as date string
    try {
      const date = new Date(serial);
      if (!isNaN(date.getTime())) {
        return formatLocalDate(date);
      }
    } catch (e) {
      // Ignore parsing errors
    }
    
    return null;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast({
        title: 'Invalid File',
        description: 'Please upload an Excel file (.xlsx or .xls)',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      // Read the file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error('The Excel file is empty');
      }

      setProgress(10);

      // Get or create elements
      const elementMap = new Map<string, string>();
      const uniqueElements = [...new Set(
        jsonData
          .map((row: any) => row['Element'])
          .filter((element: string) => element && element.trim())
      )];

      setProgress(20);

      // Fetch existing elements
      const { data: existingElements } = await supabase
        .from('elements')
        .select('id, title')
        .eq('department_id', departmentId);

      existingElements?.forEach(el => {
        elementMap.set(el.title, el.id);
      });

      // Create missing elements
      for (const elementTitle of uniqueElements) {
        if (!elementMap.has(elementTitle)) {
          const { data: newElement, error } = await supabase
            .from('elements')
            .insert({
              project_id: projectId,
              department_id: departmentId,
              title: elementTitle,
            })
            .select('id')
            .single();

          if (error) throw error;
          if (newElement) {
            elementMap.set(elementTitle, newElement.id);
          }
        }
      }

      setProgress(40);

      // Validate and prepare tasks
      const tasksToCreate = [];
      const errors: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        
        try {
          // Validate row
          const validated = taskRowSchema.parse({
            'Task Title': row['Task Title'],
            'Element': row['Element'],
            'Status': row['Status']?.toLowerCase(),
            'Priority': row['Priority']?.toLowerCase(),
            'Start Date': row['Start Date'],
            'Due Date': row['Due Date'],
            'Description': row['Description'],
            'Estimated Cost': row['Estimated Cost'],
            'Actual Cost': row['Actual Cost'],
          });

          // Parse costs to numbers
          const estimatedCost = validated['Estimated Cost'] 
            ? typeof validated['Estimated Cost'] === 'number' 
              ? validated['Estimated Cost']
              : parseFloat(String(validated['Estimated Cost']))
            : 0;
          
          const actualCost = validated['Actual Cost']
            ? typeof validated['Actual Cost'] === 'number'
              ? validated['Actual Cost']
              : parseFloat(String(validated['Actual Cost']))
            : 0;

          const task = {
            project_id: projectId,
            assignee_department_id: departmentId,
            title: validated['Task Title'],
            description: validated['Description'] || null,
            status: validated['Status'] || 'todo',
            priority: validated['Priority'] || 'medium',
            start_date: parseExcelDate(row['Start Date']),
            due_date: parseExcelDate(row['Due Date']),
            estimated_cost: isNaN(estimatedCost) ? 0 : estimatedCost,
            actual_cost: isNaN(actualCost) ? 0 : actualCost,
            element_id: validated['Element'] ? elementMap.get(validated['Element']) : null,
            progress_percentage: validated['Status'] === 'done' ? 100 : validated['Status'] === 'in_progress' ? 50 : 0,
          };

          tasksToCreate.push(task);
        } catch (error: any) {
          errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }

      if (errors.length > 0) {
        throw new Error(`Validation errors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : ''}`);
      }

      setProgress(60);

      // Insert tasks in batches
      const batchSize = 50;
      for (let i = 0; i < tasksToCreate.length; i += batchSize) {
        const batch = tasksToCreate.slice(i, i + batchSize);
        const { error } = await supabase
          .from('tasks')
          .insert(batch);

        if (error) throw error;
        
        setProgress(60 + ((i + batchSize) / tasksToCreate.length) * 40);
      }

      setProgress(100);

      toast({
        title: 'Success',
        description: `Successfully imported ${tasksToCreate.length} tasks`,
      });

      setOpen(false);
      onTasksImported();
    } catch (error: any) {
      console.error('Error importing tasks:', error);
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import tasks from Excel',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Import Tasks</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Tasks from Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Required Columns
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Task Title (required)</li>
              <li>• Element (optional)</li>
              <li>• Status: todo, in_progress, done, on_hold</li>
              <li>• Priority: low, medium, high</li>
              <li>• Start Date (MM-DD-YYYY)</li>
              <li>• Due Date (MM-DD-YYYY)</li>
              <li>• Description</li>
              <li>• Estimated Cost (number)</li>
              <li>• Actual Cost (number)</li>
            </ul>
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Processing... {Math.round(progress)}%
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="flex-1"
              disabled={isProcessing}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>

            <Button
              className="flex-1"
              onClick={() => document.getElementById('excel-upload')?.click()}
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Excel
            </Button>
          </div>

          <input
            id="excel-upload"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isProcessing}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
