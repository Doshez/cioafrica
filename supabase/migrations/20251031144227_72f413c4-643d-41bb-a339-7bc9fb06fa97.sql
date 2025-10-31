-- Add must_change_password field to profiles table
ALTER TABLE public.profiles
ADD COLUMN must_change_password boolean DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN public.profiles.must_change_password IS 'Flag to indicate if user must change password on next login (for temporary passwords)';
