import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth, verifyChannelPermissions } from '@/lib/auth';
import { strictRateLimit } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function POST(request: NextRequest) {
  // Apply rate limiting
  return strictRateLimit(request, async () => {
  try {
    // Verify authentication
    const { user, error: authError } = await verifyAuth(request);
    
    if (authError || !user) {
      logger.warn('Ban API: Authentication failed', { error: authError });
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const { channelId, targetUserId, bannedBy, reason, targetUsername, bannerUsername } = await request.json();

    // Verify the bannedBy matches the authenticated user
    if (user.id !== bannedBy) {
      logger.warn('Ban API: User ID mismatch', { userId: user.id, bannedBy });
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
    }

    // Verify user has permission to ban in this channel
    const hasPermission = await verifyChannelPermissions(user.id, channelId, 'Moderator');
    
    if (!hasPermission) {
      logger.warn('Ban API: Insufficient permissions', { userId: user.id, channelId });
      return NextResponse.json({ error: 'Insufficient permissions to ban users in this channel' }, { status: 403 });
    }

    // Create admin client with service role
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseServiceKey) {
      logger.error('SUPABASE_SERVICE_ROLE_KEY not found in environment');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

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
      logger.error('Ban insert failed', banError, { channelId, targetUserId });
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
      logger.warn('Ban message insert failed', { error: messageError.message, channelId });
    }

    logger.info('User banned successfully', { channelId, targetUserId, bannedBy });
    return NextResponse.json({ success: true, data: banData });
  } catch (error) {
    logger.error('Ban API error', error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  });
}