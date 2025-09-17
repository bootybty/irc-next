-- Add subscription and activity fields to channel_members table
-- This migration adds support for explicit channel subscription and activity tracking

-- Add is_subscribed field (default false - users must explicitly subscribe)
ALTER TABLE channel_members 
ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT false;

-- Add is_active field (tracks if user is currently in channel)
ALTER TABLE channel_members 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Add last_activity timestamp for better tracking
ALTER TABLE channel_members 
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing members to be subscribed (backward compatibility)
-- This ensures current members remain subscribed after migration
UPDATE channel_members 
SET is_subscribed = true, 
    is_active = false,
    last_activity = COALESCE(last_seen, created_at, NOW())
WHERE is_subscribed IS NULL OR is_subscribed = false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_channel_members_subscription 
ON channel_members(channel_id, is_subscribed, is_active);

-- Update RLS policies to include subscription check
-- Only subscribed members should appear in user lists
DROP POLICY IF EXISTS "Users can view channel members" ON channel_members;
CREATE POLICY "Users can view channel members" ON channel_members
FOR SELECT USING (
  auth.uid()::text = user_id OR 
  EXISTS (
    SELECT 1 FROM channel_members cm 
    WHERE cm.channel_id = channel_members.channel_id 
    AND cm.user_id = auth.uid()::text
    AND cm.is_subscribed = true
  )
);

-- Allow users to manage their own subscription status
DROP POLICY IF EXISTS "Users can manage own membership" ON channel_members;
CREATE POLICY "Users can manage own membership" ON channel_members
FOR ALL USING (auth.uid()::text = user_id);

COMMENT ON COLUMN channel_members.is_subscribed IS 'Whether user has explicitly subscribed to this channel';
COMMENT ON COLUMN channel_members.is_active IS 'Whether user is currently active/online in this channel';
COMMENT ON COLUMN channel_members.last_activity IS 'Timestamp of users last activity in this channel';