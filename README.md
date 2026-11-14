# Smart Garbage Reporting & Municipality Automation System
## Complete Project Setup Guide

**Project Date:** March 5, 2026  
**Status:** Phase 1-2 Complete - Backend Foundation Ready

---

## 📁 Project Structure

```
TDPCL/
├── docs/
│   └── SRS.md                           # Software Requirements Specification
├── smart-garbage-backend/               # Node.js + Express API
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js             # PostgreSQL + PostGIS connection
│   │   ├── middleware/
│   │   │   ├── auth.js                 # JWT authentication
│   │   │   ├── errorHandler.js         # Error handling
│   │   │   └── validator.js            # Request validation
│   │   ├── services/
│   │   │   ├── authService.js          # Authentication logic
│   │   │   ├── complaintService.js     # Complaint operations
│   │   │   ├── assignmentService.js    # Geolocation assignment
│   │   │   └── notificationService.js  # SMS/Email notifications
│   │   ├── routes/
│   │   │   ├── auth.js                 # Auth endpoints
│   │   │   ├── complaints.js           # Complaint endpoints
│   │   │   ├── officers.js             # Officer management
│   │   │   └── admin.js                # Admin dashboard
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── utils/
│   │   └── index.js                    # Main server file
│   ├── database/
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.sql  # Database schema with PostGIS
│   │   │   └── 002_sample_data.sql     # Sample test data
│   │   ├── seeds/
│   │   └── backups/
│   ├── .env.example                    # Environment template
│   ├── .gitignore
│   ├── package.json
│   └── README.md
├── smart-garbage-frontend/              # React.js Frontend
│   ├── public/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Auth/                   # Login/Register pages
│   │   │   ├── Citizen/                # Citizen dashboard
│   │   │   ├── Officer/                # Officer dashboard
│   │   │   └── Admin/                  # Admin dashboard
│   │   ├── components/
│   │   │   ├── Map.jsx                 # Map integration
│   │   │   ├── ComplaintForm.jsx
│   │   │   └── ...other components
│   │   ├── context/
│   │   │   └── AuthContext.jsx         # Authentication context
│   │   ├── services/
│   │   │   └── api.js                  # Axios API client
│   │   ├── utils/
│   │   │   └── locationUtils.js        # Geolocation utilities
│   │   ├── styles/
│   │   └── App.jsx
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── README.md
└── README.md                            # This file
```

---

## 🚀 Quick Start

### Backend Setup

```bash
# Navigate to backend
cd smart-garbage-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# Create PostgreSQL database
createdb smart_garbage_db -U postgres

# Enable PostGIS extension
psql -U postgres -d smart_garbage_db -c "CREATE EXTENSION postgis;"

# Run database migrations
psql -U postgres -d smart_garbage_db -f database/migrations/001_initial_schema.sql

# Seed sample data
psql -U postgres -d smart_garbage_db -f database/migrations/002_sample_data.sql

# Start development server
npm run dev
```

Server will be available at: **http://localhost:5000**

### Frontend Setup

```bash
# Navigate to frontend
cd smart-garbage-frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Add: REACT_APP_API_URL=http://localhost:5000/api

# Start development server
npm start
```

Frontend will be available at: **http://localhost:3000**

---

## 📊 Database Setup

### Using Docker (Recommended)

Create `docker-compose.yml` in root directory:

```yaml
version: '3.8'
services:
  postgres:
    image: postgis/postgis:15-3.3
    container_name: smart_garbage_db
    environment:
      POSTGRES_DB: smart_garbage_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./smart-garbage-backend/database/migrations:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    container_name: smart_garbage_redis
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

Run:
```bash
docker-compose up -d
```

### Using PostgreSQL Directly

**Prerequisites:**
- PostgreSQL 14+ installed
- PostGIS extension available

**Setup:**
```bash
# Create superuser (if not exists)
createuser -s postgres

# Create database
createdb smart_garbage_db -U postgres

# Enable PostGIS
psql -U postgres -d smart_garbage_db -c "CREATE EXTENSION postgis;"

# Run migrations
psql -U postgres -d smart_garbage_db -f smart-garbage-backend/database/migrations/001_initial_schema.sql
psql -U postgres -d smart_garbage_db -f smart-garbage-backend/database/migrations/002_sample_data.sql
```

---

## 🔑 Environment Variables

### Backend (.env)
```
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smart_garbage_db
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your_secret_key_here
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_MAPBOX_TOKEN=your_mapbox_token
```

---

## 📚 API Endpoints (Phase 2)

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new citizen |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/profile` | Get user profile |
| PUT | `/api/auth/profile` | Update user profile |
| POST | `/api/auth/change-password` | Change password |

