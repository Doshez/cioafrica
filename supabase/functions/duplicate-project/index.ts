import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Declare EdgeRuntime for TypeScript
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

// Define types for our data
interface Department {
  id: string;
  name: string;
  description: string | null;
  project_id: string;
}

interface DepartmentLead {
  id: string;
  department_id: string;
  user_id: string;
  assigned_by: string | null;
}

interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
}

interface Element {
  id: string;
  title: string;
  description: string | null;
  project_id: string;
  department_id: string | null;
  priority: string | null;
  start_date: string | null;
  due_date: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string;
  element_id: string | null;
  assignee_department_id: string | null;
  parent_task_id: string | null;
  status: string;
  priority: string;
  labels: string[] | null;
  start_date: string | null;
  due_date: string | null;
  estimated_cost: number | null;
  estimate_hours: number | null;
}

interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
}

interface DocumentFolder {
  id: string;
  name: string;
  project_id: string;
  department_id: string | null;
  parent_folder_id: string | null;
}

interface DocumentLink {
  id: string;
  title: string;
  url: string;
  description: string | null;
  project_id: string;
  department_id: string | null;
  folder_id: string | null;
}

interface ChatSettings {
  id: string;
  project_id: string;
  public_chat_enabled: boolean;
  max_file_size_mb: number;
  message_retention_days: number;
  notifications_enabled: boolean;
  allowed_file_types: string[];
}

interface ChatRoom {
  id: string;
  name: string;
  project_id: string;
  room_type: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string;
  end_date: string | null;
  owner_id: string;
  theme_colors: Record<string, string> | null;
  logo_url: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function performDuplication(
  supabaseAdmin: any,
  projectId: string,
  userId: string,
  newProjectId: string
) {
  console.log(`Background: Starting duplication for project ${projectId}`);

  try {
    // ===== DUPLICATE DEPARTMENTS =====
    const { data: departmentsData, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('*')
      .eq('project_id', projectId);

    if (deptError) throw deptError;

    const departments = (departmentsData || []) as unknown as Department[];
    const deptIdMap = new Map<string, string>();

    for (const dept of departments) {
      const { data: existingDeptData } = await supabaseAdmin
        .from('departments')
        .select('id')
        .eq('project_id', newProjectId)
        .eq('name', dept.name)
        .maybeSingle();

      if (existingDeptData) {
        const existing = existingDeptData as unknown as { id: string };
        deptIdMap.set(dept.id, existing.id);
        continue;
      }

      const { data: newDeptData, error: newDeptError } = await supabaseAdmin
        .from('departments')
        .insert({
          name: dept.name,
          description: dept.description,
          project_id: newProjectId,
        })
        .select()
        .single();

      if (newDeptError) throw newDeptError;
      const newDept = newDeptData as unknown as { id: string };
      deptIdMap.set(dept.id, newDept.id);
    }
    console.log(`Background: Duplicated ${deptIdMap.size} departments`);

    // ===== DUPLICATE DEPARTMENT LEADS =====
    if (deptIdMap.size > 0) {
      const { data: leadsData } = await supabaseAdmin
        .from('department_leads')
        .select('*')
        .in('department_id', Array.from(deptIdMap.keys()));

      const leads = (leadsData || []) as unknown as DepartmentLead[];
      for (const lead of leads) {
        const newDeptId = deptIdMap.get(lead.department_id);
        if (newDeptId) {
          const { data: existingLead } = await supabaseAdmin
            .from('department_leads')
            .select('id')
            .eq('department_id', newDeptId)
            .eq('user_id', lead.user_id)
            .maybeSingle();

          if (!existingLead) {
            await supabaseAdmin.from('department_leads').insert({
              department_id: newDeptId,
              user_id: lead.user_id,
              assigned_by: userId,
            });
          }
        }
      }
    }

    // ===== DUPLICATE PROJECT MEMBERS =====
    const { data: membersData } = await supabaseAdmin
      .from('project_members')
      .select('*')
      .eq('project_id', projectId);

    const members = (membersData || []) as unknown as ProjectMember[];
    for (const member of members) {
      const { data: existingMember } = await supabaseAdmin
        .from('project_members')
        .select('id')
        .eq('project_id', newProjectId)
        .eq('user_id', member.user_id)
        .maybeSingle();

      if (!existingMember) {
        await supabaseAdmin.from('project_members').insert({
          project_id: newProjectId,
          user_id: member.user_id,
          role: member.role,
        });
      }
    }
    console.log(`Background: Duplicated project members`);

    // ===== DUPLICATE ELEMENTS =====
    const { data: elementsData, error: elemError } = await supabaseAdmin
      .from('elements')
      .select('*')
      .eq('project_id', projectId);

    if (elemError) throw elemError;

    const elements = (elementsData || []) as unknown as Element[];
    const elementIdMap = new Map<string, string>();

    for (const element of elements) {
      const { data: existingElementData } = await supabaseAdmin
        .from('elements')
        .select('id')
        .eq('project_id', newProjectId)
        .eq('title', element.title)
        .maybeSingle();

      if (existingElementData) {
        const existing = existingElementData as unknown as { id: string };
        elementIdMap.set(element.id, existing.id);
        continue;
      }

      const { data: newElementData, error: newElementError } = await supabaseAdmin
        .from('elements')
        .insert({
          title: element.title,
          description: element.description,
          project_id: newProjectId,
          department_id: element.department_id ? deptIdMap.get(element.department_id) : null,
          priority: element.priority,
          start_date: element.start_date,
          due_date: element.due_date,
        })
        .select()
        .single();

      if (newElementError) throw newElementError;
      const newElement = newElementData as unknown as { id: string };
      elementIdMap.set(element.id, newElement.id);
    }
    console.log(`Background: Duplicated ${elementIdMap.size} elements`);

    // ===== DUPLICATE TASKS =====
    const { data: tasksData, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('project_id', projectId);

    if (tasksError) throw tasksError;

    const tasks = (tasksData || []) as unknown as Task[];
    const taskIdMap = new Map<string, string>();

    for (const task of tasks) {
      const { data: existingTaskData } = await supabaseAdmin
        .from('tasks')
        .select('id')
        .eq('project_id', newProjectId)
        .eq('title', task.title)
        .maybeSingle();

      if (existingTaskData) {
        const existing = existingTaskData as unknown as { id: string };
        taskIdMap.set(task.id, existing.id);
        continue;
      }

      const { data: newTaskData, error: newTaskError } = await supabaseAdmin
        .from('tasks')
        .insert({
          title: task.title,
          description: task.description,
          project_id: newProjectId,
          element_id: task.element_id ? elementIdMap.get(task.element_id) : null,
          assignee_department_id: task.assignee_department_id ? deptIdMap.get(task.assignee_department_id) : null,
          status: 'todo',
          priority: task.priority,
          labels: task.labels,
          start_date: task.start_date,
          due_date: task.due_date,
          estimated_cost: task.estimated_cost,
          estimate_hours: task.estimate_hours,
          actual_cost: 0,
          logged_hours: 0,
          progress_percentage: 0,
        })
        .select()
        .single();

      if (newTaskError) throw newTaskError;
      const newTask = newTaskData as unknown as { id: string };
      taskIdMap.set(task.id, newTask.id);
    }

    // Update parent task references
    for (const task of tasks) {
      if (task.parent_task_id) {
        const newTaskId = taskIdMap.get(task.id);
        const newParentId = taskIdMap.get(task.parent_task_id);
        if (newTaskId && newParentId) {
          await supabaseAdmin.from('tasks').update({ parent_task_id: newParentId }).eq('id', newTaskId);
        }
      }
    }
    console.log(`Background: Duplicated ${taskIdMap.size} tasks`);

    // ===== DUPLICATE TASK DEPENDENCIES =====
    if (taskIdMap.size > 0) {
      const { data: depsData } = await supabaseAdmin
        .from('task_dependencies')
        .select('*')
        .in('task_id', Array.from(taskIdMap.keys()));

      const deps = (depsData || []) as unknown as TaskDependency[];
      for (const dep of deps) {
        const newTaskId = taskIdMap.get(dep.task_id);
        const newDependsOnId = taskIdMap.get(dep.depends_on_task_id);
        if (newTaskId && newDependsOnId) {
          const { data: existingDep } = await supabaseAdmin
            .from('task_dependencies')
            .select('id')
            .eq('task_id', newTaskId)
            .eq('depends_on_task_id', newDependsOnId)
            .maybeSingle();

          if (!existingDep) {
            await supabaseAdmin.from('task_dependencies').insert({
              task_id: newTaskId,
              depends_on_task_id: newDependsOnId,
            });
          }
        }
      }
    }

    // ===== DUPLICATE DOCUMENT FOLDERS =====
    const { data: foldersData } = await supabaseAdmin
      .from('document_folders')
      .select('*')
      .eq('project_id', projectId);

    const folders = (foldersData || []) as unknown as DocumentFolder[];
    const folderIdMap = new Map<string, string>();

    for (const folder of folders) {
      const { data: existingFolderData } = await supabaseAdmin
        .from('document_folders')
        .select('id')
        .eq('project_id', newProjectId)
        .eq('name', folder.name)
        .maybeSingle();

      if (existingFolderData) {
        const existing = existingFolderData as unknown as { id: string };
        folderIdMap.set(folder.id, existing.id);
        continue;
      }

      const { data: newFolderData } = await supabaseAdmin
        .from('document_folders')
        .insert({
          name: folder.name,
          project_id: newProjectId,
          department_id: folder.department_id ? deptIdMap.get(folder.department_id) : null,
          created_by: userId,
        })
        .select()
        .single();

      if (newFolderData) {
        const newFolder = newFolderData as unknown as { id: string };
        folderIdMap.set(folder.id, newFolder.id);
      }
    }

    // Update parent folder references
    for (const folder of folders) {
      if (folder.parent_folder_id) {
        const newFolderId = folderIdMap.get(folder.id);
        const newParentId = folderIdMap.get(folder.parent_folder_id);
        if (newFolderId && newParentId) {
          await supabaseAdmin.from('document_folders').update({ parent_folder_id: newParentId }).eq('id', newFolderId);
        }
      }
    }
    console.log(`Background: Duplicated ${folderIdMap.size} folders`);

    // ===== DUPLICATE DOCUMENT LINKS =====
    const { data: linksData } = await supabaseAdmin
      .from('document_links')
      .select('*')
      .eq('project_id', projectId);

    const links = (linksData || []) as unknown as DocumentLink[];
    for (const link of links) {
      const { data: existingLink } = await supabaseAdmin
        .from('document_links')
        .select('id')
        .eq('project_id', newProjectId)
        .eq('url', link.url)
        .maybeSingle();

      if (!existingLink) {
        await supabaseAdmin.from('document_links').insert({
          title: link.title,
          url: link.url,
          description: link.description,
          project_id: newProjectId,
          department_id: link.department_id ? deptIdMap.get(link.department_id) : null,
          folder_id: link.folder_id ? folderIdMap.get(link.folder_id) : null,
          created_by: userId,
        });
      }
    }
    console.log(`Background: Duplicated document links`);

    // ===== DUPLICATE CHAT SETTINGS =====
    const { data: settingsData } = await supabaseAdmin
      .from('chat_settings')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (settingsData) {
      const settings = settingsData as unknown as ChatSettings;
      const { data: existingSettings } = await supabaseAdmin
        .from('chat_settings')
        .select('id')
        .eq('project_id', newProjectId)
        .maybeSingle();

      if (!existingSettings) {
        await supabaseAdmin.from('chat_settings').insert({
          project_id: newProjectId,
          public_chat_enabled: settings.public_chat_enabled,
          max_file_size_mb: settings.max_file_size_mb,
          message_retention_days: settings.message_retention_days,
          notifications_enabled: settings.notifications_enabled,
          allowed_file_types: settings.allowed_file_types,
        });
      }
    }

    // ===== DUPLICATE CHAT ROOMS =====
    const { data: roomsData } = await supabaseAdmin
      .from('chat_rooms')
      .select('*')
      .eq('project_id', projectId);

    const rooms = (roomsData || []) as unknown as ChatRoom[];
    for (const room of rooms) {
      const { data: existingRoom } = await supabaseAdmin
        .from('chat_rooms')
        .select('id')
        .eq('project_id', newProjectId)
        .eq('name', room.name)
        .maybeSingle();

      if (!existingRoom) {
        const { data: newRoomData } = await supabaseAdmin
          .from('chat_rooms')
          .insert({
            name: room.name,
            project_id: newProjectId,
            room_type: room.room_type,
            created_by: userId,
          })
          .select()
          .single();

        if (newRoomData) {
          const newRoom = newRoomData as unknown as { id: string };
          await supabaseAdmin.from('chat_participants').insert({
            room_id: newRoom.id,
            user_id: userId,
          });
        }
      }
    }
    console.log(`Background: Duplicated chat rooms`);

    // Update project status to indicate duplication is complete
    await supabaseAdmin
      .from('projects')
      .update({ status: 'active' })
      .eq('id', newProjectId);

    console.log(`Background: Duplication completed for project ${newProjectId}`);
  } catch (error) {
    console.error('Background: Error during duplication:', error);
    await supabaseAdmin
      .from('projects')
      .update({ status: 'error' })
      .eq('id', newProjectId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      throw new Error('Unauthorized');
    }

    const user = userData.user;
    const { projectId, newProjectName } = await req.json();

    if (!projectId || !newProjectName) {
      throw new Error('Missing required parameters');
    }

    console.log(`Starting duplication for project ${projectId} with name: ${newProjectName}`);

    // Get the original project
    const { data: originalProjectData, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;
    const originalProject = originalProjectData as unknown as Project;

    // Check if a project with the same name already exists
    const { data: existingProject } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('name', newProjectName)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (existingProject) {
      throw new Error(`A project with the name "${newProjectName}" already exists`);
    }

    // Create the new project immediately with 'duplicating' status
    const { data: newProjectData, error: newProjectError } = await supabaseAdmin
      .from('projects')
      .insert({
        name: newProjectName,
        description: originalProject.description,
        status: 'duplicating',
        start_date: originalProject.start_date,
        end_date: originalProject.end_date,
        owner_id: user.id,
        theme_colors: originalProject.theme_colors,
        logo_url: originalProject.logo_url,
      })
      .select()
      .single();

    if (newProjectError) throw newProjectError;
    const newProject = newProjectData as unknown as Project;

    console.log(`Created project shell: ${newProject.id}, starting background duplication`);

    // Start background duplication
    EdgeRuntime.waitUntil(
      performDuplication(supabaseAdmin, projectId, user.id, newProject.id)
    );

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        newProjectId: newProject.id,
        message: 'Project duplication started. The project will appear shortly.',
        status: 'duplicating',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error initiating duplication:', error);
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
