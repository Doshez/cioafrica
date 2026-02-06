-- Add RLS policy to allow external users to update their own must_change_password status
CREATE POLICY "External users can update their own password status"
ON public.external_users
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);