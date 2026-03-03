import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const runtime = 'nodejs';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function substituteProfile(content: string, profile: any): string {
  const map: Record<string, string> = {
    FULL_NAME: String(profile?.full_name || ''),
    ADDRESS1: String(profile?.address1 || ''),
    ADDRESS2: String(profile?.address2 || ''),
    CITY: String(profile?.city || ''),
    STATE: String(profile?.state || ''),
    POSTAL_CODE: String(profile?.postal_code || ''),
    PHONE: String(profile?.phone || ''),
    EMAIL: String(profile?.email || '')
  };

  let out = content;
  for (const [k, v] of Object.entries(map)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }

  return out;
}

function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.replace(/\t/g, '  ');
    if (!s) {
      lines.push('');
      continue;
    }
    const words = s.split(' ');
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > maxChars) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

async function renderPdfFromText(title: string, body: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize = { width: 612, height: 792 }; // US Letter
  const margin = 54;
  const lineHeight = 14;
  const maxChars = 95;

  const lines = wrapLines(body, maxChars);
  let page = pdf.addPage([pageSize.width, pageSize.height]);
  let y = pageSize.height - margin;

  page.drawText(title, { x: margin, y, size: 14, font: fontBold, color: rgb(0, 0, 0) });
  y -= 22;

  for (const line of lines) {
    if (y < margin) {
      page = pdf.addPage([pageSize.width, pageSize.height]);
      y = pageSize.height - margin;
    }
    page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0, 0, 0) });
    y -= lineHeight;
  }

  return await pdf.save();
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
  const draftId = typeof body.draft_id === 'string' ? body.draft_id : null;
  if (!draftId) {
    return NextResponse.json({ error: 'Missing draft_id' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return NextResponse.json({ error: 'Invalid user token' }, { status: 401 });
  }
  const userId = userData.user.id;

  const { data: draft, error: draftErr } = await supabase
    .from('letter_drafts')
    .select('id, report_id, bureau, status, content, reports!inner(user_id)')
    .eq('id', draftId)
    .single();

  if (draftErr || !draft) {
    return NextResponse.json({ error: draftErr?.message || 'Draft not found' }, { status: 404 });
  }

  // @ts-expect-error loose join typing
  const ownerId = draft.reports?.user_id;
  if (ownerId !== userId) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('full_name,address1,address2,city,state,postal_code,phone,email')
    .eq('user_id', userId)
    .single();

  if (profErr || !profile) {
    return NextResponse.json({ error: 'Missing profile. Please fill Profile tab first.' }, { status: 400 });
  }

  const letterText = substituteProfile(String(draft.content || ''), profile);
  const filename = `dispute-${String(draft.bureau || 'bureau').toLowerCase()}-${draft.id}.pdf`;
  const storageBucket = 'letters';
  const storagePath = `${userId}/${draft.report_id}/${filename}`;

  const pdfBytes = await renderPdfFromText('Dispute Letter', letterText);

  const { error: upErr } = await supabase.storage.from(storageBucket).upload(storagePath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true
  });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Mark draft approved.
  await supabase
    .from('letter_drafts')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', draft.id);

  const { data: inserted, error: insErr } = await supabase
    .from('dispute_letters')
    .insert({
      report_id: draft.report_id,
      bureau: draft.bureau,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      letter_text: null,
      draft_id: draft.id,
      filename,
      mime_type: 'application/pdf',
      size_bytes: pdfBytes.length
    })
    .select('id')
    .single();

  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message || 'Failed to record dispute letter' }, { status: 500 });
  }

  const { data: signed, error: signedErr } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(storagePath, 60 * 10);
  if (signedErr || !signed) {
    return NextResponse.json({ error: signedErr?.message || 'Failed to sign download' }, { status: 500 });
  }

  return NextResponse.json({ letter_id: inserted.id, url: signed.signedUrl });
}
