-- Timesheets Database Backup
-- Generated: 2026-06-03 07:09:34 UTC
-- Database: Supabase PostgreSQL

-- ================================================
-- TABLE SCHEMAS
-- ================================================

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Brands Table
CREATE TABLE IF NOT EXISTS public.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    logo_url text DEFAULT ''::text,
    logo_path text,
    brand_color text DEFAULT '#333333'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brands_pkey PRIMARY KEY (id),
    CONSTRAINT brands_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    allocated_hours_per_month numeric DEFAULT 0 NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    brand_id uuid,
    recording_type text DEFAULT 'allocation'::text NOT NULL,
    CONSTRAINT clients_pkey PRIMARY KEY (id),
    CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT clients_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL,
    CONSTRAINT clients_recording_type_check CHECK ((recording_type = ANY (ARRAY['allocation'::text, 'open'::text])))
);

-- Time Entries Table
CREATE TABLE IF NOT EXISTS public.time_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    date date NOT NULL,
    hours numeric NOT NULL,
    description text NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    month text NOT NULL,
    year integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT time_entries_pkey PRIMARY KEY (id),
    CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT time_entries_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE
);

-- Monthly Allocations Table
CREATE TABLE IF NOT EXISTS public.monthly_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    month text NOT NULL,
    year integer NOT NULL,
    allocated_hours numeric DEFAULT 0 NOT NULL,
    rollover_hours numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT monthly_allocations_pkey PRIMARY KEY (id),
    CONSTRAINT monthly_allocations_user_client_month_key UNIQUE (user_id, client_id, month),
    CONSTRAINT monthly_allocations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT monthly_allocations_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE
);

-- File Attachments Table
CREATE TABLE IF NOT EXISTS public.file_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    time_entry_id uuid NOT NULL,
    file_name text NOT NULL,
    display_name text NOT NULL,
    file_url text NOT NULL,
    file_path text NOT NULL,
    file_type text,
    file_size bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT file_attachments_pkey PRIMARY KEY (id),
    CONSTRAINT file_attachments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT file_attachments_time_entry_id_fkey FOREIGN KEY (time_entry_id) REFERENCES public.time_entries(id) ON DELETE CASCADE
);

-- User Settings Table
CREATE TABLE IF NOT EXISTS public.user_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_logo_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_logo_url text,
    CONSTRAINT user_settings_pkey PRIMARY KEY (id),
    CONSTRAINT user_settings_user_id_key UNIQUE (user_id),
    CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Signup Requests Table
CREATE TABLE IF NOT EXISTS public.signup_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    CONSTRAINT signup_requests_pkey PRIMARY KEY (id),
    CONSTRAINT signup_requests_email_key UNIQUE (email),
    CONSTRAINT signup_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

-- ================================================
-- TABLE DATA
-- ================================================

-- Brands Data
INSERT INTO public.brands (id, user_id, name, logo_url, logo_path, brand_color, created_at, updated_at) VALUES
('c988944f-1f5a-4c58-a411-b92ea50456e9', '4cf49f8c-796b-4446-8231-28c6a392a4e6', 'Dino Media', 'https://wzfxupwyysarzyegpuss.supabase.co/storage/v1/object/public/brand-logos/4cf49f8c-796b-4446-8231-28c6a392a4e6/1768702199144-BlueCircle.png', '4cf49f8c-796b-4446-8231-28c6a392a4e6/1768702199553-BlueCircle.png', '#0188a9', '2026-01-18 02:09:59.663656+00', '2026-01-18 02:09:59.663656+00'),
('3fccffdc-15d2-4d87-8bf5-77ccb2f5b985', '4cf49f8c-796b-4446-8231-28c6a392a4e6', 'Dean Player', '', NULL, '#333333', '2026-01-18 02:21:28.933165+00', '2026-01-18 02:21:28.933165+00');

