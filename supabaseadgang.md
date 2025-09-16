# Supabase Access Credentials

## Project Information
- **Project Reference ID**: `pigrdhzlhvvigkbjlmfi`
- **Project URL**: `https://pigrdhzlhvvigkbjlmfi.supabase.co`
- **Database Host**: `db.pigrdhzlhvvigkbjlmfi.supabase.co:5432`

## API Keys & Tokens

### Public/Client Keys
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZ3JkaHpsaHZ2aWdrYmpsbWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzY3OTYsImV4cCI6MjA3MzU1Mjc5Nn0.hduIK4KgJ4KR0-8s9pF-2IxgmBF3ZzZGZbz58zX6r1U`

### Server/Admin Keys
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZ3JkaHpsaHZ2aWdrYmpsbWZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3Njc5NiwiZXhwIjoyMDczNTUyNzk2fQ.anCD0HXfXtE5QilmLvVeN9U7AmnYesvI-Y5p95RLBZ8`

### Management API
- **Management Token**: `sbp_d95a6f741a6498cb0e21abac5e8d5b8035c5e6fa`

## Usage Guide

### For Normal Database Operations
Use Service Role Key with Supabase client:
```javascript
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://pigrdhzlhvvigkbjlmfi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZ3JkaHpsaHZ2aWdrYmpsbWZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3Njc5NiwiZXhwIjoyMDczNTUyNzk2fQ.anCD0HXfXtE5QilmLvVeN9U7AmnYesvI-Y5p95RLBZ8'
);
```

### For Schema Changes (DDL Operations)
Use Management Token with Management API:
```javascript
const response = await fetch('https://api.supabase.com/v1/projects/pigrdhzlhvvigkbjlmfi/database/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sbp_d95a6f741a6498cb0e21abac5e8d5b8035c5e6fa',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: 'YOUR SQL HERE' })
});
```

## Available Tables & Key Structures

### Core Tables
- `channels` - IRC channels with MOTD support
- `channel_categories` - Channel organization
- `channel_members` - User memberships with roles
- `channel_roles` - Custom roles per channel
- `profiles` - User profiles
- `messages` - Chat messages
- `channel_bans` - Banned users

### Key Relations
- Channels belong to categories (optional)
- Members have roles (Owner, Moderator, Member, Custom)
- Messages belong to channels and users
- MOTD system fully implemented

## Commands Implemented
All IRC-style commands are functional:
- `/help`, `/info`, `/motd`, `/roles`
- `/kick`, `/ban`, `/mod`, `/unmod`
- `/createrole`, `/setrole`

## Last Updated
2025-01-16 - All systems operational