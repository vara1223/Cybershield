-- Supabase Auth profile table schema for CyberShield

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id OR auth.role() = 'service_role');

CREATE FUNCTION public.create_profile_on_auth_user_insert()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_profile_after_user_sign_up
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_on_auth_user_insert();

-- Scan history and results table
CREATE TABLE scan_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    input_data TEXT,
    verdict TEXT NOT NULL,
    confidence DOUBLE PRECISION,
    explanation TEXT,
    tips JSONB,
    raw JSONB,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own scan logs"
ON scan_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own scan logs"
ON scan_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own scan logs"
ON scan_logs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Login activity / session tracking
CREATE TABLE login_activity (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    device_info TEXT,
    successful BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE login_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own login activity"
ON login_activity
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own login activity"
ON login_activity
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own login activity"
ON login_activity
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
