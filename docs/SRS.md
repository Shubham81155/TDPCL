# Smart Garbage Reporting & Municipality Automation System
# Software Requirements Specification (SRS)

**Document Version:** 1.0  
**Date:** March 5, 2026  
**Status:** In Development  

---

## 1. Executive Summary

The Smart Garbage Reporting & Municipality Automation System is a comprehensive digital platform that enables citizens to report civic issues related to garbage and waste management through image uploads with automatic geolocation. The system intelligently routes complaints to the nearest municipal officers based on GPS coordinates, who then access a dedicated dashboard to manage, track, and resolve issues. An admin portal provides comprehensive analytics, reporting, and officer management capabilities.

This platform aims to:
- **Reduce Response Time**: Automate complaint assignment and notification delivery
- **Improve Transparency**: Track complaint status in real-time
- **Enhance Accountability**: Monitor officer performance and resolution metrics
- **Optimize Resource Allocation**: Assign complaints based on proximity and workload

---

## 2. System Overview

### 2.1 Vision
A fully integrated civic complaint management ecosystem that bridges the gap between citizens and municipal authorities through intelligent geolocation-based routing and real-time notifications.

### 2.2 Scope

**In Scope:**
- Citizen mobile/web interface for complaint submission with image and GPS
- Automatic complaint routing based on officer location and ward assignment
- Officer dashboard for complaint management and resolution tracking
- Admin portal for officer management and analytics
- Real-time SMS/Email notifications
- Report generation (PDF/CSV exports)
- User role-based access control (RBAC)

**Out of Scope:**
- Mobile-specific native apps (Phase 2)
- Multi-language interface (Phase 2)
- Advanced ML-based complaint categorization (Phase 3)
- Offline mobile functionality (Phase 2)

---

## 3. Functional Requirements

### 3.1 Citizen Module

#### FR1: User Registration & Authentication
- Citizen can register with name, email, phone, password
- Email verification for new accounts
- Secure password hashing (bcrypt)
- Login with email/password
- Password reset via email
- Session management via JWT tokens

**Acceptance Criteria:**
- Registration succeeds with valid email & 10-digit phone
- Duplicate email/phone registration is rejected
- Login returns valid JWT token
- Token expires after 24 hours

#### FR2: Complaint Submission
- Upload garbage-related image (JPG, PNG, max 10MB)
- Automatic GPS location capture (browser Geolocation API)
- Manual location override if GPS unavailable
- Fill complaint details: title, description, category, urgency level
- Submit complaint with image to AWS S3
- Receive confirmation notification

**Acceptance Criteria:**
- Image uploads to S3 successfully
- GPS coordinates captured within 5 meters accuracy
- Complaint saved to database with all fields
- Citizen receives email/SMS confirmation within 10 seconds

#### FR3: Complaint Tracking
- View all submitted complaints with status (New, Assigned, In Progress, Resolved, Rejected)
- Filter complaints by status, date range, category
- View detailed complaint including:
  - Original image
  - GPS location on map
  - Assigned officer details
  - Status history timeline
  - Resolution image (when available)
- Receive notifications on status updates via SMS/Email

**Acceptance Criteria:**
- Filtering works across all available statuses
- Complaint timeline shows all status changes with timestamps
- Notification sent within 10 seconds of status update

#### FR4: Profile Management
- View and edit profile (name, phone, email)
- Upload profile picture
- Set notification preferences (SMS, Email, Push)
- Change password

---

### 3.2 Municipality Officer Module

#### FR5: Officer Authentication & Dashboard
- Officer login with email/password
- View assigned complaints list
- Sort/filter by status, date, urgency level
- Search complaints by ID or citizen name

**Acceptance Criteria:**
- Officer can see only assigned complaints
- Dashboard loads in <3 seconds with 100+ complaints

#### FR6: Complaint Map View
- Display all assigned complaints on interactive map
- Show complaint location with info window
- Filter complaints on map by status/urgency
- Click complaint pin to view details

**Acceptance Criteria:**
- Map renders all 100+ complaints without lag
- Info window shows complaint ID, category, urgency
- Filter updates map in <1 second

