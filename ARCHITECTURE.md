# IRC Chat Platform - Architecture & Scaling

## Tech Stack
- **Frontend:** Next.js + React + TailwindCSS
- **Backend:** Next.js API Routes 
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **Real-time:** Supabase Realtime (WebSocket + Broadcast + Presence)

## Scaling Targets

### User Capacity
- **~1,000-5,000 concurrent users** (WebSocket connections)
- **~50,000+ registered users** total
- **Millions of messages** stored in database

### Per Channel Performance
- **~200-500 users per channel** (comfortable)
- **~50 channels per server** (optimal)
- **Automatic cleanup** of inactive connections

## Real-time Architecture

### Simplified Setup (Supabase Realtime Only)
```
User A ←→ [Next.js/Vercel] ←→ [Supabase Realtime + PostgreSQL]
User B ←→ [Next.js/Vercel] ←→ [Supabase Realtime + PostgreSQL]  
User C ←→ [Next.js/Vercel] ←→ [Supabase Realtime + PostgreSQL]
    ↑           ↑                      ↑
WebSocket   API Routes        Real-time + Storage
```

**Benefits:**
- **Single real-time system** - no complex state management
- **Built-in persistence** - messages automatically stored
- **Cross-instance sync** - works out of the box
- **No serverless limitations** - Supabase handles WebSocket connections

### Supabase Realtime Capacity Limits
- **Free tier:** 200 concurrent connections (perfect for MVP)
- **Pro tier ($25/month):** 500 concurrent connections  
- **Team tier ($599/month):** 5,000 concurrent connections
- **Enterprise:** 10,000+ concurrent connections (custom pricing)

## Optimized Real-time Strategy

### 1. Supabase Realtime Features
- **Broadcast:** Instant ephemeral messaging (typing indicators)
- **Presence:** User online status and location tracking  
- **Postgres Changes:** Persistent message storage with real-time sync
- **Connection pooling:** Smart channel subscriptions

### 2. Smart Implementation
```typescript
// Multi-purpose channel subscription
const channel = supabase
  .channel(`channel_${channelId}`)
  
  // Instant messaging via broadcast
  .on('broadcast', { event: 'message' }, payload => {
    addMessage(payload) // Immediate UI update
  })
  
  // Typing indicators (ephemeral)
  .on('broadcast', { event: 'typing' }, payload => {
    showTypingIndicator(payload.user)
  })
  
  // Online users tracking
  .on('presence', { event: 'sync' }, () => {
    const users = channel.presenceState()
    updateOnlineUsers(users)
  })
  
  // Persistent message backup via database
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public', 
    table: 'messages',
    filter: `channel_id=eq.${channelId}`
  }, payload => {
    // Fallback for missed broadcasts
    if (!messageExists(payload.new.id)) {
      addMessage(payload.new)
    }
  })
  .subscribe()

// Connection management
function switchChannel(oldChannelId, newChannelId) {
  supabase.removeChannel(`channel_${oldChannelId}`)
  connectToChannel(newChannelId)
}
```

### 3. Performance Characteristics

#### Latency
- **Broadcast messages:** ~50-150ms (direct WebSocket)
- **Postgres changes:** ~100-300ms (via database triggers)
- **Presence updates:** ~50-100ms (WebSocket)
- **Overall feeling:** Real-time with reliable backup

#### Connection Management
- **Auto-reconnect:** Built into Supabase client
- **State persistence:** All messages stored in PostgreSQL
- **Graceful degradation:** Database sync if WebSocket fails
- **No timeout issues:** Supabase handles long-lived connections

## Database Schema (Supabase)

```sql
-- Core Tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  topic TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(server_id, name)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'message', -- message, action, system
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_servers (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- owner, admin, moderator, member
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, server_id)
);

-- Indexes for performance
CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_user ON messages(user_id);
CREATE INDEX idx_channels_server ON channels(server_id);
```

## Implementation Phases

### Phase 1: Basic Chat (Current)
- [x] Socket.io server setup
- [x] Real-time messaging in single instance
- [x] Channel switching
- [x] Responsive UI

### Phase 2: Database Integration
- [ ] Supabase setup and schema
- [ ] User authentication
- [ ] Message persistence
- [ ] Server/channel management

### Phase 3: Scaling & Real-time
- [ ] Supabase Realtime integration
- [ ] Cross-instance message sync
- [ ] Connection pooling
- [ ] Performance optimization

### Phase 4: IRC Features
- [ ] IRC commands (/join, /part, /kick, /ban)
- [ ] User roles and permissions
- [ ] Private messages
- [ ] Channel topics and modes

### Phase 5: Advanced Features
- [ ] File uploads
- [ ] Message search
- [ ] Notifications
- [ ] Mobile app (React Native)

## Deployment Considerations

### Vercel Settings
- **Function timeout:** Max 30s (adequate for WebSocket handshake)
- **Edge runtime:** Consider for better global performance
- **Environment variables:** Supabase keys, JWT secrets

### Supabase Configuration
- **Connection pooling:** Enable for high traffic
- **Row Level Security:** Secure message access
- **Real-time policies:** Channel-based permissions

### Monitoring
- **WebSocket connections:** Track concurrent users
- **Database performance:** Query optimization
- **Error tracking:** Sentry or similar
- **Uptime monitoring:** Ensure 99.9% availability

## Security Considerations

- **Authentication:** Supabase Auth + JWT tokens
- **Message validation:** Sanitize all user input
- **Rate limiting:** Prevent spam and abuse
- **CORS:** Restrict to production domains
- **Environment secrets:** Never expose API keys

## Future Scalability Options

If growth exceeds current architecture:
- **Dedicated WebSocket server:** Node.js + Redis
- **Message queues:** Redis Pub/Sub or AWS SQS
- **CDN:** For file uploads and static assets
- **Database sharding:** Split by server/channel
- **Microservices:** Separate user, message, and real-time services