# Task 5: Refactor Notification Engine to Prisma/SQLite

## Summary
Successfully refactored the `NotificationEngine` class from in-memory arrays to SQLite via Prisma.

## Files Modified
1. **`/home/z/my-project/src/lib/notifications/notification-engine.ts`** — Complete rewrite
2. **`/home/z/my-project/src/app/api/data/notifications/route.ts`** — Added `await` to all engine calls

## Changes Made

### notification-engine.ts
- Removed `private notifications: Notification[]` and `private preferences: NotificationPreference[]` in-memory arrays
- Added `import { db, DEFAULT_USER_ID } from "@/lib/db"`
- Added DB→TS mapper functions (`mapDbNotificationToTs`, `mapDbPrefToTs`) that handle JSON parsing and Date→ISO string conversions
- Made all methods `async` (they now do DB I/O):
  - `notify()` → `db.notification.create()`
  - `getNotifications()` → `db.notification.findMany()` with Prisma where clauses
  - `getNotification()` → `db.notification.findUnique()`
  - `markAsRead()` → `db.notification.update()`
  - `markAllAsRead()` → `db.notification.updateMany()`
  - `dismiss()` → `db.notification.update()` (sets dismissed=true)
  - `dismissAll()` → `db.notification.updateMany()`
  - `getStats()` → Aggregates from `db.notification.findMany()`
  - `getPreferences()` → `db.notificationPreference.findMany()` with auto-seeding
  - `updatePreference()` → `db.notificationPreference.upsert()`
  - `clearAll()` → `db.notification.deleteMany()`
- Kept `listeners` array for real-time notifications (not persisted)
- Kept `generateId()` helper for backward compat
- Added `preferencesSeeded` flag and `ensurePreferencesSeeded()` method to seed preferences from `DEFAULT_NOTIFICATION_PREFERENCES` on first call
- Used `DEFAULT_USER_ID` for all queries
- Removed `loadNotifications()` and `loadPreferences()` (no longer needed)

### route.ts
- Added `await` to all 7 `notificationEngine` method calls:
  - `getStats()`, `getPreferences()`, `getNotifications()`, `notify()`, `markAsRead()`, `markAllAsRead()`, `dismiss()`, `dismissAll()`, `updatePreference()`

## Testing
- All API endpoints tested successfully via curl:
  - `GET /api/data/notifications` — returns empty array initially ✓
  - `POST /api/data/notifications` — creates notification in DB ✓
  - `GET /api/data/notifications?stats=true` — returns stats from DB ✓
  - `GET /api/data/notifications?preferences=true` — returns seeded preferences ✓
  - `PUT /api/data/notifications` with markRead — updates read/readAt in DB ✓
- No lint errors in modified files
- No compilation errors
