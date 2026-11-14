# Smart Garbage Reporting System - Backend Setup Guide

## Project Structure

```
smart-garbage-backend/
├── src/
│   ├── config/
│   │   └── database.js          # PostgreSQL connection
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   ├── errorHandler.js      # Global error handling
│   │   └── validator.js         # Request validation
│   ├── services/
│   │   ├── authService.js       # Auth logic
│   │   ├── complaintService.js  # Complaint logic
│   │   ├── assignmentService.js # Geolocation assignment
│   │   └── notificationService.js
│   ├── routes/
│   │   ├── auth.js              # Auth endpoints
│   │   ├── complaints.js        # Complaint endpoints
│   │   ├── officers.js          # Officer endpoints
│   │   └── admin.js             # Admin endpoints
│   ├── controllers/
│   └── utils/
├── database/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   └── 002_sample_data.sql
│   └── seeds/
├── .env.example                 # Environment template
├── package.json
└── README.md
```

## Installation & Setup

### 1. Install Dependencies
```bash
cd smart-garbage-backend
npm install
```

### 1.1 Install Garbage Classifier Dependencies (Python)
```bash
pip install -r scripts/requirements.txt
```

This service uses `garbage_classifier.h5` from the workspace root to classify uploaded complaint photos and save the predicted garbage type in complaint `category`.

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

Add/update these classifier variables in `.env`:
```bash
PYTHON_EXECUTABLE=python
GARBAGE_MODEL_PATH=../garbage_classifier.h5
GARBAGE_CLASS_LABELS=garbage_heap,litter,dumping_site
```

For standalone local file storage (no AWS required), set:
```bash
STORAGE_PROVIDER=local
PUBLIC_FILE_BASE_URL=http://localhost:5000
```

Uploaded complaint images will be saved under `smart-garbage-backend/uploads/` and served from `/uploads/*`.

### 3. Database Setup

#### Option A: Using PostgreSQL (Recommended)
```bash
# Create database
createdb smart_garbage_db -U postgres

# Enable PostGIS extension
psql -U postgres -d smart_garbage_db -c "CREATE EXTENSION postgis;"

# Run migrations
psql -U postgres -d smart_garbage_db -f database/migrations/001_initial_schema.sql
psql -U postgres -d smart_garbage_db -f database/migrations/004_add_ai_classification_fields.sql

# Seed sample data
psql -U postgres -d smart_garbage_db -f database/migrations/002_sample_data.sql
```

#### Option B: Using Docker (Recommended for local development)
```bash
docker-compose up -d
```

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: smart_garbage_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### 4. Start Development Server
```bash
npm run dev
```

Server runs on `http://localhost:5000`

### 5. Test API
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Smart Garbage Reporting API is running",
  "timestamp": "2026-03-05T12:00:00.000Z"
}
```

---

## Phase 2: Backend API Development

### Endpoints to Implement

#### Authentication
- `POST /api/auth/register` - Register new citizen
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get profile
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/change-password` - Change password

#### Complaints (Citizen)
- `POST /api/complaints` - Submit complaint
- `GET /api/complaints` - List complaints
- `GET /api/complaints/:id` - Get complaint details
- `GET /api/complaints/:id/timeline` - Get status history

#### Complaints (Officer)
- `GET /api/officer/complaints` - List assigned complaints
- `PATCH /api/complaints/:id/status` - Update status
- `POST /api/complaints/:id/resolve` - Resolve complaint

#### Officers & Admin
- `POST /api/officers` - Add officer
- `GET /api/officers` - List officers
- `GET /api/reports/complaints` - Generate report

---

## Testing

Run unit tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage
```

---

## Deployment

### Build for Production
```bash
npm run build
```

### Run Production Server
```bash
NODE_ENV=production npm start
```

### Deploy to AWS
```bash
# Create EC2 instance with Node.js
# Install dependencies and run start script
npm install --production
npm start
```

---

## Troubleshooting

### Connection refused on port 5432
- Ensure PostgreSQL is running
- Check database credentials in .env

### PostGIS extension not available
```bash
psql -U postgres -d smart_garbage_db
CREATE EXTENSION postgis;
```

### Port 5000 already in use
```bash
# Change PORT in .env or kill existing process
kill -9 $(lsof -t -i:5000)
```

---

## Documentation

- [SRS Document](../docs/SRS.md)
- [API Documentation](#) (Coming in Phase 2)
- [Database Schema](#) (See migrations)

---

**Next Steps:** Begin Phase 2 - Backend API Development
