-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New Query)
-- Adds a snapshot column to net_worth_history for tracking per-asset, per-debt,
-- and per-goal values at each point in time.

ALTER TABLE net_worth_history
ADD COLUMN IF NOT EXISTS snapshot JSONB;
