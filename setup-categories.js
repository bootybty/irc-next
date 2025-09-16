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

async function setupCategories() {
  console.log('🏗️ Setting up channel categories...');

  try {
    // 1. Create channel_categories table
    await executeSQL(`
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
    `);

    // 2. Add columns to channels table
    await executeSQL(`
      ALTER TABLE channels 
      ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES channel_categories(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
    `);

    // 3. Create default categories
    await executeSQL(`
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
    `);

    // 4. Update existing channels with categories
    console.log('📝 Assigning channels to categories...');
    
    // General server channels
    await executeSQL(`
      UPDATE channels SET category_id = (
        SELECT id FROM channel_categories 
        WHERE server_id = '11111111-1111-1111-1111-111111111111' AND name = 'General'
      ) WHERE server_id = '11111111-1111-1111-1111-111111111111' AND name IN ('lobby', 'random');
    `);

    await executeSQL(`
      UPDATE channels SET category_id = (
        SELECT id FROM channel_categories 
        WHERE server_id = '11111111-1111-1111-1111-111111111111' AND name = 'Help & Support'
      ) WHERE server_id = '11111111-1111-1111-1111-111111111111' AND name = 'help';
    `);

    // Tech Talk server channels
    await executeSQL(`
      UPDATE channels SET category_id = (
        SELECT id FROM channel_categories 
        WHERE server_id = '22222222-2222-2222-2222-222222222222' AND name = 'Development'
      ) WHERE server_id = '22222222-2222-2222-2222-222222222222' AND name = 'programming';
    `);

    await executeSQL(`
      UPDATE channels SET category_id = (
        SELECT id FROM channel_categories 
        WHERE server_id = '22222222-2222-2222-2222-222222222222' AND name = 'Web Technologies'
      ) WHERE server_id = '22222222-2222-2222-2222-222222222222' AND name = 'web-dev';
    `);

    await executeSQL(`
      UPDATE channels SET category_id = (
        SELECT id FROM channel_categories 
        WHERE server_id = '22222222-2222-2222-2222-222222222222' AND name = 'Mobile Dev'
      ) WHERE server_id = '22222222-2222-2222-2222-222222222222' AND name = 'mobile';
    `);

    // Gaming server channels
    await executeSQL(`
      UPDATE channels SET category_id = (
        SELECT id FROM channel_categories 
        WHERE server_id = '33333333-3333-3333-3333-333333333333' AND name = 'Gaming General'
      ) WHERE server_id = '33333333-3333-3333-3333-333333333333' AND name = 'general';
    `);

    await executeSQL(`
      UPDATE channels SET category_id = (
        SELECT id FROM channel_categories 
        WHERE server_id = '33333333-3333-3333-3333-333333333333' AND name = 'Platform Specific'
      ) WHERE server_id = '33333333-3333-3333-3333-333333333333' AND name IN ('mobile-games', 'pc-gaming');
    `);

    // 5. Enable RLS and create policies
    await executeSQL(`
      ALTER TABLE channel_categories ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Enable read access for all users" ON channel_categories FOR SELECT USING (true);
      CREATE POLICY "Enable insert for authenticated users" ON channel_categories FOR INSERT WITH CHECK (true);
    `);

    // 6. Create indexes
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category_id);
      CREATE INDEX IF NOT EXISTS idx_categories_server ON channel_categories(server_id, sort_order);
    `);

    console.log('🎉 Categories setup complete!');
    
    // Verify setup
    const verifyResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        query: `
          SELECT 
            cc.name as category_name, 
            cc.emoji,
            s.name as server_name,
            COUNT(c.id) as channel_count
          FROM channel_categories cc
          JOIN servers s ON cc.server_id = s.id
          LEFT JOIN channels c ON c.category_id = cc.id
          GROUP BY cc.id, cc.name, cc.emoji, s.name, cc.sort_order
          ORDER BY s.name, cc.sort_order;
        ` 
      })
    });

    const verifyResult = await verifyResponse.json();
    
    if (verifyResponse.ok && verifyResult.result) {
      console.log('\n📊 Categories created:');
      verifyResult.result.forEach(row => {
        console.log(`  ${row.emoji} ${row.category_name} (${row.server_name}) - ${row.channel_count} channels`);
      });
    }

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupCategories();