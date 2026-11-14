-- Sample Data for Testing
-- Run after schema creation: psql -U postgres -d smart_garbage_db -f migrations/002_sample_data.sql

-- Sample Users (Citizens)
INSERT INTO users (name, email, phone, password_hash, role, status) VALUES
('Raj Kumar', 'raj@example.com', '9876543210', '$2a$10$DixjxQI5nxfvXZbETo7R.OhL0jHZVZ3Q5pZj5Z3Z3Z3Z3Z3Z3', 'citizen', 'active'),
('Priya Singh', 'priya@example.com', '9876543211', '$2a$10$DixjxQI5nxfvXZbETo7R.OhL0jHZVZ3Q5pZj5Z3Z3Z3Z3Z3Z3', 'citizen', 'active'),
('Amit Patel', 'amit@example.com', '9876543212', '$2a$10$DixjxQI5nxfvXZbETo7R.OhL0jHZVZ3Q5pZj5Z3Z3Z3Z3Z3Z3', 'citizen', 'active');

-- Sample Ward
INSERT INTO wards (name, city, state, boundaries) VALUES
('Ward 1', 'Mumbai', 'Maharashtra', ST_GeomFromText('POLYGON((72.8 19.0, 72.9 19.0, 72.9 19.1, 72.8 19.1, 72.8 19.0))', 4326)),
('Ward 2', 'Mumbai', 'Maharashtra', ST_GeomFromText('POLYGON((73.0 19.0, 73.1 19.0, 73.1 19.1, 73.0 19.1, 73.0 19.0))', 4326));

-- Sample Officer User
INSERT INTO users (name, email, phone, password_hash, role, status) VALUES
('Vijay Officer', 'vijay@officer.com', '9876543220', '$2a$10$DixjxQI5nxfvXZbETo7R.OhL0jHZVZ3Q5pZj5Z3Z3Z3Z3Z3Z3', 'officer', 'active');

-- Sample Officer Assignment
INSERT INTO officers (user_id, employee_id, assigned_ward_id, assigned_area_name, year_of_joining, status, location) VALUES
(4, 'OFF001', 1, 'Ward 1 - Central', 2020, 'active', ST_GeomFromText('POINT(72.85 19.05)', 4326));

-- Sample Admin User
INSERT INTO users (name, email, phone, password_hash, role, status) VALUES
('Admin User', 'admin@example.com', '9876543230', '$2a$10$DixjxQI5nxfvXZbETo7R.OhL0jHZVZ3Q5pZj5Z3Z3Z3Z3Z3Z3', 'admin', 'active');

-- Sample Complaints
INSERT INTO complaints (user_id, title, description, image_path, location, latitude, longitude, area, ward_id, category, urgency_level, status) VALUES
(1, 'Garbage Heap on Main Street', 'Large pile of garbage blocking the road', 'https://s3.amazonaws.com/images/complaint1.jpg', ST_GeomFromText('POINT(72.85 19.05)', 4326), 19.05, 72.85, 'Ward 1', 1, 'garbage_heap', 'high', 'new'),
(2, 'Litter on Footpath', 'Scattered waste on the footpath', 'https://s3.amazonaws.com/images/complaint2.jpg', ST_GeomFromText('POINT(72.87 19.07)', 4326), 19.07, 72.87, 'Ward 1', 1, 'litter', 'medium', 'new'),
(3, 'Illegal Dumping Site', 'Illegal waste dumping near residential area', 'https://s3.amazonaws.com/images/complaint3.jpg', ST_GeomFromText('POINT(73.05 19.05)', 4326), 19.05, 73.05, 'Ward 2', 2, 'dumping_site', 'high', 'new');

-- Sample Notification Preferences
INSERT INTO user_preferences (user_id, sms_enabled, email_enabled, push_enabled, sms_phone) VALUES
(1, TRUE, TRUE, TRUE, '7348554358'),
(2, TRUE, TRUE, TRUE, '9876543211'),
(3, TRUE, TRUE, TRUE, '9876543212'),
(4, TRUE, TRUE, TRUE, '9876543220');
