CREATE OR REPLACE FUNCTION delete_user_completely(user_id UUID) 
RETURNS TEXT AS 
$function$
DECLARE 
    result_text TEXT;
BEGIN 
    -- Check if user exists
    SELECT username INTO result_text FROM public.users WHERE id = user_id;
    
    IF result_text IS NULL THEN 
        RETURN 'User not found';
    END IF;
    
    -- Delete in correct order (foreign key dependencies)
    DELETE FROM public.channel_bans WHERE channel_bans.user_id = user_id OR banned_by = user_id;
    DELETE FROM public.channel_members WHERE channel_members.user_id = user_id;  
    DELETE FROM public.messages WHERE messages.user_id = user_id;
    DELETE FROM public.channels WHERE created_by = user_id;
    DELETE FROM public.channel_categories WHERE created_by = user_id;
    DELETE FROM public.channel_roles WHERE created_by = user_id;
    DELETE FROM public.users WHERE id = user_id;
    
    RETURN 'User deleted successfully';
END;
$function$ 
LANGUAGE plpgsql SECURITY DEFINER;