#### FR7: Complaint Management
- View complaint details:
  - Citizen photo & contact
  - Complaint image and description
  - GPS location, category, urgency
  - Submission time and assigned time
- Update complaint status (Pending → In Progress → Resolved)
- Upload resolution image (proof of action taken)
- Add resolution comments
- Reject complaint with reason (if needed)

**Acceptance Criteria:**
- Status update saves immediately to database
- Officer cannot modify citizen's original complaint details
- Resolution image uploads to S3 successfully
- Notification sent to citizen on status change

#### FR8: Performance Metrics
- View personal performance dashboard:
  - Total complaints assigned
  - Complaints resolved
  - Average resolution time
  - Current workload
- View monthly/weekly performance trends

---

### 3.3 Admin Module

#### FR9: Officer Management
- Add new officer with name, email, phone, employee ID
- View all officers with status (Active, On Leave, Inactive)
- Edit officer details
- Assign officer to wards/areas
- Deactivate/activate officers
- View officer performance metrics

**Acceptance Criteria:**
- Officer added successfully with unique employee ID
- Ward assignment updates officer's territory
- Deactivated officers don't receive new complaints

#### FR10: Ward/Area Management
- Create new ward with name, city, state, boundary polygon
- Edit ward details
- View all wards with officer assignments
- Update ward boundaries (GeoJSON)

**Acceptance Criteria:**
- Ward created with valid GeoJSON boundary
- Officer can be assigned to single ward
- Complaints assigned to officers within ward boundaries

#### FR11: Analytics Dashboard
- Total complaints count (all-time, this month, this week)
- Complaint status distribution (pie chart)
- Complaints by category (bar chart)
- Complaints by urgency level
- Complaint density heatmap by ward/area
- Officer performance leaderboard

**Acceptance Criteria:**
- All charts update in real-time
- Heatmap displays complaint density by location
- Leaderboard shows top 10 officers by resolution count

#### FR12: Report Generation
- Filter complaints by:
  - Date range
  - Status
  - Officer
  - Ward
  - Category
  - Urgency level
- Export reports as PDF and CSV
- Include in report:
  - Complaint list with details
  - Officer performance metrics
  - Average resolution time
  - Category-wise distribution
  - Ward-wise distribution

**Acceptance Criteria:**
- PDF report generates in <5 seconds
- CSV includes all complaint fields
- Report can be filtered with 5+ parameters

#### FR13: System Settings
- Configure system parameters:
  - SMS provider (Twilio)
  - Email service (SendGrid/Gmail)
  - S3 bucket settings
  - Notification preferences
- Manage notification templates
- View system logs and audit trails

---

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
- API response time: <500ms for 95th percentile
- Dashboard load time: <3 seconds
- Map rendering with 1000+ pins: <2 seconds
- Report generation: <5 seconds
- Image compression and upload: <10 seconds

### 4.2 Scalability
- Handle 100+ concurrent users
- Support 500+ complaints per day
- Database optimization for queries >100,000 records
- Horizontal scaling via load balancer (AWS ELB)

### 4.3 Security
- All passwords hashed with bcrypt
- JWT token-based authentication
- HTTPS/TLS encryption for all data in transit
- OWASP Top 10 vulnerability compliance
- SQL injection prevention via parameterized queries
- CORS enabled for frontend origin only
- Rate limiting: 100 requests/minute per IP
- Audit logs for all data modifications

### 4.4 Reliability & Availability
- 99.5% uptime SLA
- Automatic backup of database daily
- Error logging and monitoring (Sentry)
- Graceful degradation on service failure
- Automatic retry for failed notifications (3 retries with exponential backoff)

### 4.5 Data Integrity
- Database transactions for critical operations
- Foreign key constraints on all relationships
- Audit trail for complaint status changes
- Soft deletes for users (keep historical data)

### 4.6 Usability
- Mobile-responsive design (320px - 1920px)
- Accessibility compliance (WCAG 2.1 AA)
- Intuitive navigation and user flows
- Form validation with clear error messages
- Loading indicators and progress bars

---

## 5. External Integrations

### 5.1 AWS Services
- **S3**: Image storage and CDN delivery
- **EC2**: Application server hosting
- **RDS**: PostgreSQL database hosting
- **CloudFront**: Image delivery CDN
- **CloudWatch**: Monitoring and logging

