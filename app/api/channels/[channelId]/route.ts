import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for fetching channel data
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

    // Fetch channel details using service role
    const { data: channel, error: channelError } = await supabaseAdmin
      .from('channels')
      .select('name, topic, motd')
      .eq('id', channelId)
      .single();

    if (channelError) {
      console.error('Channel fetch error:', channelError);
      return NextResponse.json({
        success: false,
        error: channelError.message
      }, { status: 500 });
    }

    if (!channel) {
      return NextResponse.json({
        success: false,
        error: 'Channel not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: channel
    });

  } catch (error) {
    console.error('Channel API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}