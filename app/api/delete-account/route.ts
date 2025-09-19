import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { strictRateLimit } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function POST(request: NextRequest) {
  // Apply rate limiting
  return strictRateLimit(request, async () => {
  
  try {
    // Get service key from environment
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseServiceKey) {
      logger.error('SUPABASE_SERVICE_ROLE_KEY not found in environment');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Create service role client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication using shared auth helper
    const { user, error: authError } = await verifyAuth(request);
    
    if (authError || !user) {
      logger.warn('Delete account: Authentication failed', { error: authError });
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }


    // Call the delete function using service role
    const { data: deleteResult, error: deleteError } = await supabaseAdmin.rpc('delete_user_completely', {
      target_user_id: user.id
    });


    if (deleteError) {
      logger.error('Delete user data failed', deleteError, { userId: user.id });
      return NextResponse.json({ error: 'Failed to delete user data', details: deleteError }, { status: 500 });
    }

    if (deleteResult === 'User not found') {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    // Delete the auth user as well (only service role can do this)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    
    if (authDeleteError) {
      logger.warn('Could not delete auth user', { error: authDeleteError.message, userId: user.id });
      // Continue anyway since main data is deleted
    }

    logger.info('User account deleted successfully', { userId: user.id });
    return NextResponse.json({ 
      success: true, 
      message: deleteResult 
    });

  } catch (error) {
    logger.error('Account deletion error', error as Error);
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 });
  }
  });
}