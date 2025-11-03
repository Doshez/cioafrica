-- First drop the existing policy
DROP POLICY "Users can add participants to their chats" ON public.chat_participants;

-- Create the updated policy that allows users to add participants to chats they create or are part of
CREATE POLICY "Users can add participants to their chats" 
ON public.chat_participants 
FOR INSERT 
WITH CHECK (
  -- Allow users to add themselves
  user_id = auth.uid() 
  OR 
  -- Allow users to add others to private chats they're creating/participating in
  (
    EXISTS (
      SELECT 1 
      FROM public.chat_rooms cr
      WHERE cr.id = chat_participants.room_id
        AND cr.room_type = 'private'
        AND cr.created_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.room_id = chat_participants.room_id
        AND cp.user_id = auth.uid()
    )
  )
);