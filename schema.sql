-- ====================================================================================================
-- SALETEL / FieldSync - Complete Database Schema
-- Run this in your Supabase SQL Editor (New Project)
-- ====================================================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Admin Users Table
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Domains Table
CREATE TABLE IF NOT EXISTS public.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    brand_id UUID,
    icon TEXT,
    color TEXT,
    created_by UUID,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. User Roles Table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

-- Seed Default User Roles if not present
INSERT INTO public.user_roles (name, description) VALUES
    ('Surveyor', 'Field agent capturing on-ground lead submissions'),
    ('Team Lead', 'Supervises field agents, reviews outputs, and reassigns leads'),
    ('Telecaller', 'Follows up on submissions and updates CRM status'),
    ('File Handler', 'Verifies secondary file submissions and clears documentation'),
    ('Manager', 'Executive oversight, operations analytics, and KPI tracking')
ON CONFLICT (name) DO NOTHING;

-- 5. Counters Table
CREATE TABLE IF NOT EXISTS public.counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    location TEXT,
    domain_id UUID REFERENCES public.domains(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Surveyors (Master Staff Table)
CREATE TABLE IF NOT EXISTS public.surveyors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    domain_id UUID REFERENCES public.domains(id) ON DELETE SET NULL,
    user_role_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
    assigned_domains TEXT[],
    assigned_template_ids TEXT[],
    counter_ids TEXT[],
    team_lead_ids TEXT[],
    telecaller_ids TEXT[],
    assigned_users TEXT[],
    assigned_file_template_id UUID,
    location TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Form Templates (Dynamic Forms)
CREATE TABLE IF NOT EXISTS public.form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES public.domains(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    fields JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    is_deleted BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. File Form Templates (Dynamic Secondary Forms)
CREATE TABLE IF NOT EXISTS public.file_form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    fields JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Submissions (Master Submissions & Leads)
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_template_id UUID REFERENCES public.form_templates(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES public.domains(id) ON DELETE CASCADE,
    surveyor_id UUID REFERENCES public.surveyors(id) ON DELETE SET NULL,
    telecaller_id UUID REFERENCES public.surveyors(id) ON DELETE SET NULL,
    data JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'submitted',
    lead_status TEXT DEFAULT 'new',
    lead_status_updated_at TIMESTAMPTZ,
    telecaller_remark TEXT,
    admin_notes TEXT,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    device_info TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID
);

-- 10. File Submissions (Secondary Verification)
CREATE TABLE IF NOT EXISTS public.file_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_form_template_id UUID REFERENCES public.file_form_templates(id) ON DELETE CASCADE,
    file_handler_id UUID REFERENCES public.surveyors(id) ON DELETE SET NULL,
    original_lead_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
    data JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'submitted',
    submitted_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Lead Call Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS public.lead_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
    telecaller_id UUID REFERENCES public.surveyors(id) ON DELETE SET NULL,
    previous_status TEXT,
    new_status TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_submissions_domain_id ON public.submissions(domain_id);
CREATE INDEX IF NOT EXISTS idx_submissions_surveyor_id ON public.submissions(surveyor_id);
CREATE INDEX IF NOT EXISTS idx_submissions_telecaller_id ON public.submissions(telecaller_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_lead_status ON public.submissions(lead_status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON public.submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_submissions_lead_id ON public.file_submissions(original_lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_call_logs_submission_id ON public.lead_call_logs(submission_id);

-- 13. Create Storage Bucket for Uploads (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 14. Storage Policies: Allow Public Access to uploads bucket
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow Uploads'
    ) THEN
        CREATE POLICY "Allow Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow Update'
    ) THEN
        CREATE POLICY "Allow Update" ON storage.objects FOR UPDATE USING (bucket_id = 'uploads');
    END IF;
END $$;

-- 15. Brands Table
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. Regions Table
CREATE TABLE IF NOT EXISTS public.regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. Pending Approvals Table
CREATE TABLE IF NOT EXISTS public.pending_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved BOOLEAN DEFAULT false
);
