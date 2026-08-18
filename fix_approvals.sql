-- Run this in the Supabase SQL Editor to fix the approval error
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_reviewed_by_fkey;