### 5.2 Communication Services
- **Twilio**: SMS notifications
- **SendGrid/Gmail**: Email notifications

### 5.3 Geolocation Services
- **Browser Geolocation API**: Citizen GPS location
- **IPStack API**: IP-based geolocation (fallback)
- **Google Maps API**: Map rendering and distance calculation
- **PostGIS**: Server-side geospatial queries

---

## 6. Database Schema Overview

| Table | Purpose |
|-------|---------|
| users | Store citizen, officer, admin accounts |
| officers | Officer assignments and current location |
| wards | Municipal ward/area definitions |
| complaints | Citizen complaints with GPS coordinates |
| complaint_history | Audit trail of status changes |
| notifications | In-app notification records |
| notification_logs | SMS/Email delivery logs |
| user_preferences | User notification preferences |
| audit_logs | Admin action audit trail |

**Key Design Decisions:**
- PostGIS for geospatial queries (efficiency)
- JSONB columns for flexible metadata storage
- Soft deletes to maintain historical data
- Timestamp tracking for all entities

---

## 7. API Endpoints (Phase 2)

### Authentication
- `POST /api/auth/register` - Register new citizen
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile

### Complaints (Citizen)
- `POST /api/complaints` - Submit new complaint
- `GET /api/complaints` - List citizen's complaints with filters
- `GET /api/complaints/:id` - Get complaint details
- `GET /api/complaints/:id/timeline` - Get complaint status history

### Complaints (Officer)
- `GET /api/officer/complaints` - List assigned complaints
- `PATCH /api/complaints/:id/status` - Update complaint status
- `POST /api/complaints/:id/resolve` - Mark as resolved with image
- `PUT /api/complaints/:id` - Update complaint details

### Officers (Admin)
- `POST /api/officers` - Add new officer
- `GET /api/officers` - List all officers
- `PUT /api/officers/:id` - Edit officer
- `PATCH /api/officers/:id/deactivate` - Deactivate officer

### Reports (Admin)
- `GET /api/reports/complaints` - Generate complaint report

---

## 8. Testing Strategy

### Unit Testing
- Service layer functions (authentication, assignment logic)
- Utility functions (validation, formatting)
- Target coverage: >70%

### Integration Testing
- API endpoints with database
- End-to-end workflows (register → submit → track)
- Authentication and authorization flows

### Performance Testing
- Load test with 100+ concurrent users
- Database query optimization validation
- API response time benchmarking

### Security Testing
- OWASP vulnerability scanning
- SQL injection attempts
- JWT token validation
- Rate limiting verification

---

## 9. Deployment & DevOps

### Infrastructure
- AWS EC2 instance (t3.large)
- PostgreSQL RDS (db.t3.medium)
- S3 bucket for images
- CloudFront CDN
- CloudWatch monitoring

### CI/CD Pipeline
- GitHub Actions for automated testing
- Docker containerization
- Automated deployment on main branch merge
- Database migration automation

### Monitoring & Logging
- CloudWatch for infrastructure metrics
- Sentry for error tracking
- Morgan for API request logging
- Database query performance monitoring

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Citizens submit complaint with image + GPS | <2 minutes |
| Officer receives SMS notification | <10 seconds after submission |
| Officer resolves 80% complaints | Within 48 hours |
| System uptime | 99.5% |
| API response time (95th percentile) | <500ms |
| Mobile responsiveness | All devices 320px-1920px |
| Code coverage | >70% |

---

## 11. Future Enhancements (Phase 2+)

1. **Mobile Native Apps**: React Native for iOS/Android
2. **Real-time Updates**: WebSocket integration for live notifications
3. **Advanced Analytics**: ML-based complaint categorization
4. **Multi-language Support**: i18n for regional languages
5. **Offline Functionality**: Service workers for draft complaints
6. **Video Complaints**: Support for video evidence uploads
7. **Community Features**: Citizen upvoting and commenting on complaints
8. **Integration**: IMDB/Open311 API compatibility

---

**Document Approval:**
- Project Manager: ___________
- Technical Lead: ___________
- Client Representative: ___________

**Date:** ___________
