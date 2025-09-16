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

async function setupCustomRoles() {
  console.log('🎭 Setting up custom role system...');

  try {
    // 1. Create channel_roles table
    await executeSQL(`
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
    `);

    // 2. Add role_id to channel_members
    await executeSQL(`
      ALTER TABLE channel_members ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES channel_roles(id) ON DELETE SET NULL;
    `);

    // 3. Create default Owner roles
    await executeSQL(`
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
    `);

    // 4. Create default Moderator roles
    await executeSQL(`
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
    `);

    // 5. Create VIP roles
    await executeSQL(`
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
    `);

    // 6. Create Member roles
    await executeSQL(`
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
    `);

    // 7. Update existing members to use new role system
    await executeSQL(`
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
    `);

    // 8. Create function for new channel default roles
    await executeSQL(`
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
        );

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
    `);

    // 9. Create trigger
    await executeSQL(`
      CREATE TRIGGER trigger_create_default_roles
        AFTER INSERT ON channels
        FOR EACH ROW
        EXECUTE FUNCTION create_default_channel_roles();
    `);

    // 10. Add indexes and RLS
    await executeSQL(`
      CREATE INDEX IF NOT EXISTS idx_channel_roles_channel ON channel_roles(channel_id);
      CREATE INDEX IF NOT EXISTS idx_channel_members_role ON channel_members(role_id);
      
      ALTER TABLE channel_roles ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Allow public read access to channel roles" ON channel_roles 
        FOR SELECT USING (true);
    `);

    console.log('🎉 Custom role system setup complete!');

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
            cr.name as role_name,
            cr.color,
            c.name as channel_name,
            COUNT(cm.id) as member_count
          FROM channel_roles cr
          JOIN channels c ON cr.channel_id = c.id
          LEFT JOIN channel_members cm ON cm.role_id = cr.id
          GROUP BY cr.id, cr.name, cr.color, c.name, cr.sort_order
          ORDER BY c.name, cr.sort_order DESC;
        ` 
      })
    });

    const verifyResult = await verifyResponse.json();
    
    if (verifyResponse.ok && verifyResult.result) {
      console.log('\n📊 Roles created:');
      verifyResult.result.forEach(row => {
        console.log(`  ${row.role_name} (${row.channel_name}) - ${row.member_count} members - ${row.color}`);
      });
    }

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupCustomRoles();