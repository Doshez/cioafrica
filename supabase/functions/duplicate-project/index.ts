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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

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

    // Check if a project with the same name already exists for this user
    const { data: existingProject } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('name', newProjectName)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (existingProject) {
      throw new Error(`A project with the name "${newProjectName}" already exists`);
    }

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
        logo_url: originalProject.logo_url,
      })
      .select()
      .single();

    if (newProjectError) throw newProjectError;

    console.log(`Created new project: ${newProject.id}`);

    // ===== DUPLICATE DEPARTMENTS =====
    const { data: departments, error: deptError } = await supabaseAdmin
      .from('departments')
      .select('*')
      .eq('project_id', projectId);

    if (deptError) throw deptError;

    const deptIdMap = new Map<string, string>();

    if (departments && departments.length > 0) {
      for (const dept of departments) {
        // Check if department with same name already exists in new project
        const { data: existingDept } = await supabaseAdmin
          .from('departments')
          .select('id')
          .eq('project_id', newProject.id)
          .eq('name', dept.name)
          .maybeSingle();

        if (existingDept) {
          deptIdMap.set(dept.id, existingDept.id);
          console.log(`Department already exists, skipping: ${dept.name}`);
          continue;
        }

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

    // ===== DUPLICATE DEPARTMENT LEADS =====
    let duplicatedLeads = 0;
    if (deptIdMap.size > 0) {
      const { data: departmentLeads, error: deptLeadsError } = await supabaseAdmin
        .from('department_leads')
        .select('*')
        .in('department_id', Array.from(deptIdMap.keys()));

      if (deptLeadsError) {
        console.error('Error fetching department leads:', deptLeadsError);
      } else if (departmentLeads && departmentLeads.length > 0) {
        for (const lead of departmentLeads) {
          const newDeptId = deptIdMap.get(lead.department_id);
          if (newDeptId) {
            // Check if this lead already exists
            const { data: existingLead } = await supabaseAdmin
              .from('department_leads')
              .select('id')
              .eq('department_id', newDeptId)
              .eq('user_id', lead.user_id)
              .maybeSingle();

            if (existingLead) {
              console.log(`Department lead already exists, skipping: ${lead.user_id}`);
              continue;
            }

            const { error: newLeadError } = await supabaseAdmin
              .from('department_leads')
              .insert({
                department_id: newDeptId,
                user_id: lead.user_id,
                assigned_by: user.id,
              });

            if (newLeadError) {
              console.error('Error duplicating department lead:', newLeadError);
            } else {
              duplicatedLeads++;
              console.log(`Duplicated department lead for user: ${lead.user_id}`);
            }
          }
        }
      }
    }

    // ===== DUPLICATE PROJECT MEMBERS =====
    let duplicatedMembers = 0;
    const { data: projectMembers, error: membersError } = await supabaseAdmin
      .from('project_members')
      .select('*')
      .eq('project_id', projectId);

    if (membersError) {
      console.error('Error fetching project members:', membersError);
    } else if (projectMembers && projectMembers.length > 0) {
      for (const member of projectMembers) {
        // Check if member already exists in new project
        const { data: existingMember } = await supabaseAdmin
          .from('project_members')
          .select('id')
          .eq('project_id', newProject.id)
          .eq('user_id', member.user_id)
          .maybeSingle();

        if (existingMember) {
          console.log(`Project member already exists, skipping: ${member.user_id}`);
          continue;
        }

        const { error: newMemberError } = await supabaseAdmin
          .from('project_members')
          .insert({
            project_id: newProject.id,
            user_id: member.user_id,
            role: member.role,
          });

        if (newMemberError) {
          console.error('Error duplicating project member:', newMemberError);
        } else {
          duplicatedMembers++;
          console.log(`Duplicated project member: ${member.user_id} with role: ${member.role}`);
        }
      }
    }

    // ===== DUPLICATE ELEMENTS =====
    const { data: elements, error: elemError } = await supabaseAdmin
      .from('elements')
      .select('*')
      .eq('project_id', projectId);

    if (elemError) throw elemError;

    const elementIdMap = new Map<string, string>();

    if (elements && elements.length > 0) {
      for (const element of elements) {
        // Check if element with same title already exists
        const { data: existingElement } = await supabaseAdmin
          .from('elements')
          .select('id')
          .eq('project_id', newProject.id)
          .eq('title', element.title)
          .maybeSingle();

        if (existingElement) {
          elementIdMap.set(element.id, existingElement.id);
          console.log(`Element already exists, skipping: ${element.title}`);
          continue;
        }

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

    // ===== DUPLICATE TASKS =====
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('project_id', projectId);

    if (tasksError) throw tasksError;

    const taskIdMap = new Map<string, string>();

    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        // Check if task with same title already exists
        const { data: existingTask } = await supabaseAdmin
          .from('tasks')
          .select('id')
          .eq('project_id', newProject.id)
          .eq('title', task.title)
          .maybeSingle();

        if (existingTask) {
          taskIdMap.set(task.id, existingTask.id);
          console.log(`Task already exists, skipping: ${task.title}`);
          continue;
        }

        const { data: newTask, error: newTaskError } = await supabaseAdmin
          .from('tasks')
          .insert({
            title: task.title,
            description: task.description,
            project_id: newProject.id,
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
        taskIdMap.set(task.id, newTask.id);
      }
      console.log(`Processed ${tasks.length} tasks`);

      // Update parent task references for newly created tasks
      for (const task of tasks) {
        if (task.parent_task_id) {
          const newTaskId = taskIdMap.get(task.id);
          const newParentId = taskIdMap.get(task.parent_task_id);
          if (newTaskId && newParentId) {
            const { error: updateError } = await supabaseAdmin
              .from('tasks')
              .update({ parent_task_id: newParentId })
              .eq('id', newTaskId);

            if (updateError) {
              console.error('Error updating parent task reference:', updateError);
            }
          }
        }
      }
    }

    // ===== DUPLICATE TASK DEPENDENCIES =====
    let duplicatedDeps = 0;
    if (taskIdMap.size > 0) {
      const { data: taskDependencies, error: depsError } = await supabaseAdmin
        .from('task_dependencies')
        .select('*')
        .in('task_id', Array.from(taskIdMap.keys()));

      if (depsError) {
        console.error('Error fetching task dependencies:', depsError);
      } else if (taskDependencies && taskDependencies.length > 0) {
        for (const dep of taskDependencies) {
          const newTaskId = taskIdMap.get(dep.task_id);
          const newDependsOnId = taskIdMap.get(dep.depends_on_task_id);
          if (newTaskId && newDependsOnId) {
            // Check if dependency already exists
            const { data: existingDep } = await supabaseAdmin
              .from('task_dependencies')
              .select('id')
              .eq('task_id', newTaskId)
              .eq('depends_on_task_id', newDependsOnId)
              .maybeSingle();

            if (existingDep) {
              console.log(`Task dependency already exists, skipping`);
              continue;
            }

            const { error: newDepError } = await supabaseAdmin
              .from('task_dependencies')
              .insert({
                task_id: newTaskId,
                depends_on_task_id: newDependsOnId,
              });

            if (newDepError) {
              console.error('Error duplicating task dependency:', newDepError);
            } else {
              duplicatedDeps++;
            }
          }
        }
        console.log(`Duplicated ${duplicatedDeps} task dependencies`);
      }
    }

    // ===== DUPLICATE DOCUMENT FOLDERS =====
    const { data: folders, error: foldersError } = await supabaseAdmin
      .from('document_folders')
      .select('*')
      .eq('project_id', projectId);

    if (foldersError) {
      console.error('Error fetching document folders:', foldersError);
    }

    const folderIdMap = new Map<string, string>();
    let duplicatedFolders = 0;

    if (folders && folders.length > 0) {
      for (const folder of folders) {
        // Check if folder with same name already exists in the new project
        const { data: existingFolder } = await supabaseAdmin
          .from('document_folders')
          .select('id')
          .eq('project_id', newProject.id)
          .eq('name', folder.name)
          .maybeSingle();

        if (existingFolder) {
          folderIdMap.set(folder.id, existingFolder.id);
          console.log(`Folder already exists, skipping: ${folder.name}`);
          continue;
        }

        const { data: newFolder, error: newFolderError } = await supabaseAdmin
          .from('document_folders')
          .insert({
            name: folder.name,
            project_id: newProject.id,
            department_id: folder.department_id ? deptIdMap.get(folder.department_id) : null,
            created_by: user.id,
          })
          .select()
          .single();

        if (newFolderError) {
          console.error('Error duplicating folder:', newFolderError);
        } else {
          folderIdMap.set(folder.id, newFolder.id);
          duplicatedFolders++;
          console.log(`Duplicated folder: ${folder.name}`);
        }
      }

      // Update parent folder references
      for (const folder of folders) {
        if (folder.parent_folder_id) {
          const newFolderId = folderIdMap.get(folder.id);
          const newParentId = folderIdMap.get(folder.parent_folder_id);
          if (newFolderId && newParentId) {
            const { error: updateError } = await supabaseAdmin
              .from('document_folders')
              .update({ parent_folder_id: newParentId })
              .eq('id', newFolderId);

            if (updateError) {
              console.error('Error updating parent folder reference:', updateError);
            }
          }
        }
      }
    }

    // ===== DUPLICATE DOCUMENT LINKS =====
    let duplicatedLinks = 0;
    const { data: documentLinks, error: linksError } = await supabaseAdmin
      .from('document_links')
      .select('*')
      .eq('project_id', projectId);

    if (linksError) {
      console.error('Error fetching document links:', linksError);
    } else if (documentLinks && documentLinks.length > 0) {
      for (const link of documentLinks) {
        // Check if link with same URL already exists in the new project
        const { data: existingLink } = await supabaseAdmin
          .from('document_links')
          .select('id')
          .eq('project_id', newProject.id)
          .eq('url', link.url)
          .maybeSingle();

        if (existingLink) {
          console.log(`Document link already exists, skipping: ${link.title}`);
          continue;
        }

        const { error: newLinkError } = await supabaseAdmin
          .from('document_links')
          .insert({
            title: link.title,
            url: link.url,
            description: link.description,
            project_id: newProject.id,
            department_id: link.department_id ? deptIdMap.get(link.department_id) : null,
            folder_id: link.folder_id ? folderIdMap.get(link.folder_id) : null,
            created_by: user.id,
          });

        if (newLinkError) {
          console.error('Error duplicating document link:', newLinkError);
        } else {
          duplicatedLinks++;
        }
      }
      console.log(`Duplicated ${duplicatedLinks} document links`);
    }

    // ===== DUPLICATE CHAT SETTINGS =====
    let duplicatedSettings = 0;
    const { data: chatSettings, error: chatSettingsError } = await supabaseAdmin
      .from('chat_settings')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (chatSettingsError) {
      console.error('Error fetching chat settings:', chatSettingsError);
    } else if (chatSettings) {
      // Check if settings already exist for new project
      const { data: existingSettings } = await supabaseAdmin
        .from('chat_settings')
        .select('id')
        .eq('project_id', newProject.id)
        .maybeSingle();

      if (!existingSettings) {
        const { error: newSettingsError } = await supabaseAdmin
          .from('chat_settings')
          .insert({
            project_id: newProject.id,
            public_chat_enabled: chatSettings.public_chat_enabled,
            max_file_size_mb: chatSettings.max_file_size_mb,
            message_retention_days: chatSettings.message_retention_days,
            notifications_enabled: chatSettings.notifications_enabled,
            allowed_file_types: chatSettings.allowed_file_types,
          });

        if (newSettingsError) {
          console.error('Error duplicating chat settings:', newSettingsError);
        } else {
          duplicatedSettings = 1;
          console.log('Duplicated chat settings');
        }
      } else {
        console.log('Chat settings already exist, skipping');
      }
    }

    // ===== DUPLICATE CHAT ROOMS =====
    let duplicatedRooms = 0;
    const { data: chatRooms, error: chatRoomsError } = await supabaseAdmin
      .from('chat_rooms')
      .select('*')
      .eq('project_id', projectId);

    if (chatRoomsError) {
      console.error('Error fetching chat rooms:', chatRoomsError);
    } else if (chatRooms && chatRooms.length > 0) {
      for (const room of chatRooms) {
        // Check if room with same name already exists
        const { data: existingRoom } = await supabaseAdmin
          .from('chat_rooms')
          .select('id')
          .eq('project_id', newProject.id)
          .eq('name', room.name)
          .maybeSingle();

        if (existingRoom) {
          console.log(`Chat room already exists, skipping: ${room.name}`);
          continue;
        }

        const { data: newRoom, error: newRoomError } = await supabaseAdmin
          .from('chat_rooms')
          .insert({
            name: room.name,
            project_id: newProject.id,
            room_type: room.room_type,
            created_by: user.id,
          })
          .select()
          .single();

        if (newRoomError) {
          console.error('Error duplicating chat room:', newRoomError);
        } else {
          // Add the current user as a participant
          await supabaseAdmin
            .from('chat_participants')
            .insert({
              room_id: newRoom.id,
              user_id: user.id,
            });
          duplicatedRooms++;
          console.log(`Duplicated chat room: ${room.name}`);
        }
      }
    }

    const summary = {
      departments: deptIdMap.size,
      departmentLeads: duplicatedLeads,
      projectMembers: duplicatedMembers,
      elements: elementIdMap.size,
      tasks: taskIdMap.size,
      taskDependencies: duplicatedDeps,
      folders: duplicatedFolders,
      documentLinks: duplicatedLinks,
      chatSettings: duplicatedSettings,
      chatRooms: duplicatedRooms,
    };

    return new Response(
      JSON.stringify({
        success: true,
        newProjectId: newProject.id,
        message: `Project duplicated successfully (duplicates skipped)`,
        summary,
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
