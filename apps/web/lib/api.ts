import { supabaseBrowser } from './supabase';

async function accessToken(): Promise<string> {
  const supabase = supabaseBrowser();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return token;
}

export type InitiateResponse = {
  report_id: string;
  bucket: string;
  path: string;
  signed_upload: { signedUrl: string; path: string; token: string };
};

export async function initiateReportUpload(file: File): Promise<InitiateResponse> {
  const token = await accessToken();
  const res = await fetch('/api/reports/initiate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filename: file.name,
      mime_type: file.type || 'application/pdf',
      size_bytes: file.size
    })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Initiate failed (${res.status})`);
  }
  return (await res.json()) as InitiateResponse;
}

export async function enqueueReport(reportId: string): Promise<void> {
  const token = await accessToken();
  const res = await fetch('/api/reports/enqueue', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ report_id: reportId })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Enqueue failed (${res.status})`);
  }
}

export async function getReport(reportId: string) {
  const token = await accessToken();
  const res = await fetch(`/api/reports/${reportId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Fetch failed (${res.status})`);
  }
  return (await res.json()) as any;
}

export async function uploadToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/pdf');

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      onProgress(pct);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed (network)'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    xhr.send(file);
  });
}

export async function signLetterDownload(letterId: string): Promise<string> {
  const token = await accessToken();
  const res = await fetch('/api/letters/signed', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ letter_id: letterId })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Sign failed (${res.status})`);
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}
