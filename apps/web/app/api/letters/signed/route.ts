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
  const letterId = typeof body.letter_id === 'string' ? body.letter_id : null;
  if (!letterId) {
    return NextResponse.json({ error: 'Missing letter_id' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return NextResponse.json({ error: 'Invalid user token' }, { status: 401 });
  }
  const userId = userData.user.id;

  const { data: letter, error: letterErr } = await supabase
    .from('dispute_letters')
    .select('id, report_id, storage_bucket, storage_path, reports!inner(user_id)')
    .eq('id', letterId)
    .single();

  if (letterErr || !letter) {
    return NextResponse.json({ error: letterErr?.message || 'Letter not found' }, { status: 404 });
  }

  // @ts-expect-error Supabase join typing is loose here.
  const ownerId = letter.reports?.user_id;
  if (ownerId !== userId) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const { data: signed, error: signedErr } = await supabase.storage
    .from(letter.storage_bucket)
    .createSignedUrl(letter.storage_path, 60 * 10);

  if (signedErr || !signed) {
    return NextResponse.json({ error: signedErr?.message || 'Failed to sign download' }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
