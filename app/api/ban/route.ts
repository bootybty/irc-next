import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: NextRequest) {
  try {
    const { channelId, targetUserId, bannedBy, reason, targetUsername, bannerUsername } = await request.json();

    // Insert ban record
    const { data: banData, error: banError } = await supabaseAdmin
      .from('channel_bans')
      .insert({
        channel_id: channelId,
        user_id: targetUserId,
        banned_by: bannedBy,
        reason: reason
      })
      .select();

    if (banError) {
      // console.error('Ban insert failed:', banError);
      return NextResponse.json({ error: banError.message }, { status: 400 });
    }

    // Note: Banned users remain in channel_members so they can still read messages
    // They just cannot send messages (enforced in frontend)

    // Send ban message to channel
    const { error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        content: `${targetUsername} was banned by ${bannerUsername}. Reason: ${reason}`,
        username: 'SYSTEM',
        user_id: null,
        channel_id: channelId
      });

    if (messageError) {
      // console.error('Message insert error:', messageError);
    }

    return NextResponse.json({ success: true, data: banData });
  } catch {
    // console.error('Ban API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}