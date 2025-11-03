-- Fix RLS policy for password reset requests to allow unauthenticated users
-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create their own reset requests" ON password_reset_requests;

-- Create a new policy that allows anyone to create a reset request
-- Security is maintained by validating the email exists in the profiles table in the app code
CREATE POLICY "Anyone can create password reset requests"
ON password_reset_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Also ensure the SELECT policy allows unauthenticated requests to be visible to admins only
DROP POLICY IF EXISTS "Users can view their own reset requests" ON password_reset_requests;

CREATE POLICY "Users and admins can view reset requests"
ON password_reset_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));