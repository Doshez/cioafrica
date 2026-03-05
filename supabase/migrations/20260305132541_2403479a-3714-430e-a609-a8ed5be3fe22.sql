-- Update chat room policies to include project owners (not only project_members)
DROP POLICY IF EXISTS "Users can create department chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can create group chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Project members can view department rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can view rooms in their projects" ON public.chat_rooms;

CREATE POLICY "Users can create department chat rooms"
ON public.chat_rooms
FOR INSERT TO authenticated
WITH CHECK (
  room_type = 'department'::chat_room_type
  AND created_by = auth.uid()
  AND has_project_role_level(auth.uid(), project_id, 'viewer'::project_role)
);

CREATE POLICY "Users can create group chat rooms"
ON public.chat_rooms
FOR INSERT TO authenticated
WITH CHECK (
  room_type = 'group'::chat_room_type
  AND created_by = auth.uid()
  AND has_project_role_level(auth.uid(), project_id, 'viewer'::project_role)
);

CREATE POLICY "Project users can view department rooms"
ON public.chat_rooms
FOR SELECT TO authenticated
USING (
  room_type = 'department'::chat_room_type
  AND has_project_role_level(auth.uid(), project_id, 'viewer'::project_role)
);

CREATE POLICY "Project users can view rooms in their projects"
ON public.chat_rooms
FOR SELECT TO authenticated
USING (
  has_project_role_level(auth.uid(), project_id, 'viewer'::project_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);