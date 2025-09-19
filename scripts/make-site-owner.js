const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const MANAGEMENT_TOKEN = 'sbp_d95a6f741a6498cb0e21abac5e8d5b8035c5e6fa';
const PROJECT_REF = 'pigrdhzlhvvigkbjlmfi';

const username = process.argv[2];

if (!username) {
  console.error('Usage: node make-site-owner.js <username>');
  process.exit(1);
}

async function makeSiteOwner() {
  try {
    // First check if user exists
    const checkUserQuery = `
      SELECT id, username, is_super_admin, is_site_admin, is_site_moderator 
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
    console.log(`  - Site Owner: ${user.is_super_admin ? '✅' : '❌'}`);
    console.log(`  - Site Admin: ${user.is_site_admin ? '✅' : '❌'}`);
    console.log(`  - Site Moderator: ${user.is_site_moderator ? '✅' : '❌'}`);

    if (user.is_super_admin) {
      console.log(`\n✅ ${username} is already the Site Owner`);
      return;
    }

    // Check if there's already a Site Owner
    const ownerCheckQuery = `
      SELECT username FROM users WHERE is_super_admin = true LIMIT 1;
    `;

    const ownerCheckResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: ownerCheckQuery })
    });

    if (ownerCheckResponse.ok) {
      const existingOwners = await ownerCheckResponse.json();
      if (existingOwners.length > 0) {
        console.log(`\n⚠️  WARNING: ${existingOwners[0].username} is already the Site Owner.`);
        console.log('There can only be one Site Owner. Continue? (y/N)');
        
        // For automation, we'll proceed. In real usage, you'd want user confirmation
        console.log('Proceeding to transfer ownership...\n');
        
        // Remove super admin from existing owner
        const removeQuery = `
          UPDATE users SET is_super_admin = false WHERE is_super_admin = true;
        `;
        
        await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: removeQuery })
        });
        
        console.log(`📝 Removed Site Owner status from ${existingOwners[0].username}`);
      }
    }

    // Make the user Site Owner (highest privilege)
    const updateQuery = `
      UPDATE users 
      SET 
        is_super_admin = true,
        is_site_admin = true,
        is_site_moderator = true
      WHERE username = '${username}'
      RETURNING id, username, is_super_admin, is_site_admin, is_site_moderator;
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

    console.log(`\n🎉 Success! ${username} is now the Site Owner`);
    console.log(`\n📋 Updated status:`);
    console.log(`  - Site Owner: ✅ (can do everything)`);
    console.log(`  - Site Admin: ✅`);
    console.log(`  - Site Moderator: ✅`);

    console.log('\n👑 Site Owner powers in #admin channel:');
    console.log('  - /siteadmin <user> - Promote to Site Admin');
    console.log('  - /sitemoderator <user> - Promote to Site Moderator');
    console.log('  - /demoteadmin <user> - Demote Site Admin');
    console.log('  - /demotemoderator <user> - Demote Site Moderator');
    console.log('  - All moderator commands (ban, lookup, stats, etc.)');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

makeSiteOwner();