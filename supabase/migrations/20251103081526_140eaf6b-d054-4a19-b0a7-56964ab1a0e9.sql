-- Add unique constraint to chat_participants to prevent duplicates
-- and enable proper upsert behavior
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chat_participants_room_user_unique'
  ) THEN
    ALTER TABLE public.chat_participants
    ADD CONSTRAINT chat_participants_room_user_unique 
    UNIQUE (room_id, user_id);
  END IF;
END $$;