-- Add category support to channels table

-- Channel categories table
CREATE TABLE IF NOT EXISTS channel_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  emoji VARCHAR(10) DEFAULT '📁',
  color VARCHAR(20) DEFAULT 'text-green-400',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(server_id, name)
);

-- Add category_id to existing channels table
ALTER TABLE channels ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES channel_categories(id) ON DELETE SET NULL;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Create default categories for existing servers
INSERT INTO channel_categories (server_id, name, emoji, color, sort_order) VALUES 
  -- General server categories
  ('11111111-1111-1111-1111-111111111111', 'General', '💬', 'text-green-400', 0),
  ('11111111-1111-1111-1111-111111111111', 'Help & Support', '🆘', 'text-yellow-400', 1),
  
  -- Tech Talk server categories  
  ('22222222-2222-2222-2222-222222222222', 'Development', '💻', 'text-blue-400', 0),
  ('22222222-2222-2222-2222-222222222222', 'Web Technologies', '🌐', 'text-cyan-400', 1),
  ('22222222-2222-2222-2222-222222222222', 'Mobile Dev', '📱', 'text-purple-400', 2),
  
  -- Gaming server categories
  ('33333333-3333-3333-3333-333333333333', 'Gaming General', '🎮', 'text-red-400', 0),
  ('33333333-3333-3333-3333-333333333333', 'Platform Specific', '🖥️', 'text-magenta-400', 1)
ON CONFLICT (server_id, name) DO NOTHING;

-- Update existing channels with categories
UPDATE channels SET category_id = (
  SELECT id FROM channel_categories 
  WHERE server_id = channels.server_id AND name = 'General'
) WHERE server_id = '11111111-1111-1111-1111-111111111111' AND name IN ('lobby', 'random');

UPDATE channels SET category_id = (
  SELECT id FROM channel_categories 
  WHERE server_id = channels.server_id AND name = 'Help & Support'
) WHERE server_id = '11111111-1111-1111-1111-111111111111' AND name = 'help';

UPDATE channels SET category_id = (
  SELECT id FROM channel_categories 
  WHERE server_id = channels.server_id AND name = 'Development'
) WHERE server_id = '22222222-2222-2222-2222-222222222222' AND name = 'programming';

UPDATE channels SET category_id = (
  SELECT id FROM channel_categories 
  WHERE server_id = channels.server_id AND name = 'Web Technologies'
) WHERE server_id = '22222222-2222-2222-2222-222222222222' AND name = 'web-dev';

UPDATE channels SET category_id = (
  SELECT id FROM channel_categories 
  WHERE server_id = channels.server_id AND name = 'Mobile Dev'
) WHERE server_id = '22222222-2222-2222-2222-222222222222' AND name = 'mobile';

UPDATE channels SET category_id = (
  SELECT id FROM channel_categories 
  WHERE server_id = channels.server_id AND name = 'Gaming General'
) WHERE server_id = '33333333-3333-3333-3333-333333333333' AND name = 'general';

UPDATE channels SET category_id = (
  SELECT id FROM channel_categories 
  WHERE server_id = channels.server_id AND name = 'Platform Specific'
) WHERE server_id = '33333333-3333-3333-3333-333333333333' AND name IN ('mobile-games', 'pc-gaming');

-- Add RLS policies for categories
ALTER TABLE channel_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON channel_categories FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON channel_categories FOR INSERT WITH CHECK (true);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_server ON channel_categories(server_id, sort_order);