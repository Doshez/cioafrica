-- First, create a security definer function to check if user is a participant in a room
CREATE OR REPLACE FUNCTION public.is_chat_participant(_user_id uuid, _room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE user_id = _user_id
      AND room_id = _room_id
  )
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view participants in their rooms" ON public.chat_participants;

-- Create a new policy using the security definer function
CREATE POLICY "Users can view participants in their rooms"
ON public.chat_participants
FOR SELECT
USING (public.is_chat_participant(auth.uid(), room_id));