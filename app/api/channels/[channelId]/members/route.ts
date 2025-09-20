import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for fetching channel members
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;

    if (!channelId) {
      return NextResponse.json({
        success: false,
        error: 'Channel ID is required'
      }, { status: 400 });
    }

    // Fetch channel roles and members using service role
    const [rolesResult, membersResult] = await Promise.all([
      supabaseAdmin
        .from('channel_roles')
        .select('*')
        .eq('channel_id', channelId)
        .order('sort_order', { ascending: false }),
      
      supabaseAdmin
        .from('channel_members')
        .select('*')
        .eq('channel_id', channelId)
        .eq('is_subscribed', true)
    ]);

    if (rolesResult.error) {
      console.error('Roles fetch error:', rolesResult.error);
      return NextResponse.json({
        success: false,
        error: rolesResult.error.message
      }, { status: 500 });
    }

    if (membersResult.error) {
      console.error('Members fetch error:', membersResult.error);
      return NextResponse.json({
        success: false,
        error: membersResult.error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        roles: rolesResult.data || [],
        members: membersResult.data || []
      }
    });

  } catch (error) {
    console.error('Channel members API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}