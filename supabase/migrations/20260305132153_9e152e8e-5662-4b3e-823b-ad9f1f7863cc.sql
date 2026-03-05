
-- Drop existing restrictive INSERT policies on chat_rooms
DROP POLICY IF EXISTS "Admins can create public chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can create department chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can create group chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can create private chat rooms" ON public.chat_rooms;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can create public chat rooms" ON public.chat_rooms
  FOR INSERT TO authenticated
  WITH CHECK (room_type = 'public'::chat_room_type AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create private chat rooms" ON public.chat_rooms
  FOR INSERT TO authenticated
  WITH CHECK (room_type = 'private'::chat_room_type AND created_by = auth.uid());

CREATE POLICY "Users can create department chat rooms" ON public.chat_rooms
  FOR INSERT TO authenticated
  WITH CHECK ((room_type)::text = 'department'::text AND created_by = auth.uid() AND is_project_member(auth.uid(), project_id));

CREATE POLICY "Users can create group chat rooms" ON public.chat_rooms
  FOR INSERT TO authenticated
  WITH CHECK ((room_type)::text = 'group'::text AND created_by = auth.uid() AND is_project_member(auth.uid(), project_id));
