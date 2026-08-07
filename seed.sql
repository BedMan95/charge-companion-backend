INSERT INTO users (id, name, email, password, created_at)
VALUES ('admin-123', 'Admin User', 'admin@example.com', 'password123', strftime('%s','now') * 1000);
