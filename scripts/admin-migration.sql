-- Admin System Database Migration
-- This migration creates the necessary tables and fields for the admin system

-- 1. Add site-wide admin roles to users table (already has is_super_admin)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_site_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_site_moderator BOOLEAN DEFAULT FALSE;

-- 2. Create admin_logs table for tracking all admin actions
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'site_ban', 'site_unban', 'promote_admin', 'demote_admin', etc.
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB, -- Additional data about the action
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- 3. Create site_bans table for global bans
CREATE TABLE IF NOT EXISTS site_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  banned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL means permanent ban
  unbanned_at TIMESTAMPTZ, -- Set when ban is lifted
  unbanned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_site_bans_user_id ON site_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_site_bans_expires_at ON site_bans(expires_at);

-- 4. Create admin_reports table for user reports
CREATE TABLE IF NOT EXISTS admin_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_reports_status ON admin_reports(status);
CREATE INDEX IF NOT EXISTS idx_admin_reports_reported_user ON admin_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_reports_created_at ON admin_reports(created_at DESC);

-- 5. Create admin channel if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM channels WHERE name = 'admin') THEN
    INSERT INTO channels (id, name, topic, created_at)
    VALUES (
      gen_random_uuid(), 
      'admin', 
      'Site administration and moderation command center', 
      NOW()
    );
  END IF;
END $$;

-- 6. Create function to check if user is site admin
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

-- 7. Create function to check if user is site moderator or higher
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

-- 8. Create function to check if user is banned
CREATE OR REPLACE FUNCTION is_user_site_banned(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM site_bans 
    WHERE user_id = user_id 
    AND unbanned_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql;