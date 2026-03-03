'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

export default function ReportIndexPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return router.push('/login');

      const { data, error } = await supabase
        .from('reports')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) return setError(error.message);
      const id = (data || [])[0]?.id;
      if (!id) return router.push('/upload');
      router.replace(`/report/${id}`);
    })();
  }, [router, supabase]);

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-8 text-sm text-white/60">
      {error ? <div className="text-red-200">{error}</div> : <div>Loading latest report…</div>}
    </div>
  );
}
