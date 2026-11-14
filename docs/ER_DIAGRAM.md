# Database Entity-Relationship (ER) Diagram
# Smart Garbage Reporting System

## ER Diagram (Text Format)

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE SCHEMA                          │
│                  Smart Garbage Reporting System                 │
└─────────────────────────────────────────────────────────────────┘

                            ┌──────────────┐
                            │    USERS     │
                            ├──────────────┤
                            │ user_id (PK) │< ─ ─ ─ ─ ─ ─
                            │ name         │              │
                            │ email (UQ)   │              │
                            │ phone (UQ)   │              │
                            │ password_hash│              │
                            │ role         │              │
                            │ status       │              │
                            │ created_at   │              │
                            │ updated_at   │              │
                            └──────────────┘              │
                                  ▲                        │
                    ┌─────────────┼─────────┐             │
                    │             │         │             │
        ┌───────────┴──┐  ┌─────┴──────┐  │      Has created by
        │              │  │            │  │
        │           (FK)  │         (FK)   │
   ┌─────────────┐  ┌──────────────────┐  │  ┌──────────────────┐
   │ OFFICERS    │  │  COMPLAINTS      │  └──│ AUDIT_LOGS       │
   ├─────────────┤  ├──────────────────┤     ├──────────────────┤
   │officer_id   │  │ complaint_id  (PK)     │ log_id       (PK)│
   │user_id   (FK)──│ user_id       (FK)──┐  │ user_id      (FK)│
   │empl_id      │  │ title             │  │ action           │
   │ward_id   (FK)  │ description       │  │ entity_type      │
   │area_name    │  │ image_path        │  │ old_values       │
   │location(GIS)   │ location (GIS)    │  │ new_values       │
   │status       │  │ lat/long          │  │ ip_address       │
   └─────────────┘  │ area              │  │ user_agent       │
        ▲           │ category          │  │ created_at       │
        │ (FK)      │ urgency_level     │  └──────────────────┘
        │           │ assigned_officer_ │
        │           │   id       (FK)───┘
        │           │ status            │
        │           │ resolution_image  │
        │           │ resolution_desc   │
        │           │ created_at        │
        │           │ assigned_at       │
        │           │ started_at        │
        │           │ resolved_at       │
        │           └──────────────────┘
        │                    │ (1:N)
        │           ┌────────┴──────────┐
        │           │                   │
        │      ┌─────────────────────┐  │  ┌──────────────────────┐
        │      │ COMPLAINT_HISTORY   │  │  │ NOTIFICATIONS        │
        │      ├─────────────────────┤  │  ├──────────────────────┤
        │      │ history_id      (PK)   │  │ notif_id         (PK)│
        │      │ complaint_id   (FK)────┘  │ user_id          (FK)│
        │      │ old_status            │   │ complaint_id   (FK)──┘
        │      │ new_status            │   │ notif_type           │
        │      │ changed_by        (FK)─┐  │ title                │
        │      │ comment               │  │ message              │
        │      │ created_at            │  │ is_read              │
        │      └─────────────────────┘  │  │ metadata             │
        │                               │  │ created_at           │
        │                               │  └──────────────────────┘
        │                    ┌──────────┘
        │                    │
        │      ┌─────────────┴─────────┐
        │      │                       │
    ┌───┴──────────────┐      ┌────────────────────────┐
    │ WARD_BOUNDARIES  │      │ USER_PREFERENCES       │
    ├──────────────────┤      ├────────────────────────┤
    │ ward_id      (PK)◄──────│ pref_id            (PK)│
    │ name             │ (FK) │ user_id            (FK)│
    │ city             │      │ sms_enabled            │
    │ state            │      │ email_enabled          │
    │ boundaries(GIS)  │      │ push_enabled           │
    │ created_at       │      │ sms_phone              │
    └──────────────────┘      │ created_at             │
                              └────────────────────────┘

    ┌──────────────────────────┐
    │ NOTIFICATION_LOGS        │
    ├──────────────────────────┤
    │ log_id               (PK)│
    │ user_id              (FK)│
    │ notification_type        │
    │ recipient                │
    │ subject                  │
    │ message                  │
    │ status                   │
    │ error_message            │
    │ created_at               │
    │ sent_at                  │
    └──────────────────────────┘
