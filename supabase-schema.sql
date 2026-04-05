-- Nith Ops Dashboard — Supabase Schema
-- Run this in the Supabase SQL Editor at: https://supabase.com/dashboard/project/mrdozyxbonbukpmywxqi/sql

-- Monitored sites
CREATE TABLE IF NOT EXISTS ops_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('own', 'client', 'demo')),
  platform TEXT DEFAULT 'cloudflare_pages',
  cloudflare_zone_id TEXT,
  github_repo TEXT,
  client_name TEXT,
  client_email TEXT,
  hosting_plan TEXT,
  monthly_fee NUMERIC(10,2) DEFAULT 0,
  contract_start DATE,
  contract_end DATE,
  contract_type TEXT CHECK (contract_type IN ('standard', 'startup_bundle', 'pro_bono', 'internal')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'development')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ops_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can manage ops_sites" ON ops_sites FOR ALL USING (true);

-- Uptime checks
CREATE TABLE IF NOT EXISTS ops_uptime_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES ops_sites(id) ON DELETE CASCADE NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  is_up BOOLEAN NOT NULL,
  error TEXT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ops_uptime_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon manages uptime" ON ops_uptime_checks FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_uptime_site_time ON ops_uptime_checks(site_id, checked_at DESC);

-- Alerts
CREATE TABLE IF NOT EXISTS ops_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES ops_sites(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'site_down', 'site_slow', 'ssl_expiring', 'traffic_drop',
    'invoice_overdue', 'contract_expiring', 'error_detected'
  )),
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ops_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon manages alerts" ON ops_alerts FOR ALL USING (true);

-- Daily traffic snapshots
CREATE TABLE IF NOT EXISTS ops_traffic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES ops_sites(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  unique_visitors INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  bandwidth_bytes BIGINT DEFAULT 0,
  requests INTEGER DEFAULT 0,
  threats_blocked INTEGER DEFAULT 0,
  top_pages JSONB DEFAULT '[]',
  top_countries JSONB DEFAULT '[]',
  UNIQUE(site_id, date)
);

ALTER TABLE ops_traffic ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon manages traffic" ON ops_traffic FOR ALL USING (true);

-- Activity log
CREATE TABLE IF NOT EXISTS ops_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES ops_sites(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'deploy', 'alert', 'note', 'invoice', 'support', 'update', 'client_comms'
  )),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ops_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon manages activity" ON ops_activity FOR ALL USING (true);

-- Invoices
CREATE TABLE IF NOT EXISTS ops_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES ops_sites(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'paid', 'overdue')),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ops_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon manages invoices" ON ops_invoices FOR ALL USING (true);

-- Seed data
INSERT INTO ops_sites (name, url, type, github_repo, contract_type, status, notes) VALUES
  ('Nith Digital', 'https://nithdigital.uk', 'own', 'AkinYavuz1/NithDigital', 'internal', 'active', 'Main consultancy website + Launchpad + Business OS'),
  ('Not an Octavia', 'https://not-an-octavia.uk', 'own', 'AkinYavuz1/NotAnOctavia', 'internal', 'active', 'ML-curated used car deals site'),
  ('gAIns', 'https://gainsai.uk', 'own', 'AkinYavuz1/gymtracker', 'internal', 'development', 'AI-powered gym tracker — in development'),
  ('Tumble Tots', 'https://tumbletots.pages.dev', 'client', NULL, 'pro_bono', 'active', 'Pro bono childminding website for Carly'),
  ('DailyDuel', 'https://daily-duel.akinyavuz.workers.dev', 'own', 'AkinYavuz1/dailyduel', 'internal', 'active', 'Daily multiplayer mini-game platform — separate Supabase project')
ON CONFLICT DO NOTHING;
