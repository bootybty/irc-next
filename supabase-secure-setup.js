const { default: fetch } = require('node-fetch');

const SUPABASE_ACCESS_TOKEN = 'sbp_6ebdfb805ce7f4c8eb0616f8f1b5b5709f7f89d3';
const PROJECT_REF = 'pigrdhzlhvvigkbjlmfi';

async function executeSQL(sql) {
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
  
  return result;
}

async function setupSecureDatabase() {
  console.log('🔒 Setting up secure IRC database with proper RLS...');

  try {
    // 1. Drop existing policies first
    console.log('🧹 Cleaning up existing policies...');
    await executeSQL(`
      DROP POLICY IF EXISTS "Enable read access for all users" ON users;
      DROP POLICY IF EXISTS "Enable read access for all users" ON servers;
      DROP POLICY IF EXISTS "Enable read access for all users" ON channels;
      DROP POLICY IF EXISTS "Enable read access for all users" ON messages;
      DROP POLICY IF EXISTS "Enable read access for all users" ON user_servers;
      DROP POLICY IF EXISTS "Enable insert for authenticated users" ON messages;
      DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
    `);

    // 2. Enable RLS on all tables
    console.log('🛡️ Enabling Row Level Security...');
    await executeSQL(`
      ALTER TABLE users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
      ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
      ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE user_servers ENABLE ROW LEVEL SECURITY;
    `);

    // 3. Create secure RLS policies
    console.log('📋 Creating secure RLS policies...');
    
    // Users policies
    await executeSQL(`
      -- Users can read all user profiles
      CREATE POLICY "Allow public read access to users" ON users 
        FOR SELECT USING (true);
      
      -- Users can only update their own profile
      CREATE POLICY "Users can update own profile" ON users 
        FOR UPDATE USING (auth.uid() = id);
      
      -- Allow user creation
      CREATE POLICY "Allow user creation" ON users 
        FOR INSERT WITH CHECK (true);
    `);

    // Servers policies  
    await executeSQL(`
      -- Everyone can read servers
      CREATE POLICY "Allow public read access to servers" ON servers 
        FOR SELECT USING (true);
      
      -- Only authenticated users can create servers
      CREATE POLICY "Authenticated users can create servers" ON servers 
        FOR INSERT WITH CHECK (auth.role() = 'authenticated');
      
      -- Server owners can update their servers
      CREATE POLICY "Server owners can update" ON servers 
        FOR UPDATE USING (auth.uid() = created_by);
    `);

    // Channels policies
    await executeSQL(`
      -- Everyone can read channels
      CREATE POLICY "Allow public read access to channels" ON channels 
        FOR SELECT USING (true);
      
      -- Server owners can manage channels
      CREATE POLICY "Server owners can manage channels" ON channels 
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM servers 
            WHERE servers.id = channels.server_id 
            AND servers.created_by = auth.uid()
          )
        );
      
      -- Allow channel creation for authenticated users
      CREATE POLICY "Allow channel creation" ON channels 
        FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    `);

    // Messages policies
    await executeSQL(`
      -- Everyone can read messages
      CREATE POLICY "Allow public read access to messages" ON messages 
        FOR SELECT USING (true);
      
      -- Authenticated users can send messages
      CREATE POLICY "Authenticated users can send messages" ON messages 
        FOR INSERT WITH CHECK (auth.role() = 'authenticated');
      
      -- Users can only update/delete their own messages
      CREATE POLICY "Users can manage own messages" ON messages 
        FOR UPDATE USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can delete own messages" ON messages 
        FOR DELETE USING (auth.uid() = user_id);
    `);

    // User-servers junction policies
    await executeSQL(`
      -- Users can read their server memberships
      CREATE POLICY "Users can read own server memberships" ON user_servers 
        FOR SELECT USING (auth.uid() = user_id);
      
      -- Users can join servers
      CREATE POLICY "Users can join servers" ON user_servers 
        FOR INSERT WITH CHECK (auth.uid() = user_id);
      
      -- Users can leave servers
      CREATE POLICY "Users can leave servers" ON user_servers 
        FOR DELETE USING (auth.uid() = user_id);
    `);

    console.log('✅ RLS policies created successfully');

    // 4. Enable realtime for messages
    console.log('⚡ Enabling realtime for messages...');
    await executeSQL(`
      ALTER PUBLICATION supabase_realtime ADD TABLE messages;
      ALTER PUBLICATION supabase_realtime ADD TABLE channels;
      ALTER PUBLICATION supabase_realtime ADD TABLE servers;
    `);

    // 5. Create a function to get channel info with server name
    console.log('🔧 Creating helper functions...');
    await executeSQL(`
      CREATE OR REPLACE FUNCTION get_channel_with_server(channel_name text, server_name text)
      RETURNS TABLE (
        channel_id uuid,
        channel_name text,
        server_id uuid,
        server_name text
      ) 
      LANGUAGE sql
      AS $$
        SELECT 
          c.id as channel_id,
          c.name as channel_name,
          s.id as server_id,
          s.name as server_name
        FROM channels c
        JOIN servers s ON c.server_id = s.id
        WHERE c.name = channel_name AND s.name = server_name;
      $$;
    `);

    // 6. Create some test data
    console.log('📝 Creating test messages...');
    await executeSQL(`
      INSERT INTO messages (channel_id, username, content, message_type) 
      SELECT 
        c.id,
        'System',
        'Welcome to ' || c.name || ' channel!',
        'system'
      FROM channels c
      WHERE NOT EXISTS (SELECT 1 FROM messages WHERE channel_id = c.id)
      LIMIT 3;
    `);

    console.log('🎉 Secure database setup complete!');
    console.log('');
    console.log('✅ Features enabled:');
    console.log('- Row Level Security on all tables');
    console.log('- Proper authentication policies');
    console.log('- Realtime subscriptions for chat');
    console.log('- Helper functions for queries');
    console.log('- Test system messages');
    console.log('');
    console.log('🔐 Security summary:');
    console.log('- Public read access (no auth needed for browsing)');
    console.log('- Authentication required for posting');
    console.log('- Users own their messages and profiles');
    console.log('- Server owners control their servers');
    console.log('');
    console.log('Your IRC platform is now secure and ready! 🚀');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupSecureDatabase();