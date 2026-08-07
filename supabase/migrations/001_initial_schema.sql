-- Migration: 001_initial_schema.sql
-- Description: Initial schema for RifaMaster hybrid Supabase storage (purchase_history, audit_logs, draws, admin_notifications, activity_logs)

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. purchase_history
CREATE TABLE IF NOT EXISTS purchase_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_order_id TEXT UNIQUE NOT NULL,
    raffle_id TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    amount NUMERIC(12, 2) DEFAULT 0.00,
    payment_id TEXT,
    payment_status TEXT,
    purchase_status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_history_raffle_id ON purchase_history(raffle_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_firestore_order_id ON purchase_history(firestore_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_payment_id ON purchase_history(payment_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_created_at ON purchase_history(created_at DESC);

-- 2. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    actor_id TEXT,
    actor_name TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_raffle_id ON audit_logs(raffle_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 3. draws
CREATE TABLE IF NOT EXISTS draws (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_draw_id TEXT UNIQUE,
    raffle_id TEXT NOT NULL,
    status TEXT NOT NULL,
    method TEXT,
    seed TEXT,
    winner_number TEXT,
    winner_name TEXT,
    participants_count INTEGER DEFAULT 0,
    participants_hash TEXT,
    algorithm_version TEXT DEFAULT 'SHA-256',
    seed_version TEXT DEFAULT 'v1',
    executed_by TEXT,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draws_raffle_id ON draws(raffle_id);
CREATE INDEX IF NOT EXISTS idx_draws_firestore_draw_id ON draws(firestore_draw_id);
CREATE INDEX IF NOT EXISTS idx_draws_status ON draws(status);

-- 4. admin_notifications
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_event_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    amount NUMERIC(12, 2) DEFAULT 0.00,
    raffle_id TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_raffle_id ON admin_notifications(raffle_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);

-- 5. activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_raffle_id ON activity_logs(raffle_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS on all tables to deny public access by default
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Note: No PUBLIC or ANON policies are added for INSERT/UPDATE/DELETE.
-- All operations are performed server-side via the service_role key, which bypasses RLS.
