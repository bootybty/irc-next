-- Custom role system for channels

-- Channel roles table (custom roles created by channel owners)
CREATE TABLE IF NOT EXISTS channel_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  name VARCHAR(30) NOT NULL,
  color VARCHAR(20) DEFAULT 'text-green-400',
  permissions JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(channel_id, name)
);

-- Update channel_members to reference custom roles instead of hardcoded ones
ALTER TABLE channel_members ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES channel_roles(id) ON DELETE SET NULL;

-- Keep the old role column for backwards compatibility temporarily
-- ALTER TABLE channel_members DROP COLUMN role; -- Don't drop yet

-- Create default roles for existing channels
INSERT INTO channel_roles (channel_id, name, color, permissions, sort_order, created_by)
SELECT 
  c.id as channel_id,
  'Owner' as name,
  'text-red-400' as color,
  '{"can_kick": true, "can_ban": true, "can_manage_roles": true, "can_manage_channel": true, "can_delete_messages": true}' as permissions,
  100 as sort_order,
  c.created_by
FROM channels c
WHERE c.created_by IS NOT NULL
ON CONFLICT (channel_id, name) DO NOTHING;

INSERT INTO channel_roles (channel_id, name, color, permissions, sort_order, created_by)
SELECT 
  c.id as channel_id,
  'Moderator' as name,
  'text-yellow-400' as color,
  '{"can_kick": true, "can_ban": true, "can_manage_roles": false, "can_manage_channel": false, "can_delete_messages": true}' as permissions,
  80 as sort_order,
  c.created_by
FROM channels c
WHERE c.created_by IS NOT NULL
ON CONFLICT (channel_id, name) DO NOTHING;

INSERT INTO channel_roles (channel_id, name, color, permissions, sort_order, created_by)
SELECT 
  c.id as channel_id,
  'VIP' as name,
  'text-purple-400' as color,
  '{"can_kick": false, "can_ban": false, "can_manage_roles": false, "can_manage_channel": false, "can_delete_messages": false}' as permissions,
  60 as sort_order,
  c.created_by
FROM channels c
WHERE c.created_by IS NOT NULL
ON CONFLICT (channel_id, name) DO NOTHING;

INSERT INTO channel_roles (channel_id, name, color, permissions, sort_order, created_by)
SELECT 
  c.id as channel_id,
  'Member' as name,
  'text-green-400' as color,
  '{"can_kick": false, "can_ban": false, "can_manage_roles": false, "can_manage_channel": false, "can_delete_messages": false}' as permissions,
  20 as sort_order,
  c.created_by
FROM channels c
WHERE c.created_by IS NOT NULL
ON CONFLICT (channel_id, name) DO NOTHING;

-- Update existing channel members to use new role system
UPDATE channel_members 
SET role_id = (
  SELECT cr.id FROM channel_roles cr 
  WHERE cr.channel_id = channel_members.channel_id 
  AND CASE 
    WHEN channel_members.role = 'owner' THEN cr.name = 'Owner'
    WHEN channel_members.role = 'moderator' OR channel_members.role = 'admin' THEN cr.name = 'Moderator'
    ELSE cr.name = 'Member'
  END
  LIMIT 1
)
WHERE role_id IS NULL;

-- Function to automatically create default roles for new channels
CREATE OR REPLACE FUNCTION create_default_channel_roles()
RETURNS TRIGGER AS $$
DECLARE
  owner_role_id UUID;
BEGIN
  -- Create Owner role
  INSERT INTO channel_roles (channel_id, name, color, permissions, sort_order, created_by)
  VALUES (
    NEW.id,
    'Owner',
    'text-red-400',
    '{"can_kick": true, "can_ban": true, "can_manage_roles": true, "can_manage_channel": true, "can_delete_messages": true}',
    100,
    NEW.created_by
  )
  RETURNING id INTO owner_role_id;

  -- Create Moderator role
  INSERT INTO channel_roles (channel_id, name, color, permissions, sort_order, created_by)
  VALUES (
    NEW.id,
    'Moderator',
    'text-yellow-400',
    '{"can_kick": true, "can_ban": true, "can_manage_roles": false, "can_manage_channel": false, "can_delete_messages": true}',
    80,
    NEW.created_by
  );

  -- Create VIP role
  INSERT INTO channel_roles (channel_id, name, color, permissions, sort_order, created_by)
  VALUES (
    NEW.id,
    'VIP',
    'text-purple-400',
    '{"can_kick": false, "can_ban": false, "can_manage_roles": false, "can_manage_channel": false, "can_delete_messages": false}',
    60,
    NEW.created_by
  );

  -- Create Member role
  INSERT INTO channel_roles (channel_id, name, color, permissions, sort_order, created_by)
  VALUES (
    NEW.id,
    'Member',
    'text-green-400',
    '{"can_kick": false, "can_ban": false, "can_manage_roles": false, "can_manage_channel": false, "can_delete_messages": false}',
    20,
    NEW.created_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the old trigger and create new one
DROP TRIGGER IF EXISTS trigger_add_channel_owner ON channels;

-- Create new trigger for roles
CREATE TRIGGER trigger_create_default_roles
  AFTER INSERT ON channels
  FOR EACH ROW
  EXECUTE FUNCTION create_default_channel_roles();

-- Update the add_channel_owner function to use new role system
CREATE OR REPLACE FUNCTION add_channel_owner()
RETURNS TRIGGER AS $$
DECLARE
  owner_role_id UUID;
BEGIN
  -- Get the Owner role for this channel
  SELECT id INTO owner_role_id 
  FROM channel_roles 
  WHERE channel_id = NEW.id AND name = 'Owner';

  -- Add the channel creator as owner
  INSERT INTO channel_members (channel_id, user_id, username, role, role_id)
  SELECT 
    NEW.id,
    NEW.created_by,
    u.username,
    'owner',
    owner_role_id
  FROM users u 
  WHERE u.id = NEW.created_by;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger
CREATE TRIGGER trigger_add_channel_owner
  AFTER INSERT ON channels
  FOR EACH ROW
  EXECUTE FUNCTION add_channel_owner();

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_channel_roles_channel ON channel_roles(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_role ON channel_members(role_id);

-- Enable RLS
ALTER TABLE channel_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for channel_roles
CREATE POLICY "Allow public read access to channel roles" ON channel_roles 
  FOR SELECT USING (true);

CREATE POLICY "Channel owners can manage roles" ON channel_roles 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM channels c
      LEFT JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = auth.uid()
      LEFT JOIN channel_roles cr ON cm.role_id = cr.id
      WHERE c.id = channel_roles.channel_id 
      AND (c.created_by = auth.uid() OR (cr.permissions->>'can_manage_roles')::boolean = true)
    )
  );