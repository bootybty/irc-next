const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MANAGEMENT_TOKEN = 'sbp_d95a6f741a6498cb0e21abac5e8d5b8035c5e6fa';
const PROJECT_REF = 'pigrdhzlhvvigkbjlmfi';

async function runSiteOwnerMigration() {
  try {
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'add-site-owner-column.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    
    console.log('Adding Site Owner column and updating functions...\n');
    
    // Execute the migration
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Migration failed: ${error}`);
    }

    console.log('✅ Site Owner column added successfully!');
    console.log('\n📝 Next step: Make yourself Site Owner with:');
    console.log('node scripts/make-site-owner.js <username>');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runSiteOwnerMigration();