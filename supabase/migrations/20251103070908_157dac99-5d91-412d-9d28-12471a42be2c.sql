-- Add DELETE policy for admins on password_reset_requests
CREATE POLICY "Admins can delete reset requests"
ON password_reset_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));