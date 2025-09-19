const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const MANAGEMENT_TOKEN = 'sbp_d95a6f741a6498cb0e21abac5e8d5b8035c5e6fa';
const PROJECT_REF = 'pigrdhzlhvvigkbjlmfi';

const username = process.argv[2];

if (!username) {
  console.error('Usage: node make-super-admin.js <username>');
  process.exit(1);
}

async function makeSuperAdmin() {
  try {
    // First check if user exists
    const checkUserQuery = `
      SELECT id, username, is_site_admin, is_site_moderator 
      FROM users 
      WHERE username = '${username}';
    `;

    const checkResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: checkUserQuery })
    });

    if (!checkResponse.ok) {
      const error = await checkResponse.text();
      throw new Error(`Failed to check user: ${error}`);
    }

    const users = await checkResponse.json();
    
    if (users.length === 0) {
      console.error(`❌ User '${username}' not found`);
      process.exit(1);
    }

    const user = users[0];
    console.log(`\n📋 Current status for ${username}:`);
    console.log(`  - Site Admin: ${user.is_site_admin ? '✅' : '❌'}`);
    console.log(`  - Site Moderator: ${user.is_site_moderator ? '✅' : '❌'}`);

    if (user.is_site_admin) {
      console.log(`\n✅ ${username} is already a site admin`);
      return;
    }

    // Make the user a site admin (highest privilege)
    const updateQuery = `
      UPDATE users 
      SET 
        is_site_admin = true,
        is_site_moderator = true
      WHERE username = '${username}'
      RETURNING id, username, is_site_admin, is_site_moderator;
    `;

    const updateResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: updateQuery })
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update user: ${error}`);
    }

    await updateResponse.json();
    
    console.log(`\n🎉 Success! ${username} is now a site admin`);
    console.log(`\n📋 Updated status:`);
    console.log(`  - Site Admin: ✅`);
    console.log(`  - Site Moderator: ✅`);

    // Also add user to admin channel if not already a member
    const channelQuery = `
      DO $$
      DECLARE
        v_user_id UUID;
        v_channel_id UUID;
      BEGIN
        -- Get user and channel IDs
        SELECT id INTO v_user_id FROM users WHERE username = '${username}';
        SELECT id INTO v_channel_id FROM channels WHERE name = 'admin';
        
        IF v_channel_id IS NOT NULL AND v_user_id IS NOT NULL THEN
          -- Add user to admin channel if not already member
          INSERT INTO channel_members (id, channel_id, user_id, username, role, joined_at)
          VALUES (gen_random_uuid(), v_channel_id, v_user_id, '${username}', 'owner', NOW())
          ON CONFLICT DO NOTHING;
        END IF;
      END $$;
    `;

    const channelResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: channelQuery })
    });

    if (channelResponse.ok) {
      console.log(`\n✅ ${username} has been added to #admin channel as owner`);
    }

    console.log('\n📝 Next steps:');
    console.log('1. Have the user log in to the IRC client');
    console.log('2. Navigate to the #admin channel');
    console.log('3. Try admin commands like /stats, /lookup, /siteban');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

makeSuperAdmin();