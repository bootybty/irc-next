-- Add MOTD (Message of the Day) support to channels

-- Add motd column to channels table
ALTER TABLE channels ADD COLUMN IF NOT EXISTS motd TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS motd_set_by UUID REFERENCES users(id);
ALTER TABLE channels ADD COLUMN IF NOT EXISTS motd_set_at TIMESTAMP;

-- Set default MOTD for existing channels
UPDATE channels SET 
  motd = 'Welcome to the retro IRC experience!' 
WHERE motd IS NULL;