-- Clients Data
INSERT INTO public.clients (id, user_id, name, allocated_hours_per_month, tags, archived, created_at, updated_at, brand_id, recording_type) VALUES
('3cedc984-60e8-45e6-88b8-a75459dcd000', '4cf49f8c-796b-4446-8231-28c6a392a4e6', 'New Enterprise Retail', 7.00, '["Bristol Airguns", "Bristol Fireworks"]', false, '2025-11-03 09:59:58.758314+00', '2026-01-18 02:46:41.912+00', 'c988944f-1f5a-4c58-a411-b92ea50456e9', 'allocation'),
('6ee3e51b-0653-4c9c-b742-51d13e2d821b', '4cf49f8c-796b-4446-8231-28c6a392a4e6', 'Will Blears', 0.00, '["OP", "DSM"]', false, '2026-01-18 07:37:22.160621+00', '2026-01-18 07:57:24.687+00', '3fccffdc-15d2-4d87-8bf5-77ccb2f5b985', 'open'),
('4caab5a8-1693-48af-a5c6-14b8876afc53', '4cf49f8c-796b-4446-8231-28c6a392a4e6', 'The Clifton Club', 4.00, '["Website"]', false, '2025-11-03 08:49:48.767396+00', '2026-01-18 08:14:28.138+00', 'c988944f-1f5a-4c58-a411-b92ea50456e9', 'allocation'),
('793f7228-d123-4505-9805-c7c2c2d73a4a', '4cf49f8c-796b-4446-8231-28c6a392a4e6', 'EDX Medical', 225.00, '["Portal"]', false, '2026-04-30 16:58:36.01874+00', '2026-05-01 06:59:56.681+00', 'c988944f-1f5a-4c58-a411-b92ea50456e9', 'allocation');

