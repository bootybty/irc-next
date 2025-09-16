const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pigrdhzlhvvigkbjlmfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZ3JkaHpsaHZ2aWdrYmpsbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzY3OTYsImV4cCI6MjA3MzU1Mjc5Nn0.hduIK4KgJ4KR0-8s9pF-2IxgmBF3ZzZGZbz58zX6r1U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('🚀 Setting up IRC database schema...');

  try {
    // Create tables
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (createError) {
      console.error('❌ Error creating tables:', createError);
      return;
    }

    console.log('✅ Tables created successfully');

    // Insert default data
    const { error: insertError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Insert default servers
        INSERT INTO servers (id, name, description) VALUES 
          ('11111111-1111-1111-1111-111111111111', 'General', 'Main server for general discussion'),
          ('22222222-2222-2222-2222-222222222222', 'Tech Talk', 'Technology and programming discussions'),
          ('33333333-3333-3333-3333-333333333333', 'Gaming', 'Gaming community and discussions')
        ON CONFLICT (id) DO NOTHING;

        -- Insert default channels
        INSERT INTO channels (server_id, name, topic) VALUES 
          ('11111111-1111-1111-1111-111111111111', 'lobby', 'Welcome to the main lobby'),
          ('11111111-1111-1111-1111-111111111111', 'random', 'Random conversations'),
          ('11111111-1111-1111-1111-111111111111', 'help', 'Get help and support'),
          ('22222222-2222-2222-2222-222222222222', 'programming', 'Programming discussions'),
          ('22222222-2222-2222-2222-222222222222', 'web-dev', 'Web development'),
          ('22222222-2222-2222-2222-222222222222', 'mobile', 'Mobile development'),
          ('33333333-3333-3333-3333-333333333333', 'general', 'General gaming chat'),
          ('33333333-3333-3333-3333-333333333333', 'mobile-games', 'Mobile gaming'),
          ('33333333-3333-3333-3333-333333333333', 'pc-gaming', 'PC gaming discussions')
        ON CONFLICT (server_id, name) DO NOTHING;
      `
    });

    if (insertError) {
      console.error('❌ Error inserting default data:', insertError);
      return;
    }

    console.log('✅ Default data inserted successfully');
    console.log('🎉 Database setup complete!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupDatabase();