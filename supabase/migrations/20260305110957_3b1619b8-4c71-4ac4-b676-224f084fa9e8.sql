
-- Add department_id to chat_rooms for department channels (may already exist from partial migration)
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE;

-- Add last_message_preview and last_message_at to chat_rooms for sidebar display
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS last_message_at timestamp with time zone;
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS last_message_preview text;

-- RLS: Allow project members to create group rooms
CREATE POLICY "Users can create group chat rooms"
ON public.chat_rooms
FOR INSERT
TO authenticated
WITH CHECK (
  room_type::text = 'group' AND created_by = auth.uid() AND is_project_member(auth.uid(), project_id)
);

-- RLS: Allow viewing department rooms for project members  
CREATE POLICY "Project members can view department rooms"
ON public.chat_rooms
FOR SELECT
TO authenticated
USING (
  room_type::text = 'department' AND is_project_member(auth.uid(), project_id)
);

-- Allow project members to create department rooms
CREATE POLICY "Users can create department chat rooms"
ON public.chat_rooms
FOR INSERT
TO authenticated
WITH CHECK (
  room_type::text = 'department' AND created_by = auth.uid() AND is_project_member(auth.uid(), project_id)
);

-- Create a function to update last_message fields on chat_rooms
CREATE OR REPLACE FUNCTION public.update_chat_room_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.chat_rooms
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      updated_at = NOW()
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update last message on chat_rooms
CREATE TRIGGER update_room_last_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_room_last_message();
