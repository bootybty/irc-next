const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const MANAGEMENT_TOKEN = 'sbp_d95a6f741a6498cb0e21abac5e8d5b8035c5e6fa';
const PROJECT_REF = 'pigrdhzlhvvigkbjlmfi';

async function listUsers() {
  try {
    const query = `
      SELECT username, created_at, is_site_admin, is_site_moderator 
      FROM users 
      ORDER BY created_at DESC
      LIMIT 20;
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
      throw new Error(`Failed to fetch users: ${error}`);
    }

    const users = await response.json();
    
    console.log('\n📋 Users in the system:\n');
    console.log('Username                 | Created            | Admin | Moderator');
    console.log('-'.repeat(70));
    
    users.forEach(user => {
      const username = user.username.padEnd(23);
      const created = new Date(user.created_at).toLocaleDateString().padEnd(18);
      const admin = user.is_site_admin ? '✅' : '❌';
      const mod = user.is_site_moderator ? '✅' : '❌';
      console.log(`${username} | ${created} | ${admin}     | ${mod}`);
    });
    
    console.log(`\nTotal users shown: ${users.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listUsers();