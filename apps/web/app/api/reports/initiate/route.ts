import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 120);
}

export async function POST(req: Request) {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRole = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const reportsBucket = process.env.SUPABASE_REPORTS_BUCKET || 'reports';

  const authHeader = req.headers.get('authorization') || '';
  const jwt = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
  if (!jwt) {
    return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return NextResponse.json({ error: 'Invalid user token' }, { status: 401 });
  }
  const userId = userData.user.id;

  const body = await req.json().catch(() => ({}));
  const originalFilename = typeof body.filename === 'string' ? body.filename : 'report.pdf';
  const mimeType = typeof body.mime_type === 'string' ? body.mime_type : 'application/pdf';
  const sizeBytes = typeof body.size_bytes === 'number' ? body.size_bytes : null;

  const safeName = sanitizeFilename(originalFilename || 'report.pdf') || 'report.pdf';

  const reportId = crypto.randomUUID();
  const storagePath = `${userId}/${reportId}/${safeName}`;

  const { data: report, error: reportErr } = await supabase
    .from('reports')
    .insert({
      id: reportId,
      user_id: userId,
      storage_bucket: reportsBucket,
      storage_path: storagePath,
      original_filename: originalFilename,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      status: 'uploaded',
      progress: 0
    })
    .select('id')
    .single();

  if (reportErr || !report) {
    return NextResponse.json({ error: reportErr?.message || 'Failed to create report' }, { status: 500 });
  }

  const { data: signed, error: signedErr } = await supabase.storage
    .from(reportsBucket)
    .createSignedUploadUrl(storagePath);

  if (signedErr || !signed) {
    return NextResponse.json({ error: signedErr?.message || 'Failed to sign upload' }, { status: 500 });
  }

  return NextResponse.json({
    report_id: report.id,
    bucket: reportsBucket,
    path: storagePath,
    signed_upload: signed
  });
}
