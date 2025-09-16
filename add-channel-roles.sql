-- Channel roles and moderation system

-- Channel members table to track user roles in channels
CREATE TABLE IF NOT EXISTS channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL,
  role VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

-- Channel bans table
CREATE TABLE IF NOT EXISTS channel_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES users(id),
  reason TEXT,
  banned_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  UNIQUE(channel_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_bans_channel ON channel_bans(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_bans_user ON channel_bans(user_id);

-- Enable RLS
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_bans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for channel_members
CREATE POLICY "Allow public read access to channel members" ON channel_members 
  FOR SELECT USING (true);

CREATE POLICY "Channel owners can manage all members" ON channel_members 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM channels 
      WHERE channels.id = channel_members.channel_id 
      AND channels.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can join channels" ON channel_members 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave channels" ON channel_members 
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for channel_bans  
CREATE POLICY "Allow public read access to channel bans" ON channel_bans 
  FOR SELECT USING (true);

CREATE POLICY "Channel owners and mods can manage bans" ON channel_bans 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM channels c
      LEFT JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = auth.uid()
      WHERE c.id = channel_bans.channel_id 
      AND (c.created_by = auth.uid() OR cm.role IN ('moderator', 'admin'))
    )
  );

-- Function to automatically add channel creator as owner
CREATE OR REPLACE FUNCTION add_channel_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Add the channel creator as owner/admin
  INSERT INTO channel_members (channel_id, user_id, username, role)
  SELECT 
    NEW.id,
    NEW.created_by,
    u.username,
    'owner'
  FROM users u 
  WHERE u.id = NEW.created_by;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-add channel owner
CREATE TRIGGER trigger_add_channel_owner
  AFTER INSERT ON channels
  FOR EACH ROW
  EXECUTE FUNCTION add_channel_owner();

-- Function to check if user is banned from channel
CREATE OR REPLACE FUNCTION is_user_banned(channel_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM channel_bans 
    WHERE channel_id = channel_uuid 
    AND user_id = user_uuid 
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql;

-- Add some existing channel owners to their channels
INSERT INTO channel_members (channel_id, user_id, username, role)
SELECT 
  c.id,
  c.created_by,
  u.username,
  'owner'
FROM channels c
JOIN users u ON c.created_by = u.id
WHERE c.created_by IS NOT NULL
ON CONFLICT (channel_id, user_id) DO UPDATE SET role = 'owner';