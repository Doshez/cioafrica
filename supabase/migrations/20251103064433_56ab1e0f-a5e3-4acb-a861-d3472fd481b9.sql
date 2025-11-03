-- Create password reset requests table
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT NOT NULL,
  user_full_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by_admin_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own reset requests"
  ON public.password_reset_requests
  FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Users can create their own requests
CREATE POLICY "Users can create their own reset requests"
  ON public.password_reset_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can update requests
CREATE POLICY "Admins can update reset requests"
  ON public.password_reset_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can view all requests
CREATE POLICY "Admins can view all reset requests"
  ON public.password_reset_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add temporary password expiry to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON public.password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_id ON public.password_reset_requests(user_id);