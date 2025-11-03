-- Fix infinite recursion in chat_participants RLS policies
DROP POLICY IF EXISTS "Users can view participants in their chat rooms" ON public.chat_participants;

-- Create a simpler policy without recursion
CREATE POLICY "Users can view participants in their chat rooms"
  ON public.chat_participants
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix chat_rooms RLS to avoid using chat_participants which causes recursion
DROP POLICY IF EXISTS "Users can view chat rooms they participate in" ON public.chat_rooms;

CREATE POLICY "Users can view rooms in their projects"
  ON public.chat_rooms
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid() 
      AND pm.project_id = chat_rooms.project_id
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );