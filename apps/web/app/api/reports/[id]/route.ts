import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function publicKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    ''
  );
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = publicKey();
  if (!anonKey) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const req = _req;
  const authHeader = req.headers.get('authorization') || '';
  const jwt = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
  if (!jwt) {
    return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });

  const { data, error } = await supabase
    .from('reports')
    .select(
      `
      id,
      status,
      progress,
      error,
      created_at,
      storage_bucket,
      storage_path,
      original_filename,
      analysis_json,
      report_items!report_items_report_id_fkey (
        id,
        bureau,
        category,
        creditor,
        account_ref,
        occurred_on,
        amount,
        confidence,
        page_number,
        raw_text,
        created_at,
        report_item_ai ( recommendation, risk_level, rationale, evidence_needed, legal_basis, letter_snippet, model, updated_at ),
        report_item_selection ( selected, updated_at )
      ),
      letter_drafts ( id, bureau, status, content, item_ids, created_at, approved_at ),
      dispute_letters ( id, bureau, storage_bucket, storage_path, created_at )
    `.trim()
    )
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ report: data });
}
