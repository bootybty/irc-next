# Site Administration System

## Overview
A centralized administration system managed through a private `#admin` channel, allowing site-wide moderation and management through commands.

## Architecture

### Database Structure
```sql
-- Site-level roles table
CREATE TABLE site_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  role TEXT CHECK (role IN ('site_owner', 'site_admin', 'site_moderator')),
  granted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Global bans table
CREATE TABLE site_bans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  banned_by UUID REFERENCES profiles(id),
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  UNIQUE(user_id)
);

-- Admin action logs
CREATE TABLE admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES profiles(id),
  action_type TEXT,
  target_user UUID,
  target_channel UUID,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Permission Hierarchy

1. **Site Owner** - Complete control
   - Can assign/remove site admins
   - Can delete any channel
   - All admin capabilities
   
2. **Site Admin** - Site-wide moderation
   - Can ban users globally
   - Can delete content across channels
   - Can assign site moderators
   - Cannot remove other site admins
   
3. **Site Moderator** - Content moderation
   - Can ban users globally
   - Can delete messages site-wide
   - Cannot assign roles
   
4. **Channel Owner** - Channel specific
   - Full control of their channel only
   
5. **Channel Moderator** - Channel specific
   - Moderation within their channel only

## Admin Channel Setup

### Channel Configuration
- Channel name: `#admin`
- Type: Private, invite-only
- Auto-join for site_admins and site_owner
- Persistent message history
- All admin commands logged automatically

## Command Reference

### User Management Commands

#### `/siteadmin <username>`
- **Permission**: site_owner only
- **Action**: Promotes user to site admin
- **Example**: `/siteadmin john_doe`
- **Log**: `[PROMOTE] Admin1 promoted john_doe to site_admin`

#### `/sitemoderator <username>`
- **Permission**: site_admin, site_owner
- **Action**: Promotes user to site moderator
- **Example**: `/sitemoderator helper123`
- **Log**: `[PROMOTE] Admin1 promoted helper123 to site_moderator`

#### `/removesite <username>`
- **Permission**: site_owner (for admins), site_admin (for moderators)
- **Action**: Removes site-level role
- **Example**: `/removesite former_mod`
- **Log**: `[DEMOTE] Admin1 removed site role from former_mod`

#### `/siteban <username> [reason]`
- **Permission**: site_moderator, site_admin, site_owner
- **Action**: Bans user from entire site
- **Example**: `/siteban spammer "Repeated spam across channels"`
- **Effects**:
  - User removed from all channels
  - Cannot join any channels
  - Cannot create new channels
  - IP logged for reference
- **Log**: `[SITEBAN] Admin1 banned spammer globally - Reason: Repeated spam across channels`

#### `/siteunban <username>`
- **Permission**: site_moderator, site_admin, site_owner
- **Action**: Removes global ban
- **Example**: `/siteunban reformed_user`
- **Log**: `[UNBAN] Admin1 unbanned reformed_user globally`

#### `/lookup <username>`
- **Permission**: site_admin, site_owner
- **Action**: Shows detailed user information
- **Returns**:
  - User ID
  - Email (if available)
  - Join date
  - Channels membership
  - Recent activity
  - Ban history
  - IP address (last known)
- **Example**: `/lookup suspicious_user`

### Content Moderation Commands

#### `/globaldelete <message-id>`
- **Permission**: site_moderator, site_admin, site_owner
- **Action**: Deletes message from any channel
- **Example**: `/globaldelete msg_12345`
- **Log**: `[DELETE] Admin1 deleted message msg_12345 from #general`

#### `/purgeuser <username> [timeframe]`
- **Permission**: site_admin, site_owner
- **Action**: Deletes all messages from user
- **Timeframes**: `1h`, `24h`, `7d`, `30d`, `all`
- **Example**: `/purgeuser spammer 24h`
- **Confirmation**: Required for >100 messages
- **Log**: `[PURGE] Admin1 purged 47 messages from spammer (last 24h)`

#### `/shadowban <username>`
- **Permission**: site_admin, site_owner
- **Action**: Makes user's messages invisible to others
- **Example**: `/shadowban troll_user`
- **Note**: User can still post but only they see their messages
- **Log**: `[SHADOWBAN] Admin1 shadowbanned troll_user`

### Channel Management Commands

#### `/forcedelete <#channel>`
- **Permission**: site_admin, site_owner
- **Action**: Deletes any channel
- **Example**: `/forcedelete #toxic_channel`
- **Confirmation**: Required (shows member count)
- **Log**: `[FORCEDELETE] Admin1 deleted #toxic_channel (234 members)`

#### `/forcemod <#channel> <username>`
- **Permission**: site_admin, site_owner
- **Action**: Makes user moderator in specified channel
- **Example**: `/forcemod #general trusted_user`
- **Log**: `[FORCEMOD] Admin1 made trusted_user moderator in #general`

