
CREATE TABLE public.overdue_reminder_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  send_time time NOT NULL DEFAULT '08:00:00',
  reminder_days text[] NOT NULL DEFAULT ARRAY['monday','wednesday','friday'],
  timezone text NOT NULL DEFAULT 'Africa/Nairobi',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.overdue_reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage overdue settings" ON public.overdue_reminder_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view overdue settings" ON public.overdue_reminder_settings
  FOR SELECT TO authenticated
  USING (true);

-- Insert default settings
INSERT INTO public.overdue_reminder_settings (enabled, send_time, reminder_days, timezone)
VALUES (true, '08:00:00', ARRAY['monday','wednesday','friday'], 'Africa/Nairobi');