```

---

## Table Descriptions

### USERS
Stores all user accounts (Citizens, Officers, Admins)
- **PK:** user_id
- **UQ:** email, phone
- **Roles:** citizen, officer, admin
- **Status:** active, inactive, suspended
- **PostGIS:** No spatial data

### OFFICERS
Officer-specific information with location tracking
- **PK:** officer_id
- **FK:** user_id (references USERS)
- **FK:** ward_id (references WARDS)
- **Spatial:** location (POINT - current GPS)

### WARDS
Municipal wards/administrative areas
- **PK:** ward_id
- **Spatial:** boundaries (POLYGON)
- **Used for:** Complaint assignment by area

### COMPLAINTS
Main complaint records with geospatial data
- **PK:** complaint_id
- **FK:** user_id (citizen who filed)
- **FK:** assigned_officer_id (officer handling)
- **Spatial:** location (POINT - GPS coordinates)
- **Status:** new → assigned → in_progress → resolved/rejected
- **Images:** image_path (S3 URL), resolution_image_path

### COMPLAINT_HISTORY
Audit trail of all complaint status changes
- **PK:** history_id
- **FK:** complaint_id
- **FK:** changed_by (officer/admin who made change)
- **Records:** old_status → new_status transitions

### NOTIFICATIONS
In-app notification records
- **PK:** notification_id
- **FK:** user_id, complaint_id
- **Types:** complaint_assigned, status_updated, new_complaint

### NOTIFICATION_LOGS
SMS/Email delivery logs
- **PK:** log_id
- **FK:** user_id
- **Status:** pending, sent, failed
- **Tracks:** Delivery attempts and errors

### USER_PREFERENCES
User notification preferences
- **PK:** preference_id
- **FK:** user_id (unique)
- **Controls:** SMS, Email, Push notification opt-in/out

### AUDIT_LOGS
Admin action audit trail
- **PK:** log_id
- **FK:** user_id
- **Records:** All entity modifications with old/new values
- **Tracks:** IP address and user agent

---

## Relationships (Cardinality)

| Source | Target | Type | Cardinality |
|--------|--------|------|------------|
| USERS | OFFICERS | officer_id to user_id | 1:1 |
| USERS | AUDIT_LOGS | user_id | 1:N |
| WARDS | OFFICERS | ward_id | 1:N |
| WARDS | COMPLAINTS | ward_id | 1:N |
| OFFICERS | COMPLAINTS | officer_id | 1:N |
| USERS | COMPLAINTS | user_id (citizen) | 1:N |
| USERS | NOTIFICATIONS | user_id | 1:N |
| USERS | USER_PREFERENCES | user_id | 1:1 |
| USERS | NOTIFICATION_LOGS | user_id | 1:N |
| COMPLAINTS | COMPLAINT_HISTORY | complaint_id | 1:N |
| COMPLAINTS | NOTIFICATIONS | complaint_id | 1:N |

---

## Key Spatial Features (PostGIS)

### GeometryTypes
- **POINT:** Officer current location, complaint GPS coordinates
- **POLYGON:** Ward boundaries

### Spatial Indexes
```sql
CREATE INDEX idx_complaints_location ON complaints USING GIST(location);
CREATE INDEX idx_wards_boundaries ON wards USING GIST(boundaries);
CREATE INDEX idx_officers_location ON officers USING GIST(location);
```

### Distance Calculations
```sql
-- Find nearest officer to complaint
SELECT officer_id FROM officers
ORDER BY ST_Distance(location::geography, complaint_location::geography)
LIMIT 1;

-- Find complaints within 2km of officer
SELECT complaint_id FROM complaints
WHERE ST_DWithin(location::geography, officer_location::geography, 2000)
```

---

## Data Integrity Constraints

| Constraint | Table | Type |
|-----------|-------|------|
| PK | All tables | PRIMARY KEY |
| UQ | USERS | email, phone |
| UQ | OFFICERS | user_id, employee_id |
| UQ | USER_PREFERENCES | user_id |
| FK | OFFICERS.user_id | USERS.user_id (ON DELETE CASCADE) |
| FK | OFFICERS.ward_id | WARDS.ward_id |
| FK | COMPLAINTS.user_id | USERS.user_id (ON DELETE CASCADE) |
| FK | COMPLAINTS.assigned_officer_id | OFFICERS.officer_id |
| FK | COMPLAINT_HISTORY.complaint_id | COMPLAINTS.complaint_id (ON DELETE CASCADE) |
| FK | NOTIFICATIONS.user_id | USERS.user_id (ON DELETE CASCADE) |
| FK | NOTIFICATIONS.complaint_id | COMPLAINTS.complaint_id (ON DELETE CASCADE) |
| FK | NOTIFICATION_LOGS.user_id | USERS.user_id (ON DELETE CASCADE) |
| FK | USER_PREFERENCES.user_id | USERS.user_id (ON DELETE CASCADE) |
| FK | AUDIT_LOGS.user_id | USERS.user_id (ON DELETE SET NULL) |
| FK | COMPLAINT_HISTORY.changed_by | USERS.user_id (ON DELETE SET NULL) |
| CHK | USERS.role | IN ('citizen', 'officer', 'admin') |
| CHK | USERS.status | IN ('active', 'inactive', 'suspended') |
| CHK | OFFICERS.status | IN ('active', 'on_leave', 'inactive') |
| CHK | COMPLAINTS.status | IN ('new', 'assigned', 'pending', 'in_progress', 'resolved', 'rejected') |
| CHK | COMPLAINTS.urgency_level | IN ('low', 'medium', 'high') |
| CHK | NOTIFICATION_LOGS.status | IN ('pending', 'sent', 'failed') |

---

## Query Performance Indexes

```sql
-- User lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);

-- Complaint searches
CREATE INDEX idx_complaints_user_id ON complaints(user_id);
CREATE INDEX idx_complaints_officer_id ON complaints(assigned_officer_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_created_at ON complaints(created_at);
CREATE INDEX idx_complaints_location ON complaints USING GIST(location);

-- Spatial queries
CREATE INDEX idx_wards_boundaries ON wards USING GIST(boundaries);
CREATE INDEX idx_officers_location ON officers USING GIST(location);

-- History and logs
CREATE INDEX idx_complaint_history_complaint_id ON complaint_history(complaint_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

## Statistics & Cardinality Info

Expected data volumes:
- **Users:** 10K - 100K (citizens + officers + admins)
- **Officers:** 100 - 1K per city
- **Wards:** 50 - 200 per city
- **Complaints:** 500-1000 per day (growing)
- **Complaint History:** 2000+ per day
- **Notifications:** 5000+ per day
- **Notification Logs:** 10K+ per day

**Estimated Database Size:** 5-10 GB after 1 year (depends on image storage strategy)

---

**ER Diagram Version:** 1.0  
**Last Updated:** March 5, 2026
