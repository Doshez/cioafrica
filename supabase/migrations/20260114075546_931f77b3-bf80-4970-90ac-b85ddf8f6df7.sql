-- Fix chat_participants SELECT policy so users can resolve the other participant in private chats
-- (previous policy only allowed users to see their own participant row)

ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view participants in their chat rooms" ON public.chat_participants;

CREATE POLICY "Users can view participants in their chat rooms"
ON public.chat_participants
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.chat_participants cp2
    WHERE cp2.room_id = chat_participants.room_id
      AND cp2.user_id = auth.uid()
  )
);
