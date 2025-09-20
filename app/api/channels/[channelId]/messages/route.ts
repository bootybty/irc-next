import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for fetching messages
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
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before');

    if (!channelId) {
      return NextResponse.json({
        success: false,
        error: 'Channel ID is required'
      }, { status: 400 });
    }

    // Build query with actual columns that exist in database
    let query = supabaseAdmin
      .from('messages')
      .select(`
        id,
        channel_id,
        user_id,
        username,
        content,
        message_type,
        created_at
      `)
      .eq('channel_id', channelId);

    // Add timestamp filter if provided
    if (before) {
      query = query.lt('created_at', before);
    }

    // Fetch messages using service role
    const { data: messages, error: messagesError } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (messagesError) {
      console.error('Messages fetch error:', messagesError);
      return NextResponse.json({
        success: false,
        error: messagesError.message
      }, { status: 500 });
    }

    // Reverse to get chronological order (oldest first)
    const reversedMessages = (messages || []).reverse();

    return NextResponse.json({
      success: true,
      data: reversedMessages
    });

  } catch (error) {
    console.error('Messages API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}