#### `/lockdown <#channel> [duration]`
- **Permission**: site_moderator, site_admin, site_owner
- **Action**: Freezes channel (no new messages)
- **Duration**: Optional (e.g., `10m`, `1h`, permanent if omitted)
- **Example**: `/lockdown #general 1h`
- **Log**: `[LOCKDOWN] Admin1 locked #general for 1h`

#### `/unlock <#channel>`
- **Permission**: site_moderator, site_admin, site_owner
- **Action**: Removes lockdown
- **Example**: `/unlock #general`
- **Log**: `[UNLOCK] Admin1 unlocked #general`

### Monitoring Commands

#### `/reports [status]`
- **Permission**: site_moderator, site_admin, site_owner
- **Action**: Shows user reports
- **Statuses**: `pending`, `resolved`, `all`
- **Example**: `/reports pending`
- **Returns**: List of reports with timestamps and details

#### `/activity <username> [days]`
- **Permission**: site_admin, site_owner
- **Action**: Shows user activity
- **Default**: Last 7 days
- **Example**: `/activity suspicious_user 30`
- **Returns**:
  - Messages sent per channel
  - Channels joined/left
  - Commands used
  - Reports against user

#### `/stats [timeframe]`
- **Permission**: site_moderator, site_admin, site_owner
- **Action**: Shows site statistics
- **Timeframes**: `today`, `week`, `month`, `all`
- **Example**: `/stats week`
- **Returns**:
  - Active users
  - Messages sent
  - New channels created
  - Bans issued
  - Top channels by activity

#### `/alerts <on|off>`
- **Permission**: site_moderator, site_admin, site_owner
- **Action**: Toggle admin notifications
- **Example**: `/alerts on`
- **Notifications**:
  - New user reports
  - Mass user joins
  - Spam detection
  - New channel creation

## Implementation Features

### Auto-Logging
All admin actions automatically post to #admin channel:
```
[TIMESTAMP] [ACTION] AdminUsername performed action - Details
```

### Confirmation System
Destructive actions require confirmation:
```
Admin: /forcedelete #general
Bot: ⚠️ Delete #general with 1,423 members? 
     This action cannot be undone.
     Type: /confirm 8472 within 30 seconds
Admin: /confirm 8472
Bot: ✅ Channel #general deleted
```

### Cross-Channel Effects
Admin actions affect all channels:
```
Admin: /siteban spammer "Multiple violations"
Bot: User 'spammer' has been banned globally
     - Removed from 5 channels
     - 47 messages deleted
     - IP logged: 192.168.1.1
```

### Visual Indicators
- Site admins get special badge: ⭐ or [SA]
- Site moderators get badge: 🛡️ or [SM]
- Different color in user list (e.g., gold for admin, silver for moderator)
- Badge appears in ALL channels, not just #admin

### Rate Limiting
- Prevent command spam
- Max 10 admin commands per minute
- Cooldown on mass actions (purge, etc.)

## Security Considerations

1. **Two-Factor Actions**
   - Critical actions (site_admin promotion, channel deletion) require confirmation
   - Confirmation codes expire after 30 seconds

2. **Audit Trail**
   - All actions logged in database
   - Cannot be deleted, only archived
   - Include IP address of admin

3. **Permission Checks**
   - Check site_roles before channel_members
   - Site permissions override channel permissions
   - Cache permissions for performance

4. **Backup Commands**
   - `/backup` - Creates snapshot before major changes
   - `/rollback <backup-id>` - Restore from backup

## Future Enhancements

1. **Admin Dashboard Web UI**
   - Visual interface for admin actions
   - Graphs and analytics
   - Bulk actions support

2. **Automated Moderation**
   - Spam detection
   - Hate speech filtering
   - Auto-ban on threshold

3. **Report System**
   - Users can `/report <user> <reason>`
   - Queue for admin review
   - Resolution tracking

4. **Admin Scheduling**
   - Schedule bans to expire
   - Scheduled announcements
   - Maintenance mode scheduling

5. **API Integration**
   - Webhook for external monitoring
   - Discord/Slack notifications
   - External audit systems

## Development Checklist

- [ ] Create site_roles table
- [ ] Create site_bans table
- [ ] Create admin_logs table
- [ ] Implement permission checking middleware
- [ ] Add #admin channel auto-creation
- [ ] Implement user management commands
- [ ] Implement content moderation commands
- [ ] Implement channel management commands
- [ ] Implement monitoring commands
- [ ] Add visual indicators for admins
- [ ] Create confirmation system
- [ ] Add auto-logging to #admin
- [ ] Implement rate limiting
- [ ] Add audit trail
- [ ] Create backup system
- [ ] Write tests for all commands
- [ ] Documentation for users
- [ ] Admin training guide