-- Monthly Allocations Data (15 records)
INSERT INTO public.monthly_allocations (id, user_id, client_id, month, year, allocated_hours, rollover_hours, created_at, updated_at) VALUES
('1129b07f-415a-43d5-bdb6-f9ad09135c80', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '3cedc984-60e8-45e6-88b8-a75459dcd000', '2025-10', 2025, 7.00, -11.25, '2025-11-03 10:24:15.221273+00', '2025-11-03 10:24:15.221273+00'),
('3c30d887-49b8-4316-a66d-89f9410fbfc3', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '3cedc984-60e8-45e6-88b8-a75459dcd000', '2025-11', 2025, 7.00, -11.25, '2025-11-03 10:42:31.193183+00', '2025-11-03 10:42:31.193183+00'),
('ff6bf64d-9e12-4843-8ef8-b420848d674b', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '4caab5a8-1693-48af-a5c6-14b8876afc53', '2025-11', 2025, 4.00, 0.50, '2025-11-03 10:42:30.894053+00', '2025-11-03 10:42:30.894053+00'),
('b60242bd-0c8c-4fde-a6b9-aff3c4aa7490', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '4caab5a8-1693-48af-a5c6-14b8876afc53', '2025-12', 2025, 4.00, 1.50, '2025-12-04 13:33:31.326065+00', '2025-12-04 13:33:31.326065+00'),
('c0d44231-0469-4dbf-9f90-e7885c695f4f', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '3cedc984-60e8-45e6-88b8-a75459dcd000', '2025-12', 2025, 7.00, -15.25, '2025-12-04 13:33:47.824237+00', '2025-12-04 13:33:47.824237+00'),
('36baadb4-18f5-489d-9e2e-a5fd70b477b0', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '3cedc984-60e8-45e6-88b8-a75459dcd000', '2026-01', 2026, 7.00, -11.25, '2026-01-05 20:45:05.851034+00', '2026-01-05 20:45:05.851034+00'),
('fb088e6d-61a4-42d3-b021-20265b152603', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '4caab5a8-1693-48af-a5c6-14b8876afc53', '2026-01', 2026, 4.00, -2.25, '2026-01-05 20:45:22.885406+00', '2026-01-05 20:45:22.885406+00'),
('1e99ac67-c71f-46d0-a834-e6297eb1a2e7', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '3cedc984-60e8-45e6-88b8-a75459dcd000', '2026-02', 2026, 7.00, -16.50, '2026-02-04 18:50:36.494898+00', '2026-02-04 18:50:36.494898+00'),
('8fb6464f-c17d-45cf-b663-e37e2e22c7ce', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '4caab5a8-1693-48af-a5c6-14b8876afc53', '2026-02', 2026, 4.00, -0.75, '2026-02-04 18:51:13.955496+00', '2026-02-04 18:51:13.955496+00'),
('725d49c4-ad61-4329-83fa-f90dbd7cf5ce', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '4caab5a8-1693-48af-a5c6-14b8876afc53', '2026-03', 2026, 4.00, 0.75, '2026-03-02 14:00:56.885268+00', '2026-03-02 14:00:56.885268+00'),
('8bf5fc54-209d-4695-80f3-23d6d62a233e', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '3cedc984-60e8-45e6-88b8-a75459dcd000', '2026-03', 2026, 7.00, -17.50, '2026-03-09 20:20:10.784714+00', '2026-03-09 20:20:10.784714+00'),
('c82587cb-e5f7-4bea-809b-7964d8774537', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '4caab5a8-1693-48af-a5c6-14b8876afc53', '2026-04', 2026, 4.00, 1.25, '2026-04-07 16:24:29.638938+00', '2026-04-07 16:24:29.638938+00'),
('01ff57b1-da1d-4e39-a862-6c41548ff9b5', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '3cedc984-60e8-45e6-88b8-a75459dcd000', '2026-04', 2026, 7.00, -19.50, '2026-04-07 16:24:53.43306+00', '2026-04-07 16:24:53.43306+00'),
('f00d9563-76e9-45ba-85c7-118a0305d23e', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '4caab5a8-1693-48af-a5c6-14b8876afc53', '2026-05', 2026, 4.00, 2.25, '2026-05-01 07:00:22.426804+00', '2026-05-01 07:00:22.426804+00'),
('d9a9560f-2a8e-4867-a622-70546daaa6a0', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '3cedc984-60e8-45e6-88b8-a75459dcd000', '2026-05', 2026, 7.00, -20.50, '2026-05-01 15:24:36.914756+00', '2026-05-01 15:24:36.914756+00');

-- User Settings Data
INSERT INTO public.user_settings (id, user_id, company_logo_path, created_at, updated_at, company_logo_url) VALUES
('fc8ebed8-325f-4426-acdc-5fb66629496f', '4cf49f8c-796b-4446-8231-28c6a392a4e6', '4cf49f8c-796b-4446-8231-28c6a392a4e6/logo.png', '2025-11-03 11:31:16.664237+00', '2025-11-03 11:31:16.664237+00', 'https://wzfxupwyysarzyegpuss.supabase.co/storage/v1/object/public/company-logos/4cf49f8c-796b-4446-8231-28c6a392a4e6/logo.png');

-- Signup Requests Data
INSERT INTO public.signup_requests (id, name, email, created_at, status, notes) VALUES
('e9d6ad01-1734-481e-b635-5f64ec1015f7', 'Dean', 'deanplayer@me.com', '2025-11-03 10:19:43.785574+00', 'pending', NULL);

-- Note: Time Entries data (89 records) exported separately due to length
-- File: time_entries_backup.sql

-- ================================================
-- INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_brand_id ON public.clients(brand_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_client_id ON public.time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_month ON public.time_entries(month);
CREATE INDEX IF NOT EXISTS idx_monthly_allocations_user_client ON public.monthly_allocations(user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_time_entry_id ON public.file_attachments(time_entry_id);

-- ================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be configured according to your security requirements
-- This backup includes the schema structure but policies may need to be reconfigured

-- ================================================
-- END OF BACKUP
-- ================================================