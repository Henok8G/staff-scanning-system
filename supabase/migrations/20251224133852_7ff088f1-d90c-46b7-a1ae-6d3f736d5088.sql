-- Create staff_profiles table
CREATE TABLE public.staff_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  approved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on staff_profiles
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

-- Staff can read their own profile
CREATE POLICY "Staff can read own profile"
  ON public.staff_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Staff can insert their own profile on signup
CREATE POLICY "Staff can insert own profile"
  ON public.staff_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create qr_sessions table
CREATE TABLE public.qr_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('CHECK_IN', 'CHECK_OUT')),
  valid_from timestamp with time zone NOT NULL,
  valid_until timestamp with time zone NOT NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on qr_sessions
ALTER TABLE public.qr_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read qr_sessions (needed for validation)
CREATE POLICY "Authenticated users can read qr_sessions"
  ON public.qr_sessions
  FOR SELECT
  TO authenticated
  USING (true);

-- Create attendance_logs table
CREATE TABLE public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qr_session_id uuid NOT NULL REFERENCES public.qr_sessions(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('CHECKED_IN', 'CHECKED_OUT', 'INCIDENT')),
  scanned_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on attendance_logs
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Staff can read their own attendance logs (excluding incidents)
CREATE POLICY "Staff can read own attendance logs"
  ON public.attendance_logs
  FOR SELECT
  USING (auth.uid() = staff_id AND status != 'INCIDENT');

-- Staff can insert attendance logs (handled via edge function for validation)
CREATE POLICY "Staff can insert attendance logs"
  ON public.attendance_logs
  FOR INSERT
  WITH CHECK (auth.uid() = staff_id);

-- Create function to get last attendance status for a staff member
CREATE OR REPLACE FUNCTION public.get_last_attendance_status(p_staff_id uuid)
RETURNS TABLE(status text, scanned_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status, scanned_at
  FROM public.attendance_logs
  WHERE staff_id = p_staff_id
    AND status != 'INCIDENT'
  ORDER BY scanned_at DESC
  LIMIT 1;
$$;