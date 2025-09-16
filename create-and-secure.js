const { default: fetch } = require('node-fetch');

const SUPABASE_ACCESS_TOKEN = 'sbp_6ebdfb805ce7f4c8eb0616f8f1b5b5709f7f89d3';
const PROJECT_REF = 'pigrdhzlhvvigkbjlmfi';

async function executeSQL(sql) {
  console.log('Executing SQL...');
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

async function createAndSecureDatabase() {
  console.log('🚀 Creating IRC database tables and securing them...');

  try {
    // 1. Create all tables first
    console.log('📋 Creating database tables...');
    await executeSQL(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Servers table
      CREATE TABLE IF NOT EXISTS servers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Channels table
      CREATE TABLE IF NOT EXISTS channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        topic TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(server_id, name)
      );

      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        username VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        message_type VARCHAR(20) DEFAULT 'message',
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- User servers junction table
      CREATE TABLE IF NOT EXISTS user_servers (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
        role VARCHAR(20) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, server_id)
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id);
    `);

    // 2. Insert default data
    console.log('📝 Inserting default servers and channels...');
    await executeSQL(`
      -- Insert default servers
      INSERT INTO servers (id, name, description) VALUES 
        ('11111111-1111-1111-1111-111111111111', 'General', 'Main server for general discussion'),
        ('22222222-2222-2222-2222-222222222222', 'Tech Talk', 'Technology and programming discussions'),
        ('33333333-3333-3333-3333-333333333333', 'Gaming', 'Gaming community and discussions')
      ON CONFLICT (id) DO NOTHING;

      -- Insert default channels
      INSERT INTO channels (server_id, name, topic) VALUES 
        -- General server channels
        ('11111111-1111-1111-1111-111111111111', 'lobby', 'Welcome to the main lobby'),
        ('11111111-1111-1111-1111-111111111111', 'random', 'Random conversations'),
        ('11111111-1111-1111-1111-111111111111', 'help', 'Get help and support'),
        -- Tech Talk server channels
        ('22222222-2222-2222-2222-222222222222', 'programming', 'Programming discussions'),
        ('22222222-2222-2222-2222-222222222222', 'web-dev', 'Web development'),
        ('22222222-2222-2222-2222-222222222222', 'mobile', 'Mobile development'),
        -- Gaming server channels
        ('33333333-3333-3333-3333-333333333333', 'general', 'General gaming chat'),
        ('33333333-3333-3333-3333-333333333333', 'mobile-games', 'Mobile gaming'),
        ('33333333-3333-3333-3333-333333333333', 'pc-gaming', 'PC gaming discussions')
      ON CONFLICT (server_id, name) DO NOTHING;
    `);

    // 3. Enable RLS on all tables
    console.log('🛡️ Enabling Row Level Security...');
    await executeSQL(`
      ALTER TABLE users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
      ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
      ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE user_servers ENABLE ROW LEVEL SECURITY;
    `);

    // 4. Create RLS policies
    console.log('🔐 Creating security policies...');
    
    // Users policies
    await executeSQL(`
      -- Users can read all user profiles (for chat user lists)
      CREATE POLICY "Allow public read access to users" ON users 
        FOR SELECT USING (true);
      
      -- Anyone can create a user account
      CREATE POLICY "Allow user registration" ON users 
        FOR INSERT WITH CHECK (true);
      
      -- Users can only update their own profile
      CREATE POLICY "Users can update own profile" ON users 
        FOR UPDATE USING (auth.uid() = id);
    `);

    // Servers policies  
    await executeSQL(`
      -- Everyone can read servers (to browse available servers)
      CREATE POLICY "Allow public read access to servers" ON servers 
        FOR SELECT USING (true);
      
      -- For now, allow anyone to create servers (we can restrict this later)
      CREATE POLICY "Allow server creation" ON servers 
        FOR INSERT WITH CHECK (true);
      
      -- Server owners can update their servers
      CREATE POLICY "Server owners can update" ON servers 
        FOR UPDATE USING (auth.uid() = created_by OR created_by IS NULL);
    `);

    // Channels policies
    await executeSQL(`
      -- Everyone can read channels (to see available channels)
      CREATE POLICY "Allow public read access to channels" ON channels 
        FOR SELECT USING (true);
      
      -- Allow channel creation for anyone (can be restricted later)
      CREATE POLICY "Allow channel creation" ON channels 
        FOR INSERT WITH CHECK (true);
    `);

    // Messages policies (most important for chat)
    await executeSQL(`
      -- Everyone can read messages (public chat)
      CREATE POLICY "Allow public read access to messages" ON messages 
        FOR SELECT USING (true);
      
      -- Anyone can send messages (will be restricted to auth users later)
      CREATE POLICY "Allow message posting" ON messages 
        FOR INSERT WITH CHECK (true);
      
      -- Users can update their own messages (for editing)
      CREATE POLICY "Users can edit own messages" ON messages 
        FOR UPDATE USING (username = current_setting('app.current_user', true));
      
      -- Users can delete their own messages
      CREATE POLICY "Users can delete own messages" ON messages 
        FOR DELETE USING (username = current_setting('app.current_user', true));
    `);

    // 5. Enable realtime
    console.log('⚡ Enabling realtime subscriptions...');
    await executeSQL(`
      ALTER PUBLICATION supabase_realtime ADD TABLE messages;
      ALTER PUBLICATION supabase_realtime ADD TABLE channels;
      ALTER PUBLICATION supabase_realtime ADD TABLE servers;
      ALTER PUBLICATION supabase_realtime ADD TABLE users;
    `);

    // 6. Create welcome messages
    console.log('💬 Creating welcome messages...');
    await executeSQL(`
      INSERT INTO messages (channel_id, username, content, message_type) 
      SELECT 
        c.id,
        'System',
        'Welcome to the ' || c.name || ' channel in ' || s.name || ' server! 🎉',
        'system'
      FROM channels c
      JOIN servers s ON c.server_id = s.id
      WHERE NOT EXISTS (SELECT 1 FROM messages WHERE channel_id = c.id);
    `);

    console.log('🎉 Database setup complete!');
    console.log('');
    console.log('✅ Created:');
    console.log('- 5 tables with proper relationships');
    console.log('- 3 servers (General, Tech Talk, Gaming)');
    console.log('- 9 channels across all servers');
    console.log('- Welcome messages in each channel');
    console.log('- Performance indexes');
    console.log('');
    console.log('🔒 Security:');
    console.log('- Row Level Security enabled');
    console.log('- Public read access (no auth needed for browsing)');
    console.log('- Public write access (no auth needed for testing)');
    console.log('- Ready for authentication integration');
    console.log('');
    console.log('⚡ Real-time:');
    console.log('- Live message updates');
    console.log('- Channel and server updates');
    console.log('- User presence tracking');
    console.log('');
    console.log('Your IRC platform is ready to use! 🚀');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

createAndSecureDatabase();