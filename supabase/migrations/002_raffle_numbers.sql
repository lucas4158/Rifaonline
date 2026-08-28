-- Migration: 002_raffle_numbers.sql
-- Description: Creates the raffle_numbers table for public read replication and real-time updates

CREATE TABLE IF NOT EXISTS raffle_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raffle_id TEXT NOT NULL,
    number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    order_id TEXT,
    is_bonus BOOLEAN DEFAULT FALSE,
    reserved_until BIGINT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_raffle_number UNIQUE (raffle_id, number)
);

CREATE INDEX IF NOT EXISTS idx_raffle_numbers_raffle_id ON raffle_numbers(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_status ON raffle_numbers(status);
CREATE INDEX IF NOT EXISTS idx_raffle_numbers_updated_at ON raffle_numbers(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE raffle_numbers ENABLE ROW LEVEL SECURITY;

-- Allow public read access to raffle numbers
CREATE POLICY "Public read raffle_numbers" ON raffle_numbers
    FOR SELECT
    USING (true);

-- Enable Realtime publication for raffle_numbers
ALTER PUBLICATION supabase_realtime ADD TABLE raffle_numbers;
