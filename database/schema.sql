CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) UNIQUE,
  phone VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(16) NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  sport VARCHAR(16) NOT NULL CHECK (sport IN ('Futsal', 'Badminton', 'Tenis')),
  description VARCHAR(255) NOT NULL DEFAULT '',
  price_off_peak NUMERIC(12, 2) NOT NULL,
  price_peak NUMERIC(12, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_courts_sport_active
  ON courts (sport, is_active);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  court_id INTEGER NOT NULL REFERENCES courts (id) ON DELETE RESTRICT,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
  notes VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_bookings_time CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_bookings_court_schedule
  ON bookings (court_id, booking_date, status, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status_created
  ON bookings (status, created_at);

INSERT INTO courts (name, sport, description, price_off_peak, price_peak)
VALUES
  ('Arena Futsal A', 'Futsal', 'Rumput sintetis premium · 5 lawan 5', 150000, 220000),
  ('Arena Futsal B', 'Futsal', 'Lapangan indoor · ruang ganti tersedia', 130000, 200000),
  ('Badminton Court 1', 'Badminton', 'Lantai vinyl · pencahayaan turnamen', 60000, 90000),
  ('Badminton Court 2', 'Badminton', 'Lantai kayu · shuttlecock tersedia', 55000, 85000),
  ('Tennis Court 1', 'Tenis', 'Lapangan hard court outdoor', 100000, 160000),
  ('Tennis Court 2', 'Tenis', 'Lapangan sintetis · penyewaan raket tersedia', 90000, 150000)
ON CONFLICT (name) DO NOTHING;
