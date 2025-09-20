import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for fetching user subscriptions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 });
    }

    // Fetch user subscriptions using service role
    const { data: subscriptions, error } = await supabaseAdmin
      .from('channel_members')
      .select('channel_id, is_subscribed')
      .eq('user_id', userId);

    if (error) {
      console.error('Subscriptions fetch error:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: subscriptions || []
    });

  } catch (error) {
    console.error('User subscriptions API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}