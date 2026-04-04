import { NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase'

// This endpoint runs the schema migration.
// Call POST /api/setup to create all tables.
// Only works server-side with the service role key.
export async function POST() {
  const db = getServiceRoleClient()

  const statements = [
    `CREATE TABLE IF NOT EXISTS ops_sites (
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
    )`,
    `ALTER TABLE ops_sites ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ops_sites' AND policyname='Anon can manage ops_sites') THEN CREATE POLICY "Anon can manage ops_sites" ON ops_sites FOR ALL USING (true); END IF; END $$`,
    `CREATE TABLE IF NOT EXISTS ops_uptime_checks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES ops_sites(id) ON DELETE CASCADE NOT NULL,
      status_code INTEGER,
      response_time_ms INTEGER,
      is_up BOOLEAN NOT NULL,
      error TEXT,
      checked_at TIMESTAMPTZ DEFAULT now()
    )`,
    `ALTER TABLE ops_uptime_checks ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ops_uptime_checks' AND policyname='Anon manages uptime') THEN CREATE POLICY "Anon manages uptime" ON ops_uptime_checks FOR ALL USING (true); END IF; END $$`,
    `CREATE INDEX IF NOT EXISTS idx_uptime_site_time ON ops_uptime_checks(site_id, checked_at DESC)`,
    `CREATE TABLE IF NOT EXISTS ops_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES ops_sites(id) ON DELETE CASCADE NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('site_down','site_slow','ssl_expiring','traffic_drop','invoice_overdue','contract_expiring','error_detected')),
      severity TEXT DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      acknowledged BOOLEAN DEFAULT false,
      acknowledged_at TIMESTAMPTZ,
      resolved BOOLEAN DEFAULT false,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `ALTER TABLE ops_alerts ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ops_alerts' AND policyname='Anon manages alerts') THEN CREATE POLICY "Anon manages alerts" ON ops_alerts FOR ALL USING (true); END IF; END $$`,
    `CREATE TABLE IF NOT EXISTS ops_traffic (
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
    )`,
    `ALTER TABLE ops_traffic ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ops_traffic' AND policyname='Anon manages traffic') THEN CREATE POLICY "Anon manages traffic" ON ops_traffic FOR ALL USING (true); END IF; END $$`,
    `CREATE TABLE IF NOT EXISTS ops_activity (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES ops_sites(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('deploy','alert','note','invoice','support','update','client_comms')),
      title TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `ALTER TABLE ops_activity ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ops_activity' AND policyname='Anon manages activity') THEN CREATE POLICY "Anon manages activity" ON ops_activity FOR ALL USING (true); END IF; END $$`,
    `CREATE TABLE IF NOT EXISTS ops_invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES ops_sites(id) ON DELETE CASCADE NOT NULL,
      month TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','paid','overdue')),
      sent_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `ALTER TABLE ops_invoices ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ops_invoices' AND policyname='Anon manages invoices') THEN CREATE POLICY "Anon manages invoices" ON ops_invoices FOR ALL USING (true); END IF; END $$`,
  ]

  const results: Array<{ statement: string; ok: boolean; error?: string }> = []

  for (const sql of statements) {
    const { error } = await db.rpc('exec_sql', { query: sql }).single()
    if (error && !error.message?.includes('already exists') && !error.message?.includes('PGRST202')) {
      results.push({ statement: sql.slice(0, 50), ok: false, error: error.message })
    } else {
      results.push({ statement: sql.slice(0, 50), ok: true })
    }
  }

  // Seed data
  const { error: seedError } = await db.from('ops_sites').upsert([
    { name: 'Nith Digital', url: 'https://nithdigital.uk', type: 'own', github_repo: 'AkinYavuz1/NithDigital', contract_type: 'internal', status: 'active', notes: 'Main consultancy website + Launchpad + Business OS', monthly_fee: 0 },
    { name: 'Not an Octavia', url: 'https://not-an-octavia.uk', type: 'own', github_repo: 'AkinYavuz1/NotAnOctavia', contract_type: 'internal', status: 'active', notes: 'ML-curated used car deals site', monthly_fee: 0 },
    { name: 'gAIns', url: 'https://gainsai.uk', type: 'own', github_repo: 'AkinYavuz1/gymtracker', contract_type: 'internal', status: 'development', notes: 'AI-powered gym tracker — in development', monthly_fee: 0 },
    { name: 'Tumble Tots', url: 'https://tumbletots.pages.dev', type: 'client', contract_type: 'pro_bono', status: 'active', notes: 'Pro bono childminding website for Carly', monthly_fee: 0 },
  ], { onConflict: 'url', ignoreDuplicates: true })

  return NextResponse.json({
    results,
    seed: seedError ? { ok: false, error: seedError.message } : { ok: true },
    instructions: 'If exec_sql is not available, run supabase-schema.sql manually in the Supabase SQL editor',
  })
}
