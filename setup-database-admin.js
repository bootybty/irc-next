const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pigrdhzlhvvigkbjlmfi.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZ3JkaHpsaHZ2aWdrYmpsbWZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3Njc5NiwiZXhwIjoyMDczNTUyNzk2fQ.anCD0HXfXtE5QilmLvVeN9U7AmnYesvI-Y5p95RLBZ8';

const supabase = createClient(supabaseUrl, serviceKey);

async function setupDatabase() {
  console.log('🚀 Setting up IRC database schema with admin access...');

  try {
    // Create users table
    console.log('Creating users table...');
    const { error: usersError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (usersError) {
      console.error('❌ Error creating users table:', usersError);
      return;
    }

    // Create servers table
    console.log('Creating servers table...');
    const { error: serversError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS servers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL,
          description TEXT,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (serversError) {
      console.error('❌ Error creating servers table:', serversError);
      return;
    }

    // Create channels table
    console.log('Creating channels table...');
    const { error: channelsError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS channels (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
          name VARCHAR(50) NOT NULL,
          topic TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(server_id, name)
        );
      `
    });

    if (channelsError) {
      console.error('❌ Error creating channels table:', channelsError);
      return;
    }

    // Create messages table
    console.log('Creating messages table...');
    const { error: messagesError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id),
          username VARCHAR(50) NOT NULL,
          content TEXT NOT NULL,
          message_type VARCHAR(20) DEFAULT 'message',
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (messagesError) {
      console.error('❌ Error creating messages table:', messagesError);
      return;
    }

    // Create indexes
    console.log('Creating indexes...');
    const { error: indexError } = await supabase.rpc('exec', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
        CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id);
      `
    });

    if (indexError) {
      console.error('❌ Error creating indexes:', indexError);
      return;
    }

    console.log('✅ All tables and indexes created successfully');

    // Insert default servers
    console.log('Inserting default servers...');
    const { error: serverInsertError } = await supabase
      .from('servers')
      .upsert([
        { id: '11111111-1111-1111-1111-111111111111', name: 'General', description: 'Main server for general discussion' },
        { id: '22222222-2222-2222-2222-222222222222', name: 'Tech Talk', description: 'Technology and programming discussions' },
        { id: '33333333-3333-3333-3333-333333333333', name: 'Gaming', description: 'Gaming community and discussions' }
      ], { onConflict: 'id' });

    if (serverInsertError) {
      console.error('❌ Error inserting servers:', serverInsertError);
      return;
    }

    // Insert default channels
    console.log('Inserting default channels...');
    const { error: channelInsertError } = await supabase
      .from('channels')
      .upsert([
        // General server channels
        { server_id: '11111111-1111-1111-1111-111111111111', name: 'lobby', topic: 'Welcome to the main lobby' },
        { server_id: '11111111-1111-1111-1111-111111111111', name: 'random', topic: 'Random conversations' },
        { server_id: '11111111-1111-1111-1111-111111111111', name: 'help', topic: 'Get help and support' },
        // Tech Talk server channels
        { server_id: '22222222-2222-2222-2222-222222222222', name: 'programming', topic: 'Programming discussions' },
        { server_id: '22222222-2222-2222-2222-222222222222', name: 'web-dev', topic: 'Web development' },
        { server_id: '22222222-2222-2222-2222-222222222222', name: 'mobile', topic: 'Mobile development' },
        // Gaming server channels
        { server_id: '33333333-3333-3333-3333-333333333333', name: 'general', topic: 'General gaming chat' },
        { server_id: '33333333-3333-3333-3333-333333333333', name: 'mobile-games', topic: 'Mobile gaming' },
        { server_id: '33333333-3333-3333-3333-333333333333', name: 'pc-gaming', topic: 'PC gaming discussions' }
      ], { onConflict: 'server_id,name' });

    if (channelInsertError) {
      console.error('❌ Error inserting channels:', channelInsertError);
      return;
    }

    console.log('✅ Default data inserted successfully');
    console.log('🎉 Database setup complete!');
    console.log('');
    console.log('Tables created:');
    console.log('- users');
    console.log('- servers (3 default servers)');
    console.log('- channels (9 default channels)');
    console.log('- messages');
    console.log('');
    console.log('Your IRC platform is ready to use! 🚀');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupDatabase();