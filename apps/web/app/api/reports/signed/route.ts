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

  const { data: report, error: repErr } = await supabase
    .from('reports')
    .select('id, storage_bucket, storage_path, user_id')
    .eq('id', reportId)
    .single();

  if (repErr || !report) {
    return NextResponse.json({ error: repErr?.message || 'Report not found' }, { status: 404 });
  }

  if (report.user_id !== userId) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const { data: signed, error: signedErr } = await supabase.storage
    .from(report.storage_bucket)
    .createSignedUrl(report.storage_path, 60 * 10);

  if (signedErr || !signed) {
    return NextResponse.json({ error: signedErr?.message || 'Failed to sign download' }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
