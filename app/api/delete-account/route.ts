import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZ3JkaHpsaHZ2aWdrYmpsbWZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3Njc5NiwiZXhwIjoyMDczNTUyNzk2fQ.anCD0HXfXtE5QilmLvVeN9U7AmnYesvI-Y5p95RLBZ8';

export async function POST(request: NextRequest) {
  console.log('Delete account API called');
  
  try {
    // Create service role client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Service client created');

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    console.log('Auth header:', authHeader ? 'present' : 'missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Missing or invalid auth header');
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    // Extract the token and verify the user
    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    
    console.log('Verifying user with token...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.log('User verification failed:', userError);
      return NextResponse.json({ error: 'Invalid token or user not found' }, { status: 401 });
    }

    console.log('User verified:', user.id);

    // Call the delete function using service role
    console.log('Calling delete function...');
    const { data: deleteResult, error: deleteError } = await supabaseAdmin.rpc('delete_user_completely', {
      target_user_id: user.id
    });

    console.log('Delete result:', deleteResult, 'Error:', deleteError);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete user data', details: deleteError }, { status: 500 });
    }

    if (deleteResult === 'User not found') {
      console.log('User not found in database');
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    // Delete the auth user as well (only service role can do this)
    console.log('Deleting auth user...');
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    
    if (authDeleteError) {
      console.warn('Could not delete auth user:', authDeleteError);
      // Continue anyway since main data is deleted
    }

    console.log('Account deletion successful');
    return NextResponse.json({ 
      success: true, 
      message: deleteResult 
    });

  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 });
  }
}