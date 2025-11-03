-- Create enum for chat room types
CREATE TYPE chat_room_type AS ENUM ('public', 'private');

-- Create enum for user status
CREATE TYPE user_status AS ENUM ('online', 'away', 'busy', 'offline');

-- Create chat_rooms table
CREATE TABLE public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  room_type chat_room_type NOT NULL DEFAULT 'public',
  name TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  attachment_size BIGINT,
  link_url TEXT,
  link_title TEXT,
  link_description TEXT,
  link_image TEXT,
  parent_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create chat_participants table
CREATE TABLE public.chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  muted BOOLEAN DEFAULT false,
  UNIQUE(room_id, user_id)
);

-- Create message_reactions table
CREATE TABLE public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Create user_presence table
CREATE TABLE public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status user_status DEFAULT 'offline',
  custom_status TEXT,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create chat_settings table (project-level settings)
CREATE TABLE public.chat_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  public_chat_enabled BOOLEAN DEFAULT true,
  max_file_size_mb INTEGER DEFAULT 10,
  allowed_file_types TEXT[] DEFAULT ARRAY['pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx'],
  message_retention_days INTEGER DEFAULT 90,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id)
);

-- Enable RLS
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_rooms
CREATE POLICY "Users can view chat rooms they participate in"
ON public.chat_rooms FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_participants.room_id = chat_rooms.id
    AND chat_participants.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can create private chat rooms"
ON public.chat_rooms FOR INSERT
TO authenticated
WITH CHECK (
  room_type = 'private'
  AND created_by = auth.uid()
);

CREATE POLICY "Admins can create public chat rooms"
ON public.chat_rooms FOR INSERT
TO authenticated
WITH CHECK (
  room_type = 'public'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update chat rooms"
ON public.chat_rooms FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete chat rooms"
ON public.chat_rooms FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in their chat rooms"
ON public.chat_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_participants.room_id = chat_messages.room_id
    AND chat_participants.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can create messages in their chat rooms"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_participants.room_id = chat_messages.room_id
    AND chat_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own messages"
ON public.chat_messages FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their own messages or admins can delete any"
ON public.chat_messages FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for chat_participants
CREATE POLICY "Users can view participants in their chat rooms"
ON public.chat_participants FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.room_id = chat_participants.room_id
    AND cp.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can join private chats"
ON public.chat_participants FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage participants"
ON public.chat_participants FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update their own participant settings"
ON public.chat_participants FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for message_reactions
CREATE POLICY "Users can view reactions in their chat rooms"
ON public.message_reactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages
    JOIN public.chat_participants ON chat_messages.room_id = chat_participants.room_id
    WHERE chat_messages.id = message_reactions.message_id
    AND chat_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add reactions"
ON public.message_reactions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own reactions"
ON public.message_reactions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for user_presence
CREATE POLICY "Everyone can view user presence"
ON public.user_presence FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own presence"
ON public.user_presence FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can modify their own presence"
ON public.user_presence FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for chat_settings
CREATE POLICY "Users can view chat settings for their projects"
ON public.chat_settings FOR SELECT
TO authenticated
USING (
  has_project_role_level(auth.uid(), project_id, 'viewer'::project_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can manage chat settings"
ON public.chat_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_chat_messages_room_id ON public.chat_messages(room_id);
CREATE INDEX idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX idx_chat_participants_room_id ON public.chat_participants(room_id);
CREATE INDEX idx_chat_participants_user_id ON public.chat_participants(user_id);
CREATE INDEX idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX idx_user_presence_status ON public.user_presence(status);

-- Create trigger for updated_at
CREATE TRIGGER update_chat_rooms_updated_at
  BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_settings_updated_at
  BEFORE UPDATE ON public.chat_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_presence_updated_at
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);

-- Storage policies for chat attachments
CREATE POLICY "Users can upload attachments to their chats"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view attachments in their chats"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);