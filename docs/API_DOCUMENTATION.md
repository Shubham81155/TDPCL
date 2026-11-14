# Smart Garbage Reporting System - API Documentation

**API Version:** 1.0  
**Base URL:** `http://localhost:5000/api`  
**Authentication:** JWT Bearer Token  

---

## Authentication

All endpoints (except `/auth/register` and `/auth/login`) require JWT token in Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### Authentication

#### Register New Citizen
```
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "securePassword123",
  "role": "citizen"
}

Response (201):
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "user_id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "role": "citizen",
    "status": "active",
    "created_at": "2026-03-05T10:00:00Z"
  }
}
```

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}

Response (200):
{
  "success": true,
  "message": "Login successful",
  "user_id": 1,
  "email": "john@example.com",
  "role": "citizen",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Get Profile
```
GET /auth/profile
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "user": {
    "user_id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "role": "citizen",
    "status": "active",
    "created_at": "2026-03-05T10:00:00Z"
  }
}
```

#### Update Profile
```
PUT /auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe Updated",
  "phone": "9876543211"
}

Response (200):
{
  "success": true,
  "message": "Profile updated successfully",
  "user": { ... }
}
```

#### Change Password
```
POST /auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "oldPassword": "securePassword123",
  "newPassword": "newSecurePassword456"
}

Response (200):
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### Complaints (Citizen)

#### Submit New Complaint with Image
```
POST /complaints
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- image: <file>
- title: "Garbage Heap on Main Street"
- description: "Large pile of garbage blocking the road"
- latitude: 19.0760
- longitude: 72.8777
- category: "garbage_heap"
- urgency_level: "high"

Response (201):
{
  "success": true,
  "message": "Complaint submitted successfully",
  "complaint": {
    "complaint_id": 1,
    "status": "assigned",
    "assigned_officer_id": 1,
    "officer": {
      "officer_id": 1,
      "name": "Vijay Officer",
      "phone": "9876543220",
      "email": "vijay@officer.com",
      "distance_meters": 250,
      "current_workload": 3
    }
  }
}
```

#### Get My Complaints
```
GET /complaints?status=pending&category=garbage_heap&limit=20&offset=0
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": [
    {
      "complaint_id": 1,
      "title": "Garbage Heap on Main Street",
      "description": "Large pile of garbage blocking the road",
      "image_path": "https://s3.amazonaws.com/...",
      "latitude": 19.0760,
      "longitude": 72.8777,
      "category": "garbage_heap",
      "urgency_level": "high",
      "status": "in_progress",
      "created_at": "2026-03-05T10:00:00Z",
      "assigned_at": "2026-03-05T10:05:00Z"
    }
  ],
  "count": 1
}
```

Query Parameters:
- `status`: 'new', 'assigned', 'pending', 'in_progress', 'resolved', 'rejected'
- `category`: 'garbage_heap', 'litter', 'dumping_site', 'other'
- `dateFrom`: ISO date string
- `dateTo`: ISO date string
- `limit`: max records per page (default 20)
- `offset`: pagination offset (default 0)

#### Get Complaint Details
```
GET /complaints/:id
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "complaint": {
    "complaint_id": 1,
    "user_id": 1,
    "title": "...",
    "description": "...",
    "image_path": "https://s3.amazonaws.com/...",
    "latitude": 19.0760,
    "longitude": 72.8777,
    "area": "Ward 1",
    "category": "garbage_heap",
    "urgency_level": "high",
    "assigned_officer_id": 1,
    "status": "in_progress",
    "citizen_name": "John Doe",
    "citizen_phone": "9876543210",
    "created_at": "2026-03-05T10:00:00Z",
    "assigned_at": "2026-03-05T10:05:00Z",
    "started_at": "2026-03-05T10:10:00Z"
  }
}
```

#### Get Complaint Status Timeline
```
GET /complaints/:id/timeline
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "timeline": [
    {
      "history_id": 1,
      "complaint_id": 1,
      "old_status": "new",
      "new_status": "assigned",
      "changed_by": 1,
      "comment": "Auto-assigned to Officer: Vijay",
      "created_at": "2026-03-05T10:05:00Z"
    },
    {
      "history_id": 2,
      "complaint_id": 1,
      "old_status": "assigned",
      "new_status": "in_progress",
      "changed_by": 1,
      "comment": "Officer started working on it",
      "created_at": "2026-03-05T10:10:00Z"
    }
  ]
}
```

---

### Complaints (Officer)

#### Get Assigned Complaints
```
GET /complaints/officer/assigned?status=in_progress&limit=50&offset=0
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": [
    {
      "complaint_id": 1,
      "title": "Garbage Heap on Main Street",
      "description": "...",
      "image_path": "https://s3.amazonaws.com/...",
      "latitude": 19.0760,
      "longitude": 72.8777,
      "category": "garbage_heap",
      "urgency_level": "high",
      "status": "in_progress",
      "citizen_name": "John Doe",
      "citizen_email": "john@example.com",
      "citizen_phone": "9876543210",
      "created_at": "2026-03-05T10:00:00Z",
      "assigned_at": "2026-03-05T10:05:00Z",
      "started_at": "2026-03-05T10:10:00Z"
    }
  ],
  "count": 1
}
```

#### Update Complaint Status
```
PATCH /complaints/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "in_progress",
  "comment": "Started cleaning the area"
}

