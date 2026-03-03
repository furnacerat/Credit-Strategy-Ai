'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

type Profile = {
  full_name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  email: string;
};

const empty: Profile = {
  full_name: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  postal_code: '',
  phone: '',
  email: ''
};

export default function ProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile>(empty);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return router.push('/login');

      const { data } = await supabase.auth.getUser();
      const email = data.user?.email || '';

      const { data: row, error } = await supabase.from('profiles').select('*').single();
      if (error) {
        // If profile doesn't exist yet, that's fine.
        setProfile({ ...empty, email });
        return;
      }

      setProfile({
        full_name: row.full_name ?? '',
        address1: row.address1 ?? '',
        address2: row.address2 ?? '',
        city: row.city ?? '',
        state: row.state ?? '',
        postal_code: row.postal_code ?? '',
        phone: row.phone ?? '',
        email: row.email ?? email
      });
    })();
  }, [router, supabase]);

  return (
    <div className="relative mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4">
        <div className="text-xs text-white/55">PROFILE</div>
        <h1 className="mt-1 text-2xl font-semibold">Your letter details</h1>
        <div className="mt-1 text-sm text-white/60">
          Used to personalize dispute letters. Stored in `public.profiles` only.
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setSaved(false);
            setError(null);
            const { data: user } = await supabase.auth.getUser();
            const uid = user.user?.id;
            if (!uid) {
              setBusy(false);
              return setError('Not signed in');
            }
            const { error } = await supabase.from('profiles').upsert({ user_id: uid, ...profile });
            setBusy(false);
            if (error) return setError(error.message);
            setSaved(true);
          }}
        >
          {(
            [
              ['full_name', 'Full name'],
              ['email', 'Email'],
              ['phone', 'Phone'],
              ['address1', 'Address line 1'],
              ['address2', 'Address line 2'],
              ['city', 'City'],
              ['state', 'State'],
              ['postal_code', 'Postal code']
            ] as const
          ).map(([key, label]) => (
            <label key={key} className={key === 'address1' || key === 'address2' ? 'md:col-span-2' : ''}>
              <div className="text-xs text-white/60">{label}</div>
              <input
                value={(profile as any)[key]}
                onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/30"
              />
            </label>
          ))}

          <div className="md:col-span-2 flex flex-wrap items-center gap-2 pt-2">
            <button
              disabled={busy}
              className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-60"
              type="submit"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              onClick={() => router.push('/dashboard')}
            >
              Back
            </button>
            {saved ? <div className="text-xs text-emerald-200/90">Saved.</div> : null}
            {error ? <div className="text-xs text-red-200">{error}</div> : null}
          </div>
        </form>
      </div>
    </div>
  );
}