### Complaints (Citizen)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/complaints` | Submit new complaint |
| GET | `/api/complaints` | List user's complaints |
| GET | `/api/complaints/:id` | Get complaint details |

### Complaints (Officer)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/officer/complaints` | List assigned complaints |
| PATCH | `/api/complaints/:id/status` | Update complaint status |
| POST | `/api/complaints/:id/resolve` | Mark as resolved |

### Officers (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/officers` | Add new officer |
| GET | `/api/officers` | List all officers |
| PUT | `/api/officers/:id` | Edit officer |

### Reports (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/complaints` | Generate complaint report |

---

## 🧪 Testing

### Backend Tests
```bash
cd smart-garbage-backend
npm test                    # Run all tests
npm test -- --coverage     # Run with coverage
npm test -- --watch        # Watch mode
```

### Frontend Tests
```bash
cd smart-garbage-frontend
npm test                    # Run all tests
npm test -- --coverage     # Run with coverage
```

---

## 📋 Implementation Checklist

### ✅ Phase 1: Foundation (Weeks 1-2)
- [x] Project structure setup
- [x] Database schema with PostGIS
- [x] SRS documentation
- [x] Backend environment configuration
- [x] Git version control setup

### 🔄 Phase 2: Backend API (Weeks 3-4) - IN PROGRESS
- [x] Express server setup
- [x] JWT authentication middleware
- [x] Auth service (register, login, profile)
- [x] Auth routes
- [x] Error handling middleware
- [ ] Complaint service
- [ ] Complaint routes
- [ ] Image upload to S3
- [ ] Officer service
- [ ] Admin routes

### 📅 Phase 3: Geolocation & Assignment (Week 5)
- [ ] PostGIS distance calculations
- [ ] Officer assignment algorithm
- [ ] Assignment service
- [ ] Assignment routes

### 📬 Phase 4: Notifications (Week 6)
- [ ] Twilio SMS integration
- [ ] Email service
- [ ] Notification queue (Bull)
- [ ] Notification service

### 🎨 Phase 5: Frontend - Citizen (Week 7)
- [ ] React app setup
- [ ] Login/Register pages
- [ ] Complaint form with image upload
- [ ] Complaint tracker
- [ ] Map integration

### 📊 Phase 6: Dashboard Development (Week 8)
- [ ] Officer dashboard
- [ ] Admin dashboard
- [ ] Analytics charts
- [ ] Report generation

### 🧪 Phase 7: Testing (Week 9)
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Performance testing

### 🚀 Phase 8: Deployment (Week 10)
- [ ] AWS infrastructure setup
- [ ] CI/CD pipeline
- [ ] Production deployment
- [ ] Monitoring setup

---

## 🔍 Currently Completed

### Backend
✅ Express server with middleware
✅ JWT authentication system
✅ Auth service (register, login, profile)
✅ Auth API routes
✅ PostgreSQL with PostGIS setup
✅ Error handling
✅ Request validation

### Frontend
✅ Project structure
✅ Context API for authentication
✅ API client with interceptors
✅ Location utilities

### Documentation
✅ SRS document
✅ Database schema
✅ Backend setup guide

---

## 🎯 Next Steps

1. **Complete Phase 2B:**
   - Implement complaint service and routes
   - Add S3 image upload functionality
   - Create officer and admin routes

2. **Start Phase 3:**
   - Implement PostGIS assignment algorithm
   - Test geolocation accuracy

3. **Setup Frontend:**
   - Create login/register pages
   - Build complaint form with GPS
   - Implement complaint tracker

---

## 📞 Support & Resources

- [PostgreSQL PostGIS Documentation](https://postgis.net/docs/)
- [Express.js Guide](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [Mapbox GL Documentation](https://docs.mapbox.com/mapbox-gl-js/)
- [Twilio Documentation](https://www.twilio.com/docs/)

---

## 📝 Notes

- All passwords are hashed with bcrypt
- JWT tokens expire in 24 hours
- PostGIS is used for efficient geospatial queries
- S3 is used for image storage
- Redis is used for notification queue
- All API responses follow standard format: `{ success: boolean, data/error, message }`

---

## 🔗 Useful Commands

```bash
# Start all services (backend + frontend)
npm run dev:all              # (requires setup in root package.json)

# View database
psql -U postgres -d smart_garbage_db
\dt                          # List tables
\d complaints                # View table structure

# Kill port if needed
kill -9 $(lsof -t -i:5000)   # Kill backend
kill -9 $(lsof -t -i:3000)   # Kill frontend

# View logs
docker-compose logs -f postgres
docker-compose logs -f redis
```

---

**Last Updated:** March 5, 2026  
**Status:** Phase 1-2 Active  
**Next Review:** End of Week 2