Response (200):
{
  "success": true,
  "message": "Complaint status updated to in_progress",
  "complaint": {
    "complaint_id": 1,
    "status": "in_progress",
    "updated_at": "2026-03-05T10:10:00Z"
  }
}
```

#### Resolve Complaint with Image
```
POST /complaints/:id/resolve
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- resolution_image_path: <file> (proof of action)
- comments: "Area cleaned and sanitized"

Response (200):
{
  "success": true,
  "message": "Complaint resolved successfully",
  "complaint": {
    "complaint_id": 1,
    "status": "resolved",
    "resolved_at": "2026-03-05T11:00:00Z"
  }
}
```

---

### Officers (Admin)

#### Get All Officers
```
GET /officers?status=active&ward_id=1&limit=100&offset=0
Authorization: Bearer <token>
Role: admin

Response (200):
{
  "success": true,
  "data": [
    {
      "officer_id": 1,
      "user_id": 4,
      "name": "Vijay Officer",
      "email": "vijay@officer.com",
      "phone": "9876543220",
      "employee_id": "OFF001",
      "assigned_ward_id": 1,
      "assigned_area_name": "Ward 1 - Central",
      "year_of_joining": 2020,
      "status": "active",
      "latitude": 19.05,
      "longitude": 72.85,
      "active_complaints": 3,
      "resolved_complaints": 45,
      "ward_name": "Ward 1"
    }
  ],
  "count": 1
}
```

#### Get Officer Details
```
GET /officers/:id
Authorization: Bearer <token>
Role: admin or self

Response (200): { officer details }
```

#### Create Officer
```
POST /officers
Authorization: Bearer <token>
Content-Type: application/json
Role: admin

{
  "name": "New Officer",
  "email": "officer@example.com",
  "phone": "9876543225",
  "password": "tempPassword123",
  "employee_id": "OFF002",
  "ward_id": 1,
  "area_name": "Ward 1 - East",
  "year_of_joining": 2024
}

Response (201):
{
  "success": true,
  "message": "Officer created successfully",
  "officer": { ... }
}
```

#### Update Officer
```
PUT /officers/:id
Authorization: Bearer <token>
Content-Type: application/json
Role: admin

{
  "name": "Officer Name Updated",
  "assigned_ward_id": 2,
  "assigned_area_name": "Ward 2 - Central",
  "status": "active"
}

Response (200): { updated officer data }
```

#### Update Officer Location
```
POST /officers/:id/location
Authorization: Bearer <token>
Content-Type: application/json
Role: officer

{
  "latitude": 19.0750,
  "longitude": 72.8770
}

Response (200):
{
  "success": true,
  "message": "Location updated successfully",
  "officer": { ... }
}
```

#### Get Officer Metrics
```
GET /officers/:id/metrics
Authorization: Bearer <token>
Role: admin or self

Response (200):
{
  "success": true,
  "metrics": {
    "pending_count": 2,
    "in_progress_count": 3,
    "resolved_count": 45,
    "rejected_count": 1,
    "total_complaints": 51,
    "avg_resolution_hours": "5.30",
    "first_complaint_date": "2025-01-01T10:00:00Z",
    "last_resolved_date": "2026-03-05T11:00:00Z"
  }
}
```

#### Deactivate Officer
```
PATCH /officers/:id/deactivate
Authorization: Bearer <token>
Role: admin

Response (200):
{
  "success": true,
  "message": "Officer deactivated and complaints reassigned",
  "officer": { ... }
}
```

---

### Wards (Admin)

#### Get All Wards
```
GET /wards?city=Mumbai&limit=100&offset=0
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": [
    {
      "ward_id": 1,
      "name": "Ward 1",
      "city": "Mumbai",
      "state": "Maharashtra",
      "boundaries_geojson": { ... },
      "officer_count": 2,
      "complaint_count": 45,
      "created_at": "2026-03-01T10:00:00Z"
    }
  ],
  "count": 1
}
```

#### Get Ward Details
```
GET /wards/:id
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "ward": { ... },
  "officers": [ ... ]
}
```

#### Create Ward
```
POST /wards
Authorization: Bearer <token>
Content-Type: application/json
Role: admin

{
  "name": "Ward 3",
  "city": "Mumbai",
  "state": "Maharashtra",
  "boundaries_geojson": {
    "type": "Polygon",
    "coordinates": [[[72.8, 19.0], [72.9, 19.0], [72.9, 19.1], [72.8, 19.1], [72.8, 19.0]]]
  }
}

