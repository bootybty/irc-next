-- Add channel_role_id foreign key to channel_members table
-- This enables custom role assignments for channel members

-- Add channel_role_id column (nullable - members without custom roles will be null)
ALTER TABLE channel_members 
ADD COLUMN IF NOT EXISTS channel_role_id UUID;

-- Add foreign key constraint to channel_roles table
ALTER TABLE channel_members 
ADD CONSTRAINT IF NOT EXISTS fk_channel_members_role 
FOREIGN KEY (channel_role_id) REFERENCES channel_roles(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_channel_members_role 
ON channel_members(channel_role_id);

COMMENT ON COLUMN channel_members.channel_role_id IS 'References custom role assigned to member (null = no custom role)';