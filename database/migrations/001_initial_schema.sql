-- PARKING SYSTEM AGENTIC AI FACTORY - INITIAL SCHEMA (v1.0.0)
-- PostgreSQL DDL Migration 001

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom Domain Types & Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('DRIVER', 'ADMIN', 'ATTENDANT', 'SECURITY_OFFICER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE vehicle_type AS ENUM ('COMPACT', 'SEDAN', 'SUV', 'EV', 'MOTORCYCLE', 'ACCESSIBLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE slot_status AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'DISABLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reservation_status AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('INITIATED', 'SUCCEEDED', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE security_severity AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'DRIVER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. VEHICLES
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    plate_number VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type vehicle_type NOT NULL DEFAULT 'SEDAN',
    make_model VARCHAR(100),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. PARKING_AREAS
CREATE TABLE IF NOT EXISTS parking_areas (
    area_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    location TEXT NOT NULL,
    total_capacity INT NOT NULL CHECK (total_capacity > 0),
    base_hourly_rate NUMERIC(10, 2) NOT NULL CHECK (base_hourly_rate >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. PARKING_SLOTS
CREATE TABLE IF NOT EXISTS parking_slots (
    slot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_id UUID NOT NULL REFERENCES parking_areas(area_id) ON DELETE CASCADE,
    slot_number VARCHAR(20) NOT NULL,
    slot_type vehicle_type NOT NULL DEFAULT 'SEDAN',
    floor_number INT NOT NULL DEFAULT 1,
    status slot_status NOT NULL DEFAULT 'AVAILABLE',
    UNIQUE (area_id, slot_number)
);

-- 5. RESERVATIONS
CREATE TABLE IF NOT EXISTS reservations (
    reservation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    vehicle_id UUID NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT,
    slot_id UUID NOT NULL REFERENCES parking_slots(slot_id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    qr_code_hash VARCHAR(64) UNIQUE NOT NULL,
    status reservation_status NOT NULL DEFAULT 'PENDING_PAYMENT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time)
);

-- 6. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID UNIQUE NOT NULL REFERENCES reservations(reservation_id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL,
    status payment_status NOT NULL DEFAULT 'INITIATED',
    transaction_ref VARCHAR(100) UNIQUE,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. PARKING_LOGS
CREATE TABLE IF NOT EXISTS parking_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    slot_id UUID REFERENCES parking_slots(slot_id) ON DELETE SET NULL,
    entry_gate VARCHAR(50) NOT NULL,
    exit_gate VARCHAR(50),
    entry_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    exit_time TIMESTAMPTZ,
    total_duration_minutes NUMERIC(10, 2)
);

-- 8. SENSOR_DATA
CREATE TABLE IF NOT EXISTS sensor_data (
    sensor_record_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sensor_id VARCHAR(50) NOT NULL,
    slot_id UUID NOT NULL REFERENCES parking_slots(slot_id) ON DELETE CASCADE,
    status slot_status NOT NULL,
    battery_level NUMERIC(4, 2),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. SECURITY_LOGS
CREATE TABLE IF NOT EXISTS security_logs (
    security_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(vehicle_id) ON DELETE SET NULL,
    camera_id VARCHAR(50),
    event_type VARCHAR(50) NOT NULL,
    severity security_severity NOT NULL DEFAULT 'LOW',
    description TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. AGENT_LOGS
CREATE TABLE IF NOT EXISTS agent_logs (
    agent_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id VARCHAR(100),
    agent_name VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    request_payload JSONB,
    result_payload JSONB,
    execution_latency_ms INT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SENT',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parking_slots_area_status ON parking_slots(area_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_user_dates ON reservations(user_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_sensor_data_slot_ts ON sensor_data(slot_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_parking_logs_vehicle_entry ON parking_logs(vehicle_id, entry_time);
CREATE INDEX IF NOT EXISTS idx_agent_logs_conv ON agent_logs(conversation_id, timestamp);
