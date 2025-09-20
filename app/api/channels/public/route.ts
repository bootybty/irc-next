import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for fetching public channel data
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const UNIVERSAL_CHANNELS = ['global', 'general', 'random', 'tech', 'gaming', 'music', 'news', 'help', 'projects', 'feedback'];

export async function GET() {
  try {
    // Fetch all public data using service role
    const [categoriesResult, uncategorizedResult, universalChannelsResult] = await Promise.all([
      // Categories with channels
      supabaseAdmin
        .from('channel_categories')
        .select(`
          id,
          name,
          emoji,
          color,
          sort_order,
          channels (
            id,
            name,
            topic,
            category_id
          )
        `)
        .order('sort_order'),
      
      // Uncategorized channels (exclude admin and universal channels)
      supabaseAdmin
        .from('channels')
        .select('id, name, topic, category_id')
        .is('category_id', null)
        .not('name', 'in', `(${UNIVERSAL_CHANNELS.map(ch => `"${ch}"`).join(',')})`)
        .not('name', 'eq', 'admin'),
      
      // Universal channels
      supabaseAdmin
        .from('channels')
        .select('id, name, topic, category_id')
        .in('name', UNIVERSAL_CHANNELS)
    ]);

    // Check for errors
    if (categoriesResult.error) {
      throw new Error(`Categories error: ${categoriesResult.error.message}`);
    }
    if (uncategorizedResult.error) {
      throw new Error(`Uncategorized channels error: ${uncategorizedResult.error.message}`);
    }
    if (universalChannelsResult.error) {
      throw new Error(`Universal channels error: ${universalChannelsResult.error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        categories: categoriesResult.data || [],
        uncategorizedChannels: uncategorizedResult.data || [],
        universalChannels: universalChannelsResult.data || []
      }
    });

  } catch (error) {
    console.error('Public channels fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}