// Script to clear old MOTD mock data
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pigrdhzlhvvigkbjlmfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZ3JkaHpsaHZ2aWdrYmpsbWZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDg5NjA3MSwiZXhwIjoyMDUwNDcyMDcxfQ.f6aCYVpXTZWPr4D2J8l1vJAOQQIIaJBb5a_YYpWWUPI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearOldMotd() {
  console.log('Clearing old MOTD mock data...');
  
  try {
    const { data, error } = await supabase
      .from('channels')
      .update({ motd: null })
      .eq('motd', 'WELCOME TO IRC GLOBAL CHAT');
    
    if (error) {
      console.error('Error clearing MOTD:', error);
      process.exit(1);
    }
    
    console.log('✅ Successfully cleared old MOTD data');
    console.log('Result:', data);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

clearOldMotd();