-- Add Site Owner column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON users(is_super_admin);

-- Update admin functions to include super admin
CREATE OR REPLACE FUNCTION is_user_site_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id 
    AND (is_super_admin = TRUE OR is_site_admin = TRUE)
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_user_site_moderator(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = user_id 
    AND (is_super_admin = TRUE OR is_site_admin = TRUE OR is_site_moderator = TRUE)
  );
END;
$$ LANGUAGE plpgsql;