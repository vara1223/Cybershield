-- ============================================================
-- CyberShield: Allow admin to read ALL scan_logs in Supabase
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- The current RLS only allows users to see their OWN logs.
-- For the admin portal to show all users' scans, we need to
-- add a policy that allows reading all rows when authenticated.

-- Drop the existing select policy (only sees own logs)
DROP POLICY IF EXISTS "Users can select own scan logs" ON scan_logs;

-- Recreate: authenticated users can read ALL logs (admin portal needs this)
CREATE POLICY "Authenticated users can read all scan logs"
ON scan_logs
FOR SELECT
TO authenticated
USING (true);

-- Verify:
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'scan_logs';
