-- Drop all existing chat_participants policies to start fresh
DROP POLICY IF EXISTS "Users can view participants in their rooms" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can view participants in their chat rooms" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can add participants to their chats" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can update their own participant settings" ON public.chat_participants;
DROP POLICY IF EXISTS "Admins can manage participants" ON public.chat_participants;

-- Create a helper function to check if user can access a chat room (via chat_rooms table, NOT chat_participants)
CREATE OR REPLACE FUNCTION public.can_access_chat_room(_user_id uuid, _room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_rooms 
    WHERE id = _room_id 
    AND (
      created_by = _user_id 
      OR room_type = 'public'
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE room_id = _room_id AND user_id = _user_id
  )
$$;

-- SELECT: Users can see their own participation OR they're admins
-- Using direct user_id check to avoid recursion
CREATE POLICY "chat_participants_select"
ON public.chat_participants
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
  OR public.can_access_chat_room(auth.uid(), room_id)
);

-- INSERT: Users can add themselves, or add others if they created the room
CREATE POLICY "chat_participants_insert"
ON public.chat_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_rooms
    WHERE id = room_id AND created_by = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- UPDATE: Users can only update their own participation record
CREATE POLICY "chat_participants_update"
ON public.chat_participants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Users can remove themselves, room creators can remove anyone, admins can remove anyone
CREATE POLICY "chat_participants_delete"
ON public.chat_participants
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_rooms
    WHERE id = room_id AND created_by = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);