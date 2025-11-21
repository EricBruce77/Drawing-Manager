-- User Access Control System
-- Only whitelisted emails can sign up and access the system

-- Create allowed_users table
CREATE TABLE IF NOT EXISTS allowed_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  allowed_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view the whitelist
CREATE POLICY "Admins can view allowed users"
  ON allowed_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can add users to whitelist
CREATE POLICY "Admins can insert allowed users"
  ON allowed_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can update/delete from whitelist
CREATE POLICY "Admins can update allowed users"
  ON allowed_users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete allowed users"
  ON allowed_users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add your admin email to the whitelist (REPLACE WITH YOUR EMAIL)
INSERT INTO allowed_users (email, notes, allowed_by)
VALUES
  ('your-admin-email@company.com', 'Initial admin user', NULL),
  ('admin@company.com', 'Admin user', NULL)
ON CONFLICT (email) DO NOTHING;

-- Optional: Add your company domain pattern
CREATE TABLE IF NOT EXISTS allowed_domains (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE allowed_domains ENABLE ROW LEVEL SECURITY;

-- Only admins can manage domains
CREATE POLICY "Admins can manage domains"
  ON allowed_domains
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Example: Add your company domain
-- INSERT INTO allowed_domains (domain) VALUES ('company.com');

-- Function to check if user is allowed to sign up
CREATE OR REPLACE FUNCTION is_email_allowed(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if email is in whitelist
  IF EXISTS (
    SELECT 1 FROM allowed_users
    WHERE email = user_email
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- Check if email domain is allowed (optional)
  IF EXISTS (
    SELECT 1 FROM allowed_domains
    WHERE user_email LIKE '%@' || domain
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to validate email on signup
CREATE OR REPLACE FUNCTION validate_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if email is allowed
  IF NOT is_email_allowed(NEW.email) THEN
    RAISE EXCEPTION 'This email is not authorized to access the system. Please contact your administrator.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on auth.users table
-- Note: This requires Supabase database webhooks or you'll need to handle this in your app
-- For now, we'll handle validation in the application layer

-- Create a view for easy whitelist management
CREATE OR REPLACE VIEW user_access_summary AS
SELECT
  au.id,
  au.email,
  au.is_active,
  au.added_at,
  au.notes,
  p.full_name as added_by_name,
  CASE
    WHEN u.id IS NOT NULL THEN 'Registered'
    ELSE 'Not Registered'
  END as status
FROM allowed_users au
LEFT JOIN profiles p ON p.id = au.allowed_by
LEFT JOIN auth.users u ON u.email = au.email
ORDER BY au.added_at DESC;

-- Grant access to view for admins
GRANT SELECT ON user_access_summary TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_allowed_users_email ON allowed_users(email);
CREATE INDEX IF NOT EXISTS idx_allowed_users_active ON allowed_users(is_active) WHERE is_active = true;
