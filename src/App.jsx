import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import {
  Plus, Users, Receipt, ArrowLeft, TrendingUp, TrendingDown,
  Trash2, Home, BarChart3, Pencil, Printer, LogOut, Loader2,
  X as XIcon, Check, Tag, Calendar, Search, DollarSign, Eye,
  ChevronRight, ArrowRight
} from 'lucide-react';

// ============================================================================
// 🔥 FIREBASE
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyAmwUF2EBao7zpImN0zfNaGGgFSXBboQp0",
  authDomain: "partyfund-app.firebaseapp.com",
  projectId: "partyfund-app",
  storageBucket: "partyfund-app.firebasestorage.app",
  messagingSenderId: "372581772212",
  appId: "1:372581772212:web:b81db63bd3b8320425e0e1"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ============================================================================
// 🎨 CONSTANTS
// ============================================================================
const EXPENSE_CATS = ['Food', 'Hotel', 'Drinks', 'Travel', 'Shopping', 'Entertainment', 'Misc'];
const INCOME_CATS  = ['Cash', 'Online', 'UPI', 'Card'];
const CHART_COLORS = ['#F87171','#60A5FA','#34D399','#FBBF24','#A78BFA','#F472B6','#818CF8','#9CA3AF'];

const CAT_STYLE = {
  Food:          { idle: 'bg-orange-100 text-orange-700 border-orange-300', active: 'bg-orange-500 text-white border-orange-500' },
  Hotel:         { idle: 'bg-blue-100 text-blue-700 border-blue-300',       active: 'bg-blue-500 text-white border-blue-500' },
  Drinks:        { idle: 'bg-purple-100 text-purple-700 border-purple-300', active: 'bg-purple-500 text-white border-purple-500' },
  Travel:        { idle: 'bg-cyan-100 text-cyan-700 border-cyan-300',       active: 'bg-cyan-500 text-white border-cyan-500' },
  Shopping:      { idle: 'bg-pink-100 text-pink-700 border-pink-300',       active: 'bg-pink-500 text-white border-pink-500' },
  Entertainment: { idle: 'bg-yellow-100 text-yellow-700 border-yellow-300', active: 'bg-yellow-500 text-white border-yellow-500' },
  Misc:          { idle: 'bg-gray-100 text-gray-600 border-gray-300',       active: 'bg-gray-600 text-white border-gray-600' },
  Cash:          { idle: 'bg-green-100 text-green-700 border-green-300',    active: 'bg-green-500 text-white border-green-500' },
  Online:        { idle: 'bg-indigo-100 text-indigo-700 border-indigo-300', active: 'bg-indigo-500 text-white border-indigo-500' },
  UPI:           { idle: 'bg-violet-100 text-violet-700 border-violet-300', active: 'bg-violet-500 text-white border-violet-500' },
  Card:          { idle: 'bg-sky-100 text-sky-700 border-sky-300',          active: 'bg-sky-500 text-white border-sky-500' },
};
const catIdle   = (c) => CAT_STYLE[c]?.idle   ?? 'bg-gray-100 text-gray-600 border-gray-300';
const catActive = (c) => CAT_STYLE[c]?.active  ?? 'bg-indigo-500 text-white border-indigo-500';

// ============================================================================
// 🧮 SETTLEMENT LOGIC
// ============================================================================
/*
  MODEL:
  income (type='in')  → member pays cash INTO the common pool
  expense (type='out') →
      payerId='admin'   → money came from the pool (no individual credit)
      payerId=memberId  → that member fronted their own cash personally

  For each member:
    paid  = income contributions + expenses they personally fronted
    share = sum of (expense ÷ splitCount) for every expense they're part of

  net = paid − share
    > 0  → they are owed (overpaid / overcontributed)
    < 0  → they owe (underpaid / undercontributed)

  Settlement: greedy minimum-transfer plan matches debtors to creditors.
*/
function calcSettlement(members, transactions) {
  if (!members.length) return null;

  const bal = {};
  members.forEach(m => (bal[m.id] = { name: m.name, paid: 0, share: 0 }));
  const categories = {};

  transactions.forEach(t => {
    const amt = Number(t.amount);
    if (t.type === 'out') {
      const cat = t.category || 'Misc';
      categories[cat] = (categories[cat] || 0) + amt;

      // Credit the member who personally fronted the bill
      if (t.payerId && t.payerId !== 'admin' && bal[t.payerId]) {
        bal[t.payerId].paid += amt;
      }

      // Debit each involved member their share
      const split = t.involvedMemberIds?.length ? t.involvedMemberIds : members.map(m => m.id);
      const perHead = amt / split.length;
      split.forEach(id => { if (bal[id]) bal[id].share += perHead; });

    } else if (t.type === 'in') {
      if (t.memberId && bal[t.memberId]) {
        bal[t.memberId].paid += amt;
      }
    }
  });

  const settlements = Object.entries(bal).map(([id, d]) => ({
    id, name: d.name, paid: d.paid, share: d.share, net: d.paid - d.share,
  }));

  // Greedy minimum-transfer plan
  const debtors   = settlements.filter(s => s.net < -0.5).map(s => ({ ...s })).sort((a, b) => a.net - b.net);
  const creditors = settlements.filter(s => s.net >  0.5).map(s => ({ ...s })).sort((a, b) => b.net - a.net);
  const transfers = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const give = Math.min(Math.abs(debtors[i].net), creditors[j].net);
    if (give > 0.5) {
      transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: Math.round(give) });
    }
    debtors[i].net += give;
    creditors[j].net -= give;
    if (Math.abs(debtors[i].net) < 0.5) i++;
    if (Math.abs(creditors[j].net) < 0.5) j++;
  }

  return { settlements, categories, transfers };
}

// ============================================================================
// 🪝 HOOKS
// ============================================================================
const useFirestoreCollection = (collectionName, constraints = []) => {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  useEffect(() => {
    try {
      let q = collection(db, collectionName);
      if (constraints.length) q = query(q, ...constraints);
      const unsub = onSnapshot(q,
        snap => { setData(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); setError(null); },
        err  => { setError(err.message); setLoading(false); }
      );
      return unsub;
    } catch (err) { setError(err.message); setLoading(false); }
  }, [collectionName, JSON.stringify(constraints)]);
  return { data, loading, error };
};

const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);
  return { toasts, addToast };
};

// ============================================================================
// 🎯 SHARED UI
// ============================================================================
function Toast({ toasts }) {
  return (
    <div className="fixed top-4 left-4 right-4 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`w-full max-w-sm px-4 py-3 rounded-2xl shadow-xl text-white text-sm font-bold text-center ${
          t.type === 'success' ? 'bg-emerald-500' : t.type === 'error' ? 'bg-red-500' : 'bg-indigo-500'
        }`}>{t.message}</div>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <Loader2 className="w-10 h-10 text-white animate-spin" />
    </div>
  );
}

function Sheet({ onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[92dvh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        {children}
      </div>
    </div>
  );
}

function Confirm({ title, body, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl">
        <h3 className="text-lg font-black text-gray-800 mb-1">{title}</h3>
        {body && <p className="text-sm text-gray-500 mb-5">{body}</p>}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-700 text-sm active:scale-95 transition-all">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-red-500 rounded-xl font-bold text-white text-sm active:scale-95 transition-all">Confirm</button>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, size = 'md', className = '' }) {
  const initials = (name || '??').substring(0, 2).toUpperCase();
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black flex-shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

// ============================================================================
// 🏷️ CATEGORY SELECTOR
// ============================================================================
function CategorySelector({ type, value, onChange }) {
  const presets = type === 'in' ? INCOME_CATS : EXPENSE_CATS;
  const isCustom = !!value && !presets.includes(value);
  const [showInput, setShowInput] = useState(isCustom);
  const [draft, setDraft]         = useState(isCustom ? value : '');
  const ref = useRef(null);

  useEffect(() => { if (showInput) ref.current?.focus(); }, [showInput]);

  const pickPreset = (cat) => { setShowInput(false); setDraft(''); onChange(cat); };
  const openCustom = ()     => { setShowInput(true); onChange(''); setDraft(''); };
  const clearCustom= ()     => { setShowInput(false); setDraft(''); onChange(presets[0]); };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {presets.map(cat => {
          const active = value === cat && !showInput;
          return (
            <button key={cat} type="button" onClick={() => pickPreset(cat)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border-2 transition-all active:scale-95 ${active ? catActive(cat) : catIdle(cat)}`}>
              {active && <Check className="w-3 h-3" />}{cat}
            </button>
          );
        })}
        {!showInput && (
          <button type="button" onClick={openCustom}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border-2 border-dashed border-indigo-300 text-indigo-500 active:scale-95">
            <Plus className="w-3 h-3" />Custom
          </button>
        )}
      </div>

      {showInput && (
        <div className="flex items-center gap-2 bg-indigo-50 border-2 border-indigo-300 rounded-xl px-3 py-2.5">
          <span className="text-xs font-bold text-indigo-400 flex-shrink-0">Label:</span>
          <input ref={ref} type="text" value={draft}
            onChange={e => { setDraft(e.target.value); onChange(e.target.value.trim()); }}
            placeholder={`e.g. ${type === 'in' ? 'Sponsorship' : 'Medical'}`} maxLength={30}
            className="flex-1 bg-transparent text-sm font-bold text-indigo-900 placeholder-indigo-300 outline-none min-w-0" />
          <button type="button" onClick={clearCustom} className="p-1 rounded-full hover:bg-indigo-200 text-indigo-400 flex-shrink-0">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showInput && draft && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Using:</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
            <Check className="w-3 h-3" />{draft}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 🔐 LOGIN
// ============================================================================
function LoginScreen({ onViewReport }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [codeMode, setCodeMode] = useState(false);
  const [code, setCode]       = useState('');

  const login = async () => {
    setLoading(true); setErr('');
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { setErr(e.message || 'Login failed.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-end sm:items-center justify-center sm:p-4">
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}.float{animation:float 3s ease-in-out infinite}`}</style>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-7 w-full sm:max-w-md">
        <div className="text-center mb-7">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center float shadow-lg">
            <Receipt className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-800">PartyFund</h1>
          <p className="text-gray-400 text-sm mt-1">Split trip expenses easily</p>
        </div>

        {err && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">{err}</div>}

        {!codeMode ? (
          <>
            <button onClick={login} disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 border-2 border-gray-200 rounded-2xl font-bold text-gray-700 active:scale-95 transition-all disabled:opacity-50 mb-4">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <><svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>Sign in with Google</>
              )}
            </button>
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"/></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400 font-semibold">OR</span></div>
            </div>
            <button onClick={() => setCodeMode(true)}
              className="w-full py-4 bg-indigo-50 border-2 border-indigo-100 text-indigo-700 font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Eye className="w-5 h-5" />View Report with Code
            </button>
            <p className="mt-5 text-center text-xs text-gray-400">Sign in to create events. Anyone can view reports with share code.</p>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-bold text-gray-600 text-center">Enter your 6-character share code</p>
            <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyPress={e => e.key === 'Enter' && code.length === 6 && onViewReport(code)}
              placeholder="ABC123" maxLength={6} autoFocus
              className="w-full py-4 text-center text-3xl font-black tracking-[0.4em] uppercase bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 transition-colors" />
            <button onClick={() => code.trim() && onViewReport(code.trim())} disabled={code.length < 6}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl active:scale-95 transition-all disabled:opacity-40">
              View Report
            </button>
            <button onClick={() => { setCodeMode(false); setCode(''); setErr(''); }}
              className="w-full py-3.5 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 transition-all text-sm">Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 📋 PARTY LIST
// ============================================================================
function PartyList({ user, onCreate, onSelect }) {
  const [search, setSearch] = useState('');
  const { data: parties, loading } = useFirestoreCollection('parties', [where('adminId', '==', user.uid)]);

  const filtered = useMemo(() =>
    parties
      .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.shareCode.includes(search.toUpperCase()))
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)),
    [parties, search]
  );

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-2xl font-black text-gray-800">My Events</h1>
        <p className="text-xs text-gray-400 mt-0.5">Tap to manage</p>
      </div>
      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium outline-none focus:border-indigo-400 transition-colors" />
        </div>
      </div>
      <div className="px-4 mb-5">
        <button onClick={onCreate}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all">
          <Plus className="w-5 h-5" />New Event
        </button>
      </div>
      <div className="px-4 space-y-2.5 pb-8">
        {filtered.length === 0 ? (
          <div className="text-center py-14">
            <Receipt className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{search ? 'No matches' : 'No events yet'}</p>
          </div>
        ) : filtered.map(party => (
          <button key={party.id} onClick={() => onSelect(party)}
            className="w-full bg-white px-4 py-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-all text-left">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-gray-800 truncate text-sm">{party.name}</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">CODE: {party.shareCode}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ➕ CREATE PARTY
// ============================================================================
function CreatePartyForm({ user, onCancel, onSuccess, addToast }) {
  const [name, setName]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await addDoc(collection(db, 'parties'), {
        name: name.trim(), adminId: user.uid,
        adminName: user.displayName || user.email?.split('@')[0],
        shareCode, createdAt: serverTimestamp(),
      });
      addToast('Event created!', 'success'); onSuccess();
    } catch { addToast('Failed to create', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto pt-4">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-gray-500 mb-5 py-2 -ml-1">
          <ArrowLeft className="w-5 h-5" /><span className="font-bold text-sm">Back</span>
        </button>
        <div className="bg-white p-6 rounded-3xl shadow-sm">
          <h2 className="text-2xl font-black text-gray-800 mb-5">New Event</h2>
          <form onSubmit={submit}>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Event Name</label>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus maxLength={50}
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-lg text-slate-800 outline-none focus:border-indigo-500 transition-colors mb-1"
              placeholder="e.g. Goa Trip 2025" />
            <p className="text-xs text-gray-300 text-right mb-5">{name.length}/50</p>
            <div className="flex gap-3">
              <button type="submit" disabled={loading || !name.trim()}
                className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-indigo-100">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Event'}
              </button>
              <button type="button" onClick={onCancel} className="px-5 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 transition-all text-sm">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 💰 TRANSACTION MODAL
// ============================================================================
function TxModal({ type, members, onClose, onSave, initialData }) {
  const [amt, setAmt]         = useState(initialData?.amount || '');
  const [cat, setCat]         = useState(initialData?.category || (type === 'in' ? 'Cash' : 'Food'));
  const [who, setWho]         = useState(initialData?.memberId || '');
  const [payerId, setPayerId] = useState(initialData?.payerId || 'admin');
  const [split, setSplit]     = useState('all');
  const [chosen, setChosen]   = useState(new Set(members.map(m => m.id)));
  const amtRef = useRef(null);

  useEffect(() => { setTimeout(() => amtRef.current?.focus(), 300); }, []);

  const toggle = (id) => {
    const s = new Set(chosen);
    s.has(id) ? s.delete(id) : s.add(id);
    setChosen(s);
  };

  const save = () => {
    if (!amt || parseFloat(amt) <= 0) return alert('Enter a valid amount');
    if (!cat.trim()) return alert('Select or enter a category');
    const p = { type, amount: parseFloat(amt), category: cat, description: cat };
    if (type === 'in') {
      if (!who) return alert('Select who paid');
      const m = members.find(m => m.id === who);
      p.memberId = who; p.memberName = m.name;
    } else {
      if (payerId === 'admin') { p.payerId = 'admin'; p.payerName = 'Fund'; }
      else {
        const m = members.find(m => m.id === payerId);
        p.payerId = payerId; p.payerName = m?.name || 'Member';
      }
      p.involvedMemberIds = split === 'all' ? members.map(m => m.id) : Array.from(chosen);
      if (!p.involvedMemberIds.length) return alert('Select at least one person');
    }
    onSave(p);
  };

  const isExp = type === 'out';
  const splitCount = split === 'all' ? members.length : chosen.size;
  const perHead = amt && splitCount > 0 ? Math.round(parseFloat(amt) / splitCount) : null;

  return (
    <Sheet onClose={onClose}>
      <div className={`mx-4 mb-4 rounded-2xl p-4 ${isExp ? 'bg-rose-50 border border-rose-100' : 'bg-emerald-50 border border-emerald-100'}`}>
        <p className={`text-base font-black ${isExp ? 'text-rose-700' : 'text-emerald-700'}`}>
          {isExp ? '💸 Add Expense' : '💰 Add Income'}
        </p>
      </div>

      <div className="px-4 pb-10 space-y-5">
        {/* Amount */}
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</label>
          <div className={`flex items-center gap-2 border-b-2 mt-2 pb-2 transition-colors ${amt ? (isExp ? 'border-rose-400' : 'border-emerald-400') : 'border-gray-200'}`}>
            <span className="text-4xl font-black text-gray-300">₹</span>
            <input ref={amtRef} type="number" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)}
              placeholder="0" min="0" className="flex-1 text-4xl font-black text-slate-800 outline-none bg-transparent" />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2.5">Category</label>
          <CategorySelector type={type} value={cat} onChange={setCat} />
        </div>

        {/* Income: who paid in */}
        {type === 'in' && (
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Received From</label>
            <select value={who} onChange={e => setWho(e.target.value)}
              className="w-full p-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-700 outline-none text-sm">
              <option value="">Select person…</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}

        {/* Expense: paid by */}
        {type === 'out' && (
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Paid By</label>
            <select value={payerId} onChange={e => setPayerId(e.target.value)}
              className="w-full p-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-700 outline-none text-sm">
              <option value="admin">💼 Common Fund</option>
              {members.map(m => <option key={m.id} value={m.id}>👤 {m.name}</option>)}
            </select>
            {payerId !== 'admin' && (
              <p className="text-xs text-indigo-500 font-medium mt-1.5 ml-1">
                This person fronted the cash — they'll be reimbursed in settlement.
              </p>
            )}
          </div>
        )}

        {/* Expense: split */}
        {type === 'out' && (
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2.5">Split With</label>
            <div className="flex gap-2 mb-3">
              {['all', 'select'].map(m => (
                <button key={m} type="button" onClick={() => setSplit(m)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 ${split === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                  {m === 'all' ? `Everyone (${members.length})` : 'Select…'}
                </button>
              ))}
            </div>
            {split === 'select' && (
              <div className="grid grid-cols-2 gap-2">
                {members.map(m => {
                  const on = chosen.has(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => toggle(m.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-bold transition-all active:scale-95 ${on ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'}`}>
                      <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${on ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                        {on && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="truncate">{m.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {perHead && (
              <div className="mt-3 p-3 bg-gray-50 rounded-xl flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">Each person pays</span>
                <span className="text-base font-black text-gray-800">≈ ₹{perHead}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-gray-600 active:scale-95 transition-all text-sm">Cancel</button>
          <button type="button" onClick={save} disabled={!amt || !cat}
            className={`flex-1 py-4 rounded-2xl font-bold text-white active:scale-95 transition-all shadow-lg disabled:opacity-40 ${isExp ? 'bg-gradient-to-r from-rose-500 to-orange-500 shadow-rose-100' : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-100'}`}>
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// ============================================================================
// 📊 SETTLEMENT PANEL
// ============================================================================
function SettlementPanel({ report }) {
  if (!report) return (
    <div className="text-center py-8">
      <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
      <p className="text-gray-400 text-sm">Add members and transactions to see settlement.</p>
    </div>
  );

  const { settlements, transfers } = report;
  const allSettled = transfers.length === 0;

  return (
    <div className="space-y-4">
      {/* Transfer plan */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white">
        <p className="font-black text-base">Who pays whom</p>
        <p className="text-white/60 text-xs mt-0.5 mb-4">
          {allSettled ? 'All balances are zero 🎉' : `${transfers.length} transfer${transfers.length > 1 ? 's' : ''} needed to settle`}
        </p>
        {allSettled ? (
          <div className="bg-white/15 rounded-xl p-4 text-center">
            <p className="text-3xl mb-1">🎉</p>
            <p className="font-bold text-sm">Everyone is settled up!</p>
          </div>
        ) : transfers.map((t, i) => (
          <div key={i} className="bg-white/15 rounded-xl p-3.5 mb-2 flex items-center gap-3">
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm truncate max-w-[70px]">{t.from}</span>
                <ArrowRight className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />
                <span className="font-black text-sm truncate max-w-[70px]">{t.to}</span>
              </div>
              <p className="text-white/50 text-[10px] mt-0.5">pays</p>
            </div>
            <p className="text-2xl font-black flex-shrink-0">₹{t.amount}</p>
          </div>
        ))}
      </div>

      {/* Individual balances */}
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Individual balances</p>
      {settlements.sort((a, b) => b.net - a.net).map(s => {
        const owes = s.net < -0.5;
        const owed = s.net >  0.5;
        return (
          <div key={s.id} className={`bg-white rounded-2xl border-2 p-4 ${owes ? 'border-rose-200' : owed ? 'border-emerald-200' : 'border-gray-100'}`}>
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={s.name} />
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-800 truncate">{s.name}</p>
                <p className={`text-xs font-bold mt-0.5 ${owes ? 'text-rose-500' : owed ? 'text-emerald-500' : 'text-gray-400'}`}>
                  {owes ? 'Needs to pay' : owed ? 'Gets money back' : 'Settled ✓'}
                </p>
              </div>
              <p className={`text-2xl font-black ${owes ? 'text-rose-500' : owed ? 'text-emerald-500' : 'text-gray-300'}`}>
                {owes ? '-' : owed ? '+' : ''}₹{Math.round(Math.abs(s.net))}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-gray-50">
              <div className="bg-blue-50 rounded-xl p-2.5">
                <p className="text-blue-400 text-[10px] font-bold uppercase">Contributed / Paid</p>
                <p className="text-base font-black text-blue-900">₹{Math.round(s.paid)}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-2.5">
                <p className="text-purple-400 text-[10px] font-bold uppercase">Fair Share</p>
                <p className="text-base font-black text-purple-900">₹{Math.round(s.share)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// 📈 REPORT TABS
// ============================================================================
function ReportView({ transactions, members, report, stats }) {
  const [tab, setTab] = useState('summary');

  const memberDetails = useMemo(() => members.map(member => {
    const expenses = transactions.filter(t => {
      if (t.type !== 'out') return false;
      const ids = t.involvedMemberIds?.length ? t.involvedMemberIds : members.map(m => m.id);
      return ids.includes(member.id);
    });
    const catSpend = {};
    expenses.forEach(t => {
      const ids = t.involvedMemberIds?.length ? t.involvedMemberIds : members.map(m => m.id);
      const cat = t.category || 'Misc';
      catSpend[cat] = (catSpend[cat] || 0) + t.amount / ids.length;
    });
    const s = report?.settlements.find(s => s.id === member.id);
    return { ...member, catSpend, balance: s?.net || 0, paid: s?.paid || 0, share: s?.share || 0 };
  }), [members, transactions, report]);

  return (
    <div className="space-y-4">
      <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
        {[{ id: 'summary', label: 'Summary' }, { id: 'members', label: 'Members' }, { id: 'settle', label: 'Settlement' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: 'Collected', v: `₹${stats.collected}`, from: 'from-blue-500', to: 'to-blue-600' },
              { l: 'Spent',     v: `₹${stats.spent}`,     from: 'from-rose-500', to: 'to-rose-600' },
              { l: 'Balance',   v: `₹${stats.balance}`,   from: 'from-emerald-500', to: 'to-emerald-600' },
              { l: 'Txns',      v: transactions.length,   from: 'from-purple-500', to: 'to-purple-600' },
            ].map(c => (
              <div key={c.l} className={`bg-gradient-to-br ${c.from} ${c.to} text-white rounded-2xl p-4`}>
                <p className="text-white/70 text-xs mb-1">{c.l}</p>
                <p className="text-2xl font-black">{c.v}</p>
              </div>
            ))}
          </div>

          {report && Object.keys(report.categories).length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="font-black text-gray-800 mb-3 text-sm">Spending by Category</p>
              <div className="space-y-2.5">
                {Object.entries(report.categories).sort(([,a],[,b]) => b-a).map(([cat, amt], i) => {
                  const pct = parseFloat(stats.spent) > 0 ? ((amt / parseFloat(stats.spent)) * 100).toFixed(0) : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-sm font-bold text-gray-700">{cat}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-400">₹{amt.toFixed(0)} · {pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-3">
          {memberDetails.map(m => (
            <div key={m.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className={`p-4 flex items-center gap-3 ${m.balance >= 0.5 ? 'bg-emerald-50' : m.balance < -0.5 ? 'bg-rose-50' : 'bg-gray-50'}`}>
                <Avatar name={m.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-800 truncate">{m.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Paid ₹{Math.round(m.paid)} · Share ₹{Math.round(m.share)}</p>
                </div>
                <p className={`text-xl font-black ${m.balance >= 0.5 ? 'text-emerald-600' : m.balance < -0.5 ? 'text-rose-600' : 'text-gray-400'}`}>
                  {m.balance >= 0.5 ? '+' : ''}₹{Math.round(m.balance)}
                </p>
              </div>
              {Object.keys(m.catSpend).length > 0 && (
                <div className="p-4 space-y-2">
                  {Object.entries(m.catSpend).sort(([,a],[,b]) => b-a).map(([cat, val], idx) => (
                    <div key={cat} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                        <span className="text-sm font-bold text-gray-600">{cat}</span>
                      </div>
                      <span className="text-sm font-black text-gray-800">₹{Math.round(val)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {memberDetails.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">No members yet</div>
          )}
        </div>
      )}

      {tab === 'settle' && <SettlementPanel report={report} />}
    </div>
  );
}

// ============================================================================
// 🎯 PARTY DASHBOARD
// ============================================================================
function PartyDashboard({ user, party, onBack, addToast }) {
  const [tab, setTab]             = useState('home');
  const [txModal, setTxModal]     = useState(null);
  const [deleteTxId, setDeleteId] = useState(null);
  const [printMode, setPrintMode] = useState(false);

  const { data: membersRaw }  = useFirestoreCollection('members',      [where('partyId', '==', party.id)]);
  const { data: txnsRaw }     = useFirestoreCollection('transactions', [where('partyId', '==', party.id)]);

  const members = useMemo(() =>
    [...membersRaw].sort((a, b) => (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0)),
    [membersRaw]
  );

  const transactions = useMemo(() =>
    [...txnsRaw].sort((a, b) => {
      const dA = a.date?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
      const dB = b.date?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
      return dB - dA;
    }),
    [txnsRaw]
  );

  const isAdmin = party.adminId === user.uid;

  const stats = useMemo(() => {
    const spent     = transactions.filter(t => t.type === 'out').reduce((s, t) => s + Number(t.amount), 0);
    const collected = transactions.filter(t => t.type === 'in' ).reduce((s, t) => s + Number(t.amount), 0);
    const adminPaid = transactions.filter(t => t.type === 'out' && (!t.payerId || t.payerId === 'admin')).reduce((s, t) => s + Number(t.amount), 0);
    return { spent: spent.toFixed(0), collected: collected.toFixed(0), balance: (collected - adminPaid).toFixed(0) };
  }, [transactions]);

  const report = useMemo(() => calcSettlement(members, transactions), [members, transactions]);

  const saveTx = async (data) => {
    try {
      if (txModal?.editing) {
        await updateDoc(doc(db, 'transactions', txModal.editing.id), data);
        addToast('Updated!', 'success');
      } else {
        await addDoc(collection(db, 'transactions'), { ...data, partyId: party.id, date: serverTimestamp(), createdAt: serverTimestamp() });
        addToast('Added!', 'success');
      }
      setTxModal(null);
    } catch { addToast('Failed to save', 'error'); }
  };

  const deleteTx = async () => {
    try { await deleteDoc(doc(db, 'transactions', deleteTxId)); addToast('Deleted', 'success'); }
    catch { addToast('Failed', 'error'); }
    setDeleteId(null);
  };

  if (printMode) {
    return <PrintView party={party} stats={stats} report={report} transactions={transactions} members={members} onClose={() => setPrintMode(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {deleteTxId && <Confirm title="Delete transaction?" body="This cannot be undone." onConfirm={deleteTx} onCancel={() => setDeleteId(null)} />}

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 pt-5 pb-6">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="flex items-center gap-1.5 active:opacity-70 py-1">
            <ArrowLeft className="w-5 h-5" /><span className="font-bold text-sm">Events</span>
          </button>
          <button onClick={() => setPrintMode(true)} className="flex items-center gap-1.5 px-3 py-2 bg-white/15 rounded-xl text-xs font-bold active:opacity-70">
            <Printer className="w-3.5 h-3.5" />PDF
          </button>
        </div>
        <h1 className="text-xl font-black truncate">{party.name}</h1>
        <p className="text-white/50 font-mono text-xs mt-0.5 mb-4">CODE: {party.shareCode}</p>

        <div className="grid grid-cols-3 gap-2">
          {[{ l: 'Collected', v: `₹${stats.collected}` }, { l: 'Spent', v: `₹${stats.spent}` }, { l: 'In Hand', v: `₹${stats.balance}` }].map(c => (
            <div key={c.l} className="bg-white/12 rounded-xl p-2.5 text-center">
              <p className="text-white/50 text-[10px] font-bold">{c.l}</p>
              <p className="text-base font-black mt-0.5">{c.v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {tab === 'home' && (
          <div className="space-y-4">
            {isAdmin ? (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setTxModal({ type: 'in' })}
                  className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white py-5 rounded-2xl flex flex-col items-center gap-1.5 shadow-lg shadow-emerald-100 active:scale-95 transition-all">
                  <TrendingUp className="w-6 h-6" />
                  <span className="font-bold text-sm">Add Income</span>
                </button>
                <button onClick={() => setTxModal({ type: 'out' })}
                  className="bg-gradient-to-br from-rose-500 to-orange-500 text-white py-5 rounded-2xl flex flex-col items-center gap-1.5 shadow-lg shadow-rose-100 active:scale-95 transition-all">
                  <TrendingDown className="w-6 h-6" />
                  <span className="font-bold text-sm">Add Expense</span>
                </button>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                <Eye className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <p className="text-amber-700 font-bold text-sm">View only — admin can add transactions</p>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-3">
                <p className="font-black text-gray-800">Transactions</p>
                <span className="text-xs text-gray-400 font-bold bg-gray-100 px-2 py-1 rounded-full">{transactions.length}</span>
              </div>
              {transactions.length === 0 ? (
                <div className="text-center py-10">
                  <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {transactions.map(t => (
                    <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-3.5 flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${t.type === 'in' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                        {t.type === 'in' ? <TrendingUp className="text-emerald-600" size={17} /> : <TrendingDown className="text-rose-600" size={17} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm truncate">{t.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{t.type === 'in' ? `From ${t.memberName}` : `Paid by ${t.payerName || 'Fund'}`}</p>
                        {t.category && (
                          <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${catIdle(t.category)}`}>
                            {t.category}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className={`text-base font-black ${t.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === 'in' ? '+' : '-'}₹{t.amount}
                        </span>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <button onClick={() => setTxModal({ type: t.type, editing: t })}
                              className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 active:bg-indigo-50 active:text-indigo-500">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setDeleteId(t.id)}
                              className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 active:bg-rose-50 active:text-rose-500">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'friends' && (
          <MembersManager partyId={party.id} members={members} isAdmin={isAdmin} addToast={addToast} />
        )}

        {tab === 'report' && (
          <ReportView transactions={transactions} members={members} report={report} stats={stats} />
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 pt-2 pb-5 z-40">
        <div className="flex justify-around max-w-sm mx-auto">
          {[
            { id: 'home',    icon: Home,      label: 'Home' },
            { id: 'friends', icon: Users,     label: 'People' },
            { id: 'report',  icon: BarChart3, label: 'Report' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all active:scale-95 ${tab === t.id ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400'}`}>
              <t.icon className="w-5 h-5" />
              <span className="text-[10px] font-bold">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {txModal && (
        <TxModal type={txModal.type} members={members} initialData={txModal.editing || null}
          onClose={() => setTxModal(null)} onSave={saveTx} />
      )}
    </div>
  );
}

// ============================================================================
// 👥 MEMBERS MANAGER
// ============================================================================
function MembersManager({ partyId, members, isAdmin, addToast }) {
  const [name, setName]         = useState('');
  const [editing, setEditing]   = useState(null);
  const [editName, setEditName] = useState('');
  const [delId, setDelId]       = useState(null);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addDoc(collection(db, 'members'), { partyId, name: name.trim(), createdAt: serverTimestamp() });
      setName(''); addToast('Friend added!', 'success');
    } catch { addToast('Failed', 'error'); }
  };

  const saveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try {
      await updateDoc(doc(db, 'members', editing.id), { name: editName.trim() });
      setEditing(null); addToast('Updated!', 'success');
    } catch { addToast('Failed', 'error'); }
  };

  const del = async () => {
    try { await deleteDoc(doc(db, 'members', delId)); addToast('Removed', 'success'); }
    catch { addToast('Failed', 'error'); }
    setDelId(null);
  };

  return (
    <div className="space-y-4">
      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <div className="px-4 pb-10 pt-2 space-y-4">
            <p className="font-black text-gray-800 text-lg">Edit Name</p>
            <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-lg outline-none focus:border-indigo-500" />
            <div className="flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-gray-600 text-sm">Cancel</button>
              <button onClick={saveEdit} className="flex-1 py-4 bg-indigo-600 rounded-2xl font-bold text-white text-sm">Save</button>
            </div>
          </div>
        </Sheet>
      )}
      {delId && <Confirm title="Remove friend?" body="Won't delete their transactions." onConfirm={del} onCancel={() => setDelId(null)} />}

      {isAdmin && (
        <form onSubmit={add} className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Friend's name…"
            className="flex-1 bg-white border-2 border-gray-100 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none focus:border-indigo-400 transition-colors" />
          <button type="submit"
            className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 active:scale-95 transition-all flex-shrink-0">
            <Plus className="w-5 h-5" />
          </button>
        </form>
      )}

      <div className="space-y-2.5">
        {members.length === 0 ? (
          <div className="text-center py-10">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No friends added yet</p>
          </div>
        ) : members.map(m => (
          <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-3.5 flex items-center gap-3">
            <Avatar name={m.name} />
            <span className="flex-1 font-bold text-gray-800 truncate">{m.name}</span>
            {isAdmin && (
              <div className="flex gap-1.5">
                <button onClick={() => { setEditing(m); setEditName(m.name); }}
                  className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:bg-indigo-50 active:text-indigo-500">
                  <Pencil size={14} />
                </button>
                <button onClick={() => setDelId(m.id)}
                  className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:bg-rose-50 active:text-rose-500">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 🖨️ PRINT VIEW
// ============================================================================
function PrintView({ party, stats, report, transactions, members, onClose }) {
  const memberDetails = useMemo(() => members.map(member => {
    const expenses = transactions.filter(t => {
      if (t.type !== 'out') return false;
      const ids = t.involvedMemberIds?.length ? t.involvedMemberIds : members.map(m => m.id);
      return ids.includes(member.id);
    });
    const catSpend = {};
    expenses.forEach(t => {
      const ids = t.involvedMemberIds?.length ? t.involvedMemberIds : members.map(m => m.id);
      catSpend[t.category || 'Misc'] = (catSpend[t.category || 'Misc'] || 0) + t.amount / ids.length;
    });
    const s = report?.settlements.find(s => s.id === member.id);
    return { ...member, catSpend, balance: s?.net || 0, paid: s?.paid || 0, share: s?.share || 0 };
  }), [members, transactions, report]);

  if (!report) return null;

  return (
    <div className="min-h-screen bg-white p-6">
      <style>{`@media print{@page{size:A4;margin:1cm}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.np{display:none!important}.pb{break-before:page}.ab{break-inside:avoid}}`}</style>
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-end gap-2 mb-5 np">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-xl font-bold text-sm">Close</button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center gap-2">
            <Printer className="w-4 h-4" />Print
          </button>
        </div>

        <div className="mb-6 pb-4 border-b-4 border-indigo-600 ab">
          <div className="flex justify-between items-start">
            <div><h1 className="text-3xl font-black text-gray-900">{party.name}</h1><p className="text-gray-400 text-sm mt-1">Expense Report</p></div>
            <div className="text-right text-sm text-gray-500">
              <p className="font-black text-gray-900">{new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p className="font-mono text-xs mt-1">Code: {party.shareCode}</p>
            </div>
          </div>
        </div>

        <div className="mb-5 ab">
          <h2 className="text-lg font-black mb-3">Summary</h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { l:'Collected',v:`₹${stats.collected}`,bg:'bg-blue-50',bc:'border-blue-200',tc:'text-blue-600',vc:'text-blue-900'},
              { l:'Spent',v:`₹${stats.spent}`,bg:'bg-red-50',bc:'border-red-200',tc:'text-red-600',vc:'text-red-900'},
              { l:'Balance',v:`₹${stats.balance}`,bg:'bg-green-50',bc:'border-green-200',tc:'text-green-600',vc:'text-green-900'},
              { l:'Txns',v:transactions.length,bg:'bg-purple-50',bc:'border-purple-200',tc:'text-purple-600',vc:'text-purple-900'},
            ].map(c=>(
              <div key={c.l} className={`${c.bg} border-2 ${c.bc} rounded-lg p-3`}>
                <p className={`text-xs font-bold ${c.tc}`}>{c.l}</p>
                <p className={`text-2xl font-black ${c.vc} mt-1`}>{c.v}</p>
              </div>
            ))}
          </div>
        </div>

        {report.transfers.length > 0 && (
          <div className="mb-5 bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 ab">
            <h2 className="text-lg font-black mb-3">💸 Settlement Plan</h2>
            <div className="space-y-2">
              {report.transfers.map((t, i) => (
                <div key={i} className="bg-white border-2 border-indigo-200 rounded-lg p-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-black text-indigo-600">{i+1}</div>
                    <span className="font-black">{t.from}</span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="font-black">{t.to}</span>
                  </div>
                  <span className="text-2xl font-black text-indigo-600">₹{t.amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.keys(report.categories).length > 0 && (
          <div className="mb-5 ab">
            <h2 className="text-lg font-black mb-3">Spending by Category</h2>
            <table className="w-full border-2 border-gray-200 text-sm">
              <thead><tr className="bg-gray-100"><th className="text-left py-2 px-3 font-black">Category</th><th className="text-right py-2 px-3 font-black">Amount</th><th className="text-right py-2 px-3 font-black">%</th></tr></thead>
              <tbody>
                {Object.entries(report.categories).sort(([,a],[,b])=>b-a).map(([cat,amt],i)=>(
                  <tr key={cat} className={i%2===0?'bg-gray-50':'bg-white'}>
                    <td className="py-2 px-3 font-bold">{cat}</td>
                    <td className="py-2 px-3 text-right font-black">₹{amt.toFixed(0)}</td>
                    <td className="py-2 px-3 text-right text-gray-400">{parseFloat(stats.spent)>0?((amt/parseFloat(stats.spent))*100).toFixed(1):0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pb" />

        <div className="mb-5">
          <h2 className="text-lg font-black mb-3">Individual Breakdowns</h2>
          <div className="space-y-4">
            {memberDetails.map(m => (
              <div key={m.id} className={`border-2 rounded-lg overflow-hidden ab ${m.balance>=0?'border-green-300':'border-red-300'}`}>
                <div className={`p-3 flex justify-between items-center ${m.balance>=0?'bg-green-50':'bg-red-50'}`}>
                  <div>
                    <p className="font-black text-lg">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.balance>=0?'Gets money back':'Needs to pay'}</p>
                  </div>
                  <p className={`text-2xl font-black ${m.balance>=0?'text-green-600':'text-red-600'}`}>{m.balance>=0?'+':''}₹{Math.round(m.balance)}</p>
                </div>
                <div className="p-3 bg-white">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-blue-50 rounded p-2"><p className="text-xs text-blue-400 font-bold">Paid / Contributed</p><p className="text-lg font-black text-blue-900">₹{Math.round(m.paid)}</p></div>
                    <div className="bg-purple-50 rounded p-2"><p className="text-xs text-purple-400 font-bold">Fair Share</p><p className="text-lg font-black text-purple-900">₹{Math.round(m.share)}</p></div>
                  </div>
                  {Object.keys(m.catSpend).length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(m.catSpend).sort(([,a],[,b])=>b-a).map(([cat,val])=>(
                        <div key={cat} className="flex justify-between bg-gray-50 rounded p-2 text-xs">
                          <span className="font-bold text-gray-600">{cat}</span>
                          <span className="font-black">₹{Math.round(val)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pb" />

        <div className="mb-5">
          <h2 className="text-lg font-black mb-3">All Transactions</h2>
          <table className="w-full border-2 border-gray-200 text-xs">
            <thead><tr className="bg-gray-100">
              <th className="text-left py-2 px-2 font-black">Date</th>
              <th className="text-left py-2 px-2 font-black">Description</th>
              <th className="text-left py-2 px-2 font-black">Category</th>
              <th className="text-left py-2 px-2 font-black">Type</th>
              <th className="text-right py-2 px-2 font-black">Amount</th>
            </tr></thead>
            <tbody>
              {transactions.map((t,i)=>(
                <tr key={t.id} className={i%2===0?'bg-gray-50':'bg-white'}>
                  <td className="py-1.5 px-2 text-gray-400">{t.date?.toDate?new Date(t.date.toDate()).toLocaleDateString('en-IN'):'—'}</td>
                  <td className="py-1.5 px-2 font-bold">{t.description}</td>
                  <td className="py-1.5 px-2 text-gray-500">{t.category}</td>
                  <td className="py-1.5 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.type==='in'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{t.type==='in'?'Income':'Expense'}</span></td>
                  <td className={`py-1.5 px-2 text-right font-black ${t.type==='in'?'text-green-600':'text-red-600'}`}>{t.type==='in'?'+':'-'}₹{t.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-8 ab">
          <h2 className="text-lg font-black mb-3">Final Settlement</h2>
          <table className="w-full border-2 border-gray-200 text-sm">
            <thead><tr className="bg-gray-100"><th className="text-left py-2 px-3 font-black">Member</th><th className="text-right py-2 px-3 font-black">Paid</th><th className="text-right py-2 px-3 font-black">Share</th><th className="text-right py-2 px-3 font-black">Net</th></tr></thead>
            <tbody>
              {report.settlements.sort((a,b)=>b.net-a.net).map((s,i)=>(
                <tr key={s.id} className={i%2===0?'bg-gray-50':'bg-white'}>
                  <td className="py-2 px-3 font-bold">{s.name}</td>
                  <td className="py-2 px-3 text-right font-black">₹{Math.round(s.paid)}</td>
                  <td className="py-2 px-3 text-right font-black">₹{Math.round(s.share)}</td>
                  <td className={`py-2 px-3 text-right font-black ${s.net>=0?'text-green-600':'text-red-600'}`}>{s.net>=0?'+':''}₹{Math.round(s.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-2">+ = gets back · − = owes money</p>
        </div>

        <div className="text-center text-xs text-gray-400 border-t pt-4">
          Generated by <strong className="text-indigo-600">PartyFund</strong> · {new Date().toLocaleString('en-IN')}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 👁️ PUBLIC REPORT
// ============================================================================
function PublicReportView({ shareCode, onBack }) {
  const [party, setParty]     = useState(null);
  const [members, setMembers] = useState([]);
  const [txns, setTxns]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [printMode, setPrint] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const snap = await getDocs(query(collection(db, 'parties'), where('shareCode', '==', shareCode.toUpperCase())));
        if (snap.empty) { setError('Party not found — check your code.'); setLoading(false); return; }
        const p = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setParty(p);
        const mSnap = await getDocs(query(collection(db, 'members'), where('partyId', '==', p.id)));
        setMembers(mSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0)));
        const tSnap = await getDocs(query(collection(db, 'transactions'), where('partyId', '==', p.id)));
        setTxns(tSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
          const dA = a.date?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
          const dB = b.date?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
          return dB - dA;
        }));
        setLoading(false);
      } catch { setError('Failed to load. Try again.'); setLoading(false); }
    })();
  }, [shareCode]);

  const stats = useMemo(() => {
    const spent     = txns.filter(t => t.type === 'out').reduce((s, t) => s + Number(t.amount), 0);
    const collected = txns.filter(t => t.type === 'in' ).reduce((s, t) => s + Number(t.amount), 0);
    const adminPaid = txns.filter(t => t.type === 'out' && (!t.payerId || t.payerId === 'admin')).reduce((s, t) => s + Number(t.amount), 0);
    return { spent: spent.toFixed(0), collected: collected.toFixed(0), balance: (collected - adminPaid).toFixed(0) };
  }, [txns]);

  const report = useMemo(() => calcSettlement(members, txns), [members, txns]);

  if (loading) return <Spinner />;
  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-lg">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><XIcon className="w-7 h-7 text-red-500" /></div>
        <h2 className="text-xl font-black text-gray-800 mb-2">Not Found</h2>
        <p className="text-gray-400 text-sm mb-5">{error}</p>
        <button onClick={onBack} className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-2xl active:scale-95 transition-all">Try Again</button>
      </div>
    </div>
  );
  if (printMode) return <PrintView party={party} stats={stats} report={report} transactions={txns} members={members} onClose={() => setPrint(false)} />;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 pt-5 pb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 mb-3 active:opacity-70 py-1">
          <ArrowLeft className="w-5 h-5" /><span className="font-bold text-sm">Back</span>
        </button>
        <div className="bg-yellow-400/20 border border-yellow-300/30 rounded-xl p-3 mb-4 flex items-center gap-2.5">
          <Eye className="w-4 h-4 flex-shrink-0" />
          <p className="font-bold text-sm">View-Only · No login required</p>
        </div>
        <div className="flex justify-between items-start mb-4">
          <div><h1 className="text-xl font-black truncate">{party.name}</h1><p className="text-white/50 font-mono text-xs mt-0.5">CODE: {party.shareCode}</p></div>
          <button onClick={() => setPrint(true)} className="flex items-center gap-1.5 px-3 py-2 bg-white/15 rounded-xl text-xs font-bold active:opacity-70 flex-shrink-0 ml-3">
            <Printer className="w-3.5 h-3.5" />PDF
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{ l:'Collected',v:`₹${stats.collected}`},{l:'Spent',v:`₹${stats.spent}`},{l:'In Hand',v:`₹${stats.balance}`}].map(c=>(
            <div key={c.l} className="bg-white/12 rounded-xl p-2.5 text-center">
              <p className="text-white/50 text-[10px] font-bold">{c.l}</p>
              <p className="text-base font-black mt-0.5">{c.v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">
        <div>
          <p className="font-black text-gray-800 mb-3 text-sm">Settlement</p>
          <SettlementPanel report={report} />
        </div>
        <div>
          <p className="font-black text-gray-800 mb-3 text-sm">Transactions ({txns.length})</p>
          <div className="space-y-2.5">
            {txns.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-3.5 flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${t.type==='in'?'bg-emerald-50':'bg-rose-50'}`}>
                  {t.type==='in'?<TrendingUp className="text-emerald-600" size={17}/>:<TrendingDown className="text-rose-600" size={17}/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm truncate">{t.description}</p>
                  <p className="text-xs text-gray-400">{t.type==='in'?`From ${t.memberName}`:`Paid by ${t.payerName||'Fund'}`}</p>
                  {t.category&&<span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${catIdle(t.category)}`}>{t.category}</span>}
                </div>
                <span className={`text-base font-black flex-shrink-0 ${t.type==='in'?'text-emerald-600':'text-rose-600'}`}>{t.type==='in'?'+':'-'}₹{t.amount}</span>
              </div>
            ))}
            {txns.length===0&&<div className="text-center py-8 text-gray-400 text-sm">No transactions yet</div>}
          </div>
        </div>
        <div>
          <p className="font-black text-gray-800 mb-3 text-sm">Members</p>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {members.map(m=>(
              <div key={m.id} className="p-3.5 flex items-center gap-3">
                <Avatar name={m.name} size="sm" />
                <span className="font-bold text-gray-800 text-sm">{m.name}</span>
              </div>
            ))}
            {members.length===0&&<div className="p-6 text-center text-gray-400 text-sm">No members</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 🚀 ROOT
// ============================================================================
export default function App() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState('list');
  const [party, setParty]     = useState(null);
  const [pubCode, setPubCode] = useState(null);
  const { toasts, addToast }  = useToast();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); });
    return unsub;
  }, []);

  const logout = async () => {
    try { await signOut(auth); setView('list'); setParty(null); addToast('Signed out', 'success'); }
    catch { addToast('Logout failed', 'error'); }
  };

  if (loading)  return <Spinner />;
  if (pubCode)  return <><Toast toasts={toasts} /><PublicReportView shareCode={pubCode} onBack={() => setPubCode(null)} /></>;
  if (!user)    return <LoginScreen onViewReport={c => setPubCode(c)} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast toasts={toasts} />

      {view !== 'detail' && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-30">
          <p className="text-lg font-black">PartyFund</p>
          <div className="flex items-center gap-3">
            <p className="text-xs text-white/60 max-w-[130px] truncate">{user.email}</p>
            <button onClick={logout} className="p-2 rounded-xl active:bg-white/10 active:scale-90 transition-all"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {view === 'list'   && <PartyList user={user} onCreate={() => setView('create')} onSelect={p => { setParty(p); setView('detail'); }} />}
      {view === 'create' && <CreatePartyForm user={user} onCancel={() => setView('list')} onSuccess={() => setView('list')} addToast={addToast} />}
      {view === 'detail' && party && <PartyDashboard user={user} party={party} onBack={() => { setParty(null); setView('list'); }} addToast={addToast} />}
    </div>
  );
}
