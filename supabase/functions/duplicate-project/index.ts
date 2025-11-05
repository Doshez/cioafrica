import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create service role client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify JWT token and get user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth verification failed:', userError?.message);
      throw new Error('Unauthorized');
    }

    console.log(`Authenticated user: ${user.id}`);

    const { projectId, newProjectName } = await req.json();

    if (!projectId || !newProjectName) {
      throw new Error('Missing required parameters');
    }

    console.log(`Duplicating project ${projectId} with new name: ${newProjectName}`);

    // Get the original project
    const { data: originalProject, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    // Create the new project
    const { data: newProject, error: newProjectError } = await supabaseAdmin
      .from('projects')
      .insert({
        name: newProjectName,
        description: originalProject.description,
        status: originalProject.status,
        start_date: originalProject.start_date,
        end_date: originalProject.end_date,
        owner_id: user.id,
        theme_colors: originalProject.theme_colors,
      })
      .select()
      .single();

    if (newProjectError) throw newProjectError;

    console.log(`Created new project: ${newProject.id}`);

    // Get all departments from the original project
    const { data: departments, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('*')
      .eq('project_id', projectId);

    if (deptError) throw deptError;

    // Map to store old department ID -> new department ID
    const deptIdMap = new Map();

    // Duplicate departments
    if (departments && departments.length > 0) {
      for (const dept of departments) {
        const { data: newDept, error: newDeptError } = await supabaseAdmin
          .from('departments')
          .insert({
            name: dept.name,
            description: dept.description,
            project_id: newProject.id,
          })
          .select()
          .single();

        if (newDeptError) throw newDeptError;
        deptIdMap.set(dept.id, newDept.id);
        console.log(`Duplicated department: ${dept.name}`);
      }
    }

    // Get all elements from the original project
    const { data: elements, error: elemError } = await supabaseAdmin
      .from('elements')
      .select('*')
      .eq('project_id', projectId);

    if (elemError) throw elemError;

    // Map to store old element ID -> new element ID
    const elementIdMap = new Map();

    // Duplicate elements
    if (elements && elements.length > 0) {
      for (const element of elements) {
        const { data: newElement, error: newElementError } = await supabaseAdmin
          .from('elements')
          .insert({
            title: element.title,
            description: element.description,
            project_id: newProject.id,
            department_id: element.department_id ? deptIdMap.get(element.department_id) : null,
            priority: element.priority,
            start_date: element.start_date,
            due_date: element.due_date,
          })
          .select()
          .single();

        if (newElementError) throw newElementError;
        elementIdMap.set(element.id, newElement.id);
        console.log(`Duplicated element: ${element.title}`);
      }
    }

    // Get all tasks from the original project
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('project_id', projectId);

    if (tasksError) throw tasksError;

    // Duplicate tasks (reset status to 'todo', no assignees)
    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        const { error: newTaskError } = await supabaseAdmin
          .from('tasks')
          .insert({
            title: task.title,
            description: task.description,
            project_id: newProject.id,
            element_id: task.element_id ? elementIdMap.get(task.element_id) : null,
            status: 'todo', // Reset to todo
            priority: task.priority,
            start_date: task.start_date,
            due_date: task.due_date,
            estimated_cost: task.estimated_cost,
            estimate_hours: task.estimate_hours,
            // No assignee_user_id - leave unassigned
            // No assignee_department_id - leave unassigned
            // actual_cost, logged_hours, progress_percentage reset to 0
            actual_cost: 0,
            logged_hours: 0,
            progress_percentage: 0,
          });

        if (newTaskError) throw newTaskError;
      }
      console.log(`Duplicated ${tasks.length} tasks`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        newProjectId: newProject.id,
        message: `Project duplicated successfully with ${departments?.length || 0} departments, ${elements?.length || 0} elements, and ${tasks?.length || 0} tasks`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error duplicating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
