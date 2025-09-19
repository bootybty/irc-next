// Script to create 100 test users for testing user list
import { randomUUID } from 'crypto';

const globalChannelId = 'ebc700eb-2039-4b49-812e-f50d48c358b1';
// const supabaseUrl = 'https://pigrdhzlhvvigkbjlmfi.supabase.co';
const managementToken = 'sbp_d95a6f741a6498cb0e21abac5e8d5b8035c5e6fa';


async function createTestUsersViaManagementAPI() {
  const users = [];
  
  // Generate 100 unique users with IDs and usernames
  for (let i = 1; i <= 100; i++) {
    users.push({
      id: randomUUID(),
      username: `testuser${i.toString().padStart(3, '0')}`
    });
  }
  
  console.log('Creating users in profiles table...');
  
  // First create users in profiles table in batches of 10
  for (let batch = 0; batch < 10; batch++) {
    const batchUsers = users.slice(batch * 10, (batch + 1) * 10);
    
    const userInserts = batchUsers.map(user => 
      `('${user.id}', '${user.username}', '${user.username}@test.com', NOW(), NOW())`
    ).join(',');
    
    const userQuery = `INSERT INTO profiles (id, username, email, created_at, updated_at) VALUES ${userInserts};`;
    
    try {
      const response = await fetch('https://api.supabase.com/v1/projects/pigrdhzlhvvigkbjlmfi/database/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: userQuery })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`User batch ${batch + 1} failed:`, error);
        continue;
      } else {
        console.log(`✅ User batch ${batch + 1}/10 completed`);
      }
    } catch (error) {
      console.error(`User batch ${batch + 1} error:`, error);
      continue;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('Adding users to global channel...');
  
  // Then create channel memberships in batches of 10
  for (let batch = 0; batch < 10; batch++) {
    const batchUsers = users.slice(batch * 10, (batch + 1) * 10);
    
    const memberInserts = batchUsers.map(user => 
      `('${globalChannelId}', '${user.id}', '${user.username}', 'member', true, false, NOW())`
    ).join(',');
    
    const memberQuery = `INSERT INTO channel_members (channel_id, user_id, username, role, is_subscribed, is_active, last_activity) VALUES ${memberInserts};`;
    
    try {
      const response = await fetch('https://api.supabase.com/v1/projects/pigrdhzlhvvigkbjlmfi/database/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: memberQuery })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`Member batch ${batch + 1} failed:`, error);
      } else {
        console.log(`✅ Member batch ${batch + 1}/10 completed`);
      }
    } catch (error) {
      console.error(`Member batch ${batch + 1} error:`, error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('🎉 All 100 test users created and added to global channel!');
}

createTestUsersViaManagementAPI();