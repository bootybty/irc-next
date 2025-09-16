const { default: fetch } = require('node-fetch');

const SUPABASE_ACCESS_TOKEN = 'sbp_6ebdfb805ce7f4c8eb0616f8f1b5b5709f7f89d3';
const PROJECT_REF = 'pigrdhzlhvvigkbjlmfi';

async function executeSQL(sql) {
  console.log('Executing SQL:', sql.substring(0, 100) + '...');
  
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  const result = await response.json();
  
  if (!response.ok) {
    console.error('SQL Error:', result);
    throw new Error(`SQL execution failed: ${result.message}`);
  }
  
  console.log('✅ SQL executed successfully');
  return result;
}

async function setupChannelRoles() {
  console.log('🔨 Setting up channel roles and moderation system...');

  try {
    // 1. Create channel_members table
    await executeSQL(`
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
    `);

    // 2. Create channel_bans table
    await executeSQL(`
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
    `);

    // 3. Add indexes
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);
      CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_channel_bans_channel ON channel_bans(channel_id);
      CREATE INDEX IF NOT EXISTS idx_channel_bans_user ON channel_bans(user_id);
    `);

    // 4. Enable RLS
    await executeSQL(`
      ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
      ALTER TABLE channel_bans ENABLE ROW LEVEL SECURITY;
    `);

    // 5. RLS Policies for channel_members
    await executeSQL(`
      CREATE POLICY "Allow public read access to channel members" ON channel_members 
        FOR SELECT USING (true);
    `);

    await executeSQL(`
      CREATE POLICY "Channel owners can manage all members" ON channel_members 
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM channels 
            WHERE channels.id = channel_members.channel_id 
            AND channels.created_by = auth.uid()
          )
        );
    `);

    await executeSQL(`
      CREATE POLICY "Users can join channels" ON channel_members 
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    `);

    await executeSQL(`
      CREATE POLICY "Users can leave channels" ON channel_members 
        FOR DELETE USING (auth.uid() = user_id);
    `);

    // 6. RLS Policies for channel_bans
    await executeSQL(`
      CREATE POLICY "Allow public read access to channel bans" ON channel_bans 
        FOR SELECT USING (true);
    `);

    await executeSQL(`
      CREATE POLICY "Channel owners and mods can manage bans" ON channel_bans 
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM channels c
            LEFT JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = auth.uid()
            WHERE c.id = channel_bans.channel_id 
            AND (c.created_by = auth.uid() OR cm.role IN ('moderator', 'admin'))
          )
        );
    `);

    // 7. Auto-add channel owner function
    await executeSQL(`
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
    `);

    // 8. Create trigger
    await executeSQL(`
      CREATE TRIGGER trigger_add_channel_owner
        AFTER INSERT ON channels
        FOR EACH ROW
        EXECUTE FUNCTION add_channel_owner();
    `);

    // 9. Utility function
    await executeSQL(`
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
    `);

    console.log('🎉 Channel roles system setup complete!');

    // Verify setup
    const verifyResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        query: `
          SELECT COUNT(*) as member_count FROM channel_members;
        ` 
      })
    });

    const verifyResult = await verifyResponse.json();
    
    if (verifyResponse.ok && verifyResult.result) {
      console.log(`📊 Channel members in system: ${verifyResult.result[0]?.member_count || 0}`);
    }

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupChannelRoles();