-- Add test users for development
INSERT INTO users (name, email, phone, password_hash, role, status) VALUES
('Citizen User', 'citizen@example.com', '9876543210', '$2a$10$WbBxGhjXl2GhGxpMYf3gYez33WoOjlVj/8Qs1vfpfLu7HSJR8hqIK', 'citizen', 'active'),
('Officer User', 'officer@example.com', '9876543211', '$2a$10$WbBxGhjXl2GhGxpMYf3gYez33WoOjlVj/8Qs1vfpfLu7HSJR8hqIK', 'officer', 'active'),
('Admin User', 'admin@example.com', '9876543212', '$2a$10$WbBxGhjXl2GhGxpMYf3gYez33WoOjlVj/8Qs1vfpfLu7HSJR8hqIK', 'admin', 'active');
