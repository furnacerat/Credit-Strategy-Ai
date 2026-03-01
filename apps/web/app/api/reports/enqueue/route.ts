import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST(req: Request) {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRole = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const authHeader = req.headers.get('authorization') || '';
  const jwt = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
  if (!jwt) {
    return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const reportId = typeof body.report_id === 'string' ? body.report_id : null;
  if (!reportId) {
    return NextResponse.json({ error: 'Missing report_id' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return NextResponse.json({ error: 'Invalid user token' }, { status: 401 });
  }
  const userId = userData.user.id;

  const { data: report, error: reportErr } = await supabase
    .from('reports')
    .select('id, user_id, storage_path, status')
    .eq('id', reportId)
    .single();

  if (reportErr || !report) {
    return NextResponse.json({ error: reportErr?.message || 'Report not found' }, { status: 404 });
  }
  if (report.user_id !== userId) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }
  if (!report.storage_path) {
    return NextResponse.json({ error: 'Report storage_path missing' }, { status: 400 });
  }

  const { error: updErr } = await supabase
    .from('reports')
    .update({ status: 'queued', progress: 0 })
    .eq('id', reportId);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const { error: jobErr } = await supabase.from('jobs').insert({
    type: 'parse_report',
    payload: { report_id: reportId, storage_path: report.storage_path },
    status: 'queued'
  });
  if (jobErr) {
    return NextResponse.json({ error: jobErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, report_id: reportId });
}