Response (201): { ward data }
```

#### Update Ward
```
PUT /wards/:id
Authorization: Bearer <token>
Content-Type: application/json
Role: admin

{
  "name": "Ward 3 Updated",
  "boundaries_geojson": { ... }
}

Response (200): { updated ward }
```

#### Get Ward Officers
```
GET /wards/:id/officers
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": [ officers list ],
  "count": 2
}
```

---

### Assignments & Geolocation

#### Find Nearest Officers
```
POST /assignments/nearest-officers
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 19.0760,
  "longitude": 72.8777,
  "ward_id": 1,
  "limit": 5
}

Response (200):
{
  "success": true,
  "data": [
    {
      "officer_id": 1,
      "user_id": 4,
      "officer_name": "Vijay Officer",
      "officer_phone": "9876543220",
      "assigned_area_name": "Ward 1 - Central",
      "distance_meters": 250,
      "current_workload": 3
    }
  ],
  "count": 1
}
```

#### Get Officer Workload
```
GET /assignments/workload/:officerId
Authorization: Bearer <token>
Role: admin or self

Response (200):
{
  "success": true,
  "workload": {
    "pending_count": 2,
    "in_progress_count": 3,
    "resolved_count": 45,
    "rejected_count": 1,
    "total_active": 5,
    "avg_resolution_hours": 5.3
  }
}
```

#### Balance Workload in Ward
```
POST /assignments/balance/:wardId
Authorization: Bearer <token>
Role: admin

Response (200):
{
  "success": true,
  "message": "Workload balanced",
  "reassigned": 1,
  "from": 1,
  "to": 2
}
```

#### Get Ward by Coordinates
```
POST /assignments/ward-by-location
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 19.0760,
  "longitude": 72.8777
}

Response (200):
{
  "success": true,
  "ward": {
    "ward_id": 1,
    "name": "Ward 1",
    "city": "Mumbai",
    "state": "Maharashtra"
  }
}
```

---

### Admin Dashboard

#### Get Complaint Statistics
```
GET /admin/stats/complaints
Authorization: Bearer <token>
Role: admin

Response (200):
{
  "success": true,
  "stats": {
    "total_complaints": 150,
    "new_count": 10,
    "assigned_count": 20,
    "pending_count": 15,
    "in_progress_count": 35,
    "resolved_count": 65,
    "rejected_count": 5,
    "high_urgency_count": 25,
    "medium_urgency_count": 75,
    "low_urgency_count": 50,
    "avg_resolution_hours": "4.50"
  }
}
```

#### Get Complaints by Category
```
GET /admin/stats/by-category
Authorization: Bearer <token>
Role: admin

Response (200):
{
  "success": true,
  "data": [
    {
      "category": "garbage_heap",
      "count": 60,
      "resolved": 50
    },
    {
      "category": "litter",
      "count": 50,
      "resolved": 40
    }
  ]
}
```

#### Get Complaints by Ward
```
GET /admin/stats/by-ward
Authorization: Bearer <token>
Role: admin

Response (200):
{
  "success": true,
  "data": [
    {
      "ward_id": 1,
      "name": "Ward 1",
      "total_complaints": 75,
      "resolved": 60,
      "officer_count": 2
    }
  ]
}
```

#### Get Officer Performance Leaderboard
```
GET /admin/stats/officer-performance?limit=10
Authorization: Bearer <token>
Role: admin

Response (200):
{
  "success": true,
  "data": [
    {
      "officer_id": 1,
      "user_id": 4,
      "officer_name": "Vijay Officer",
      "total_complaints": 51,
      "resolved": 45,
      "active": 6,
      "avg_resolution_hours": "5.30",
      "resolution_rate": "88.24"
    }
  ]
}
```

#### Get Heatmap Data
```
POST /admin/heatmap
Authorization: Bearer <token>
Role: admin

Response (200):
{
  "success": true,
  "data": [
    {
      "longitude": 72.85,
      "latitude": 19.05,
      "complaint_count": 5,
      "has_urgent": 1
    }
  ]
}
```

#### Export Complaints as CSV
```
GET /admin/report/export?status=resolved&dateFrom=2026-01-01&dateTo=2026-03-31
Authorization: Bearer <token>
Role: admin

Response: CSV file download
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

---

## Rate Limiting

- General: 100 requests per minute per IP
- Auth endpoints: 5 requests per minute (login, register)

---

## Pagination

For endpoints returning lists, use:
- `limit`: Items per page (default 20, max 1000)
- `offset`: Starting position (default 0)

---

## WebSocket Events (Future Implementation - Phase 4)

```
Real-time complaint assignment:
  event: 'complaint_assigned'
  data: { complaint_id, officer_id, officer_name }

Status updates:
  event: 'complaint_updated'
  data: { complaint_id, new_status, updated_at }
```

---

**Last Updated:** March 5, 2026
