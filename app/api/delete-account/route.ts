import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZ3JkaHpsaHZ2aWdrYmpsbWZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3Njc5NiwiZXhwIjoyMDczNTUyNzk2fQ.anCD0HXfXtE5QilmLvVeN9U7AmnYesvI-Y5p95RLBZ8';

export async function POST(request: NextRequest) {
  
  try {
    // Create service role client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    // Extract the token and verify the user
    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token or user not found' }, { status: 401 });
    }


    // Call the delete function using service role
    const { data: deleteResult, error: deleteError } = await supabaseAdmin.rpc('delete_user_completely', {
      target_user_id: user.id
    });


    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete user data', details: deleteError }, { status: 500 });
    }

    if (deleteResult === 'User not found') {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    // Delete the auth user as well (only service role can do this)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    
    if (authDeleteError) {
      console.warn('Could not delete auth user:', authDeleteError);
      // Continue anyway since main data is deleted
    }

    return NextResponse.json({ 
      success: true, 
      message: deleteResult 
    });

  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 });
  }
}