// Simple test to verify admin privileges work
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const MANAGEMENT_TOKEN = 'sbp_d95a6f741a6498cb0e21abac5e8d5b8035c5e6fa';
const PROJECT_REF = 'pigrdhzlhvvigkbjlmfi';

async function testAdminStatus() {
  try {
    // Check booty's admin status
    const query = `
      SELECT username, is_super_admin, is_site_admin, is_site_moderator 
      FROM users 
      WHERE username = 'booty';
    `;

    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to check user: ${error}`);
    }

    const users = await response.json();
    
    if (users.length === 0) {
      console.error('❌ User booty not found');
      return;
    }

    const user = users[0];
    console.log('\n📋 Admin Status Check:');
    console.log(`Username: ${user.username}`);
    console.log(`Site Owner: ${user.is_super_admin ? '✅' : '❌'}`);
    console.log(`Site Admin: ${user.is_site_admin ? '✅' : '❌'}`);
    console.log(`Site Moderator: ${user.is_site_moderator ? '✅' : '❌'}`);

    // Check admin channel membership
    const channelQuery = `
      SELECT cm.username, cm.role, c.name as channel_name
      FROM channel_members cm
      JOIN channels c ON c.id = cm.channel_id
      WHERE c.name = 'admin' AND cm.username = 'booty';
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
      const membership = await channelResponse.json();
      if (membership.length > 0) {
        console.log(`\n✅ Member of #admin channel with role: ${membership[0].role}`);
      } else {
        console.log('\n❌ Not a member of #admin channel');
      }
    }

    console.log('\n🧪 Expected autocompletion behavior:');
    console.log('1. Go to #admin channel in IRC client');
    console.log('2. Type "/" - should show admin commands');
    console.log('3. Type "/site" - should show siteban, siteunban, siteadmin, sitemoderator');
    console.log('4. Type "/siteban " - should show all users with their roles');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAdminStatus();