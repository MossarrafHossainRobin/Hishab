'use client';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { MONTHS, todayISO, summarize, monthlyBreakdown, categoryTotals, money } from '@/lib/calc';

const CATS = {
  expense: ['Food', 'Transport', 'Rent', 'Bills', 'Shopping', 'Health', 'Other'],
  income: ['Salary', 'Business', 'Gift', 'Other'],
};
const blankForm = () => ({ type: 'expense', amount: '', category: 'Food', note: '', date: todayISO() });

export default function Home() {
  const [fb, setFb] = useState(null);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(undefined);
  const [txs, setTxs] = useState([]);
  const [online, setOnline] = useState(true);
  const [installEvt, setInstallEvt] = useState(null);
  const [authError, setAuthError] = useState('');
  const [view, setView] = useState('month');
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [sheet, setSheet] = useState(false);
  const [form, setForm] = useState(blankForm());

  useEffect(() => {
    setFb(getFirebase());
    setReady(true);
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    const beforeInstall = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('beforeinstallprompt', beforeInstall);
    };
  }, []);

  useEffect(() => (fb ? onAuthStateChanged(fb.auth, setUser) : undefined), [fb]);

  useEffect(() => {
    if (!fb || !user) { setTxs([]); return; }
    const q = query(collection(fb.db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));
    return onSnapshot(q, { includeMetadataChanges: true }, (snap) =>
      setTxs(snap.docs.map((d) => ({ id: d.id, pending: d.metadata.hasPendingWrites, ...d.data() })))
    );
  }, [fb, user]);

  const year = month.slice(0, 4);
  const years = useMemo(() => {
    const set = new Set(txs.map((t) => t.date.slice(0, 4)));
    set.add(todayISO().slice(0, 4));
    set.add(year);
    return [...set].sort().reverse();
  }, [txs, year]);

  const yearTx = useMemo(() => txs.filter((t) => t.date.startsWith(year)), [txs, year]);
  const period = useMemo(
    () => (view === 'month' ? txs.filter((t) => t.date.startsWith(month)) : yearTx),
    [view, txs, month, yearTx]
  );
  const totals = summarize(period);
  const all = summarize(txs);
  const months = useMemo(() => monthlyBreakdown(yearTx), [yearTx]);
  const maxOut = Math.max(1, ...months.map((m) => m.expense));
  const cats = useMemo(() => categoryTotals(period), [period]);
  const spentPct = totals.income > 0 ? Math.min(100, (totals.expense / totals.income) * 100) : totals.expense > 0 ? 100 : 0;
  const periodLabel = view === 'month' ? `${MONTHS[+month.slice(5, 7) - 1]} ${year}` : year;

  const signIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(fb.auth, fb.provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked') return signInWithRedirect(fb.auth, fb.provider);
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      setAuthError(online ? 'Sign-in failed. Try again.' : 'You are offline. Connect to the internet to sign in the first time.');
    }
  };

  const save = (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!(amount > 0)) return;
    // Not awaited on purpose: offline, the server acknowledgement waits for the network
    // but the entry is saved on the device immediately.
    addDoc(collection(fb.db, 'users', user.uid, 'transactions'), {
      type: form.type,
      amount,
      category: form.category,
      note: form.note.trim(),
      date: form.date,
      createdAt: serverTimestamp(),
    }).catch(() => {});
    setMonth(form.date.slice(0, 7));
    setView('month');
    setSheet(false);
    setForm(blankForm());
  };

  const remove = (t) => {
    if (window.confirm(`Delete ${t.category} ${money(t.amount)}?`)) {
      deleteDoc(doc(fb.db, 'users', user.uid, 'transactions', t.id)).catch(() => {});
    }
  };

  const install = async () => {
    installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  };

  if (!ready || (fb && user === undefined)) {
    return <p className="p-6 text-sm text-ink/60">Opening your ledger…</p>;
  }

  if (!fb) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-bold">Firebase is not set up</h1>
        <p className="mt-2 text-sm">Copy <code>.env.example</code> to <code>.env.local</code>, fill in your Firebase web app values, then restart the dev server.</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="ledger min-h-dvh grid place-items-center p-6 text-white">
        <div className="max-w-xs">
          <h1 className="text-5xl font-bold tracking-tight">Hishab</h1>
          <p className="mt-3 text-white/80">See what you earned, what you spent, and what is left. Month by month, year by year, even without internet.</p>
          <button onClick={signIn} className="mt-8 w-full rounded-lg bg-gold px-4 py-3 font-semibold text-white">
            Continue with Google
          </button>
          {authError && <p role="alert" className="mt-3 text-sm text-amber-200">{authError}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md pb-28">
      <section className="ledger px-4 pt-5 pb-6 text-white" style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Hishab</span>
          <div className="flex items-center gap-3">
            <span className={online ? 'text-emerald-200' : 'text-amber-200'}>{online ? 'Online' : 'Offline, saving on this phone'}</span>
            {installEvt && <button onClick={install} className="underline">Install app</button>}
            <button onClick={() => signOut(fb.auth)} className="underline">Log out</button>
          </div>
        </div>
        <p className="mt-6 text-sm text-white/70">Net balance, all time</p>
        <p className={`num text-5xl font-bold ${all.net < 0 ? 'text-red-200' : ''}`}>{money(all.net)}</p>
        <p className="num mt-1 text-sm text-white/70">Received {money(all.income)} · Spent {money(all.expense)}</p>
      </section>

      <div className="space-y-5 px-4 pt-5">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line bg-white p-0.5 text-sm font-medium" role="group" aria-label="Period">
            {['month', 'year'].map((v) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
                className={`rounded-md px-3 py-1.5 ${view === v ? 'bg-bottle text-white' : ''}`}>
                {v === 'month' ? 'Month' : 'Year'}
              </button>
            ))}
          </div>
          {view === 'month' ? (
            <input type="month" aria-label="Month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2" />
          ) : (
            <select aria-label="Year" value={year} onChange={(e) => setMonth(`${e.target.value}-${month.slice(5, 7)}`)}
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2">
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          )}
        </div>

        <section aria-label={`Summary for ${periodLabel}`}>
          <h2 className="text-sm font-semibold text-ink/70">{periodLabel}</h2>
          <div className="num mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line text-sm">
            <div className="bg-white p-3"><p className="text-ink/60">Received</p><p className="font-semibold text-in">{money(totals.income)}</p></div>
            <div className="bg-white p-3"><p className="text-ink/60">Spent</p><p className="font-semibold text-out">{money(totals.expense)}</p></div>
            <div className="bg-white p-3"><p className="text-ink/60">Left</p><p className={`font-semibold ${totals.net < 0 ? 'text-out' : ''}`}>{money(totals.net)}</p></div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-mint" role="img" aria-label={`Spent ${Math.round(spentPct)}% of what was received`}>
            <div className={`h-full ${totals.expense > totals.income ? 'bg-out' : 'bg-bottle'}`} style={{ width: `${spentPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink/60">{Math.round(spentPct)}% of received money spent</p>
        </section>

        {view === 'year' && (
          <section aria-label="Months of the year">
            <h2 className="text-sm font-semibold text-ink/70">Month by month</h2>
            <div className="mt-2 overflow-hidden rounded-lg border border-line bg-white">
              {months.map((m) => (
                <button key={m.key} onClick={() => { setMonth(`${year}-${m.key}`); setView('month'); }}
                  className="num grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-line px-3 py-2 text-left text-sm last:border-b-0">
                  <span className="font-medium">{m.name}</span>
                  <span className="h-2 rounded-full bg-mint"><span className="block h-full rounded-full bg-out/70" style={{ width: `${(m.expense / maxOut) * 100}%` }} /></span>
                  <span className={m.net < 0 ? 'text-out' : ''}>{money(m.net)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {cats.length > 0 && (
          <section aria-label="Spending by category">
            <h2 className="text-sm font-semibold text-ink/70">Where the money went</h2>
            <ul className="num mt-2 space-y-2 text-sm">
              {cats.map((c) => (
                <li key={c.name}>
                  <div className="flex justify-between"><span>{c.name}</span><span>{money(c.total)}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-mint"><div className="h-full rounded-full bg-bottle" style={{ width: `${(c.total / cats[0].total) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {view === 'month' && (
          <section aria-label="Entries">
            <h2 className="text-sm font-semibold text-ink/70">Entries</h2>
            {period.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-line p-4 text-sm text-ink/70">Nothing recorded for {periodLabel}. Tap Add entry to record what you earned or spent.</p>
            ) : (
              <ul className="mt-2 overflow-hidden rounded-lg border border-line bg-white">
                {period.map((t) => (
                  <li key={t.id} className="flex items-stretch border-b border-line last:border-b-0">
                    <span className="num w-12 shrink-0 py-3 text-center text-lg font-semibold text-ink/70">{t.date.slice(8)}</span>
                    <div className="min-w-0 flex-1 py-3 pr-2 text-sm">
                      <p className="truncate font-medium">{t.category}{t.note ? `, ${t.note}` : ''}</p>
                      {t.pending && <p className="text-xs text-gold">Not synced yet</p>}
                    </div>
                    <div className="num flex items-center gap-2 border-l-4 border-double border-line pl-3 pr-3 text-sm">
                      <span className={`font-semibold ${t.type === 'income' ? 'text-in' : 'text-out'}`}>{t.type === 'income' ? '+' : '-'}{money(t.amount)}</span>
                      <button onClick={() => remove(t)} aria-label={`Delete ${t.category} entry`} className="px-1 text-lg text-ink/40">×</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 flex justify-center px-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <button onClick={() => setSheet(true)} className="w-full max-w-md rounded-xl bg-bottle py-3.5 font-semibold text-white shadow-lg">Add entry</button>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-10 flex items-end bg-black/40" onClick={() => setSheet(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add entry"
            className="sheet mx-auto w-full max-w-md space-y-3 rounded-t-2xl bg-white p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="flex rounded-lg border border-line p-0.5 text-sm font-medium" role="group" aria-label="Type">
              {[['expense', 'Spent'], ['income', 'Received']].map(([v, label]) => (
                <button type="button" key={v} aria-pressed={form.type === v}
                  onClick={() => setForm({ ...form, type: v, category: CATS[v][0] })}
                  className={`flex-1 rounded-md py-2 ${form.type === v ? 'bg-bottle text-white' : ''}`}>{label}</button>
              ))}
            </div>
            <input autoFocus required type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="Amount in ৳"
              aria-label="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="num w-full rounded-lg border border-line px-3 py-3 text-2xl font-semibold" />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
              {CATS[form.type].map((c) => (
                <button type="button" key={c} aria-pressed={form.category === c} onClick={() => setForm({ ...form, category: c })}
                  className={`rounded-full border px-3 py-1 text-sm ${form.category === c ? 'border-bottle bg-bottle text-white' : 'border-line'}`}>{c}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input required type="date" aria-label="Date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-lg border border-line px-3 py-2" />
              <input placeholder="Note (optional)" aria-label="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="rounded-lg border border-line px-3 py-2" />
            </div>
            <button className="w-full rounded-lg bg-gold py-3 font-semibold text-white">Save entry</button>
          </form>
        </div>
      )}
    </main>
  );
}
