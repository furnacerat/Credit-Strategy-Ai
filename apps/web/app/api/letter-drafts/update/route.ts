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
  if (!jwt) return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const draftId = typeof body.draft_id === 'string' ? body.draft_id : null;
  const content = typeof body.content === 'string' ? body.content : null;
  if (!draftId || content === null) {
    return NextResponse.json({ error: 'Missing draft_id or content' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return NextResponse.json({ error: 'Invalid user token' }, { status: 401 });
  }
  const userId = userData.user.id;

  const { data: draft, error: dErr } = await supabase
    .from('letter_drafts')
    .select('id, report_id, reports!inner(user_id)')
    .eq('id', draftId)
    .single();

  if (dErr || !draft) {
    return NextResponse.json({ error: dErr?.message || 'Draft not found' }, { status: 404 });
  }

  // @ts-expect-error loose join typing
  const ownerId = draft.reports?.user_id;
  if (ownerId !== userId) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const { error: upErr } = await supabase
    .from('letter_drafts')
    .update({ content })
    .eq('id', draftId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
