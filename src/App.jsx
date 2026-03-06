import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Plus, Users, Receipt, ArrowLeft, TrendingUp, TrendingDown, Trash2, Home, BarChart3, Pencil, Printer, LogOut, Loader2, X as XIcon, Check, Tag, Calendar, Search, DollarSign, Eye } from 'lucide-react';

// ============================================================================
// 🔥 FIREBASE CONFIGURATION
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
const EXPENSE_CATEGORIES = ['Food', 'Hotel', 'Drinks', 'Travel', 'Shopping', 'Entertainment', 'Misc'];
const INCOME_CATEGORIES = ['Cash', 'Online', 'UPI', 'Card'];
const COLORS = ['#F87171', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#9CA3AF', '#F472B6', '#818CF8'];

const CHIP_COLORS = {
  Food:          'bg-orange-100 text-orange-700 border-orange-300',
  Hotel:         'bg-blue-100 text-blue-700 border-blue-300',
  Drinks:        'bg-purple-100 text-purple-700 border-purple-300',
  Travel:        'bg-cyan-100 text-cyan-700 border-cyan-300',
  Shopping:      'bg-pink-100 text-pink-700 border-pink-300',
  Entertainment: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  Misc:          'bg-gray-100 text-gray-600 border-gray-300',
  Cash:          'bg-green-100 text-green-700 border-green-300',
  Online:        'bg-indigo-100 text-indigo-700 border-indigo-300',
  UPI:           'bg-violet-100 text-violet-700 border-violet-300',
  Card:          'bg-sky-100 text-sky-700 border-sky-300',
};

const CHIP_COLORS_ACTIVE = {
  Food:          'bg-orange-500 text-white border-orange-500',
  Hotel:         'bg-blue-500 text-white border-blue-500',
  Drinks:        'bg-purple-500 text-white border-purple-500',
  Travel:        'bg-cyan-500 text-white border-cyan-500',
  Shopping:      'bg-pink-500 text-white border-pink-500',
  Entertainment: 'bg-yellow-500 text-white border-yellow-500',
  Misc:          'bg-gray-500 text-white border-gray-500',
  Cash:          'bg-green-500 text-white border-green-500',
  Online:        'bg-indigo-500 text-white border-indigo-500',
  UPI:           'bg-violet-500 text-white border-violet-500',
  Card:          'bg-sky-500 text-white border-sky-500',
};

// ============================================================================
// 🪝 CUSTOM HOOKS
// ============================================================================
const useFirestoreCollection = (collectionName, constraints = []) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      let q = collection(db, collectionName);
      if (constraints.length > 0) q = query(q, ...constraints);

      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setData(items);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('Firestore error:', err);
          setError(err.message);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [collectionName, JSON.stringify(constraints)]);

  return { data, loading, error };
};

const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  return { toasts, addToast };
};

// ============================================================================
// 🎯 UTILITY COMPONENTS
// ============================================================================
function Toast({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-white font-medium ${
            toast.type === 'success' ? 'bg-green-500' :
            toast.type === 'error' ? 'bg-red-500' :
            toast.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-white animate-spin mx-auto" />
        <p className="mt-4 text-white font-bold">Loading...</p>
      </div>
    </div>
  );
}

function ErrorBoundary({ children, error }) {
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50 p-4">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }
  return children;
}

// ============================================================================
// 🏷️ CATEGORY SELECTOR
// ============================================================================
function CategorySelector({ type, value, onChange }) {
  const presets = type === 'in' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isPreset = presets.includes(value);

  const [showCustomInput, setShowCustomInput] = useState(!isPreset && !!value);
  const [customDraft, setCustomDraft] = useState(!isPreset ? value : '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (showCustomInput && inputRef.current) inputRef.current.focus();
  }, [showCustomInput]);

  const selectPreset = (cat) => {
    setShowCustomInput(false);
    setCustomDraft('');
    onChange(cat);
  };

  const openCustom = () => {
    setShowCustomInput(true);
    onChange('');
    setCustomDraft('');
  };

  const handleCustomChange = (e) => {
    const val = e.target.value;
    setCustomDraft(val);
    onChange(val.trim() || '');
  };

  const clearCustom = () => {
    setShowCustomInput(false);
    setCustomDraft('');
    onChange(presets[0]);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {presets.map((cat) => {
          const isActive = value === cat && !showCustomInput;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => selectPreset(cat)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2
                transition-all duration-150 active:scale-95
                ${isActive
                  ? (CHIP_COLORS_ACTIVE[cat] || 'bg-slate-800 text-white border-slate-800')
                  : (CHIP_COLORS[cat] || 'bg-gray-100 text-gray-600 border-gray-200') + ' hover:opacity-80'}
              `}
            >
              {isActive && <Check className="w-3 h-3" />}
              {cat}
            </button>
          );
        })}

        {!showCustomInput && (
          <button
            type="button"
            onClick={openCustom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 border-dashed border-indigo-300 text-indigo-500 hover:bg-indigo-50 transition-all active:scale-95"
          >
            <Plus className="w-3 h-3" />
            Custom
          </button>
        )}
      </div>

      {showCustomInput && (
        <div className="flex items-center gap-2 bg-indigo-50 border-2 border-indigo-200 rounded-xl px-3 py-2">
          <span className="text-indigo-400 text-xs font-bold whitespace-nowrap">Custom:</span>
          <input
            ref={inputRef}
            type="text"
            value={customDraft}
            onChange={handleCustomChange}
            placeholder={`e.g. ${type === 'in' ? 'Sponsorship' : 'Medical'}`}
            maxLength={30}
            className="flex-1 bg-transparent text-sm font-bold text-indigo-900 placeholder-indigo-300 outline-none"
          />
          {customDraft && (
            <span className="text-xs text-indigo-400 font-mono">{customDraft.length}/30</span>
          )}
          <button
            type="button"
            onClick={clearCustom}
            className="p-1 rounded-full hover:bg-indigo-200 text-indigo-400 transition-colors"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showCustomInput && customDraft && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Selected:</span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm">
            <Check className="w-3 h-3" />
            {customDraft}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 🔐 AUTHENTICATION
// ============================================================================
function LoginScreen({ onViewReport }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [shareCode, setShareCode] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = () => {
    if (!shareCode.trim()) { setError('Please enter a share code'); return; }
    onViewReport(shareCode.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
        .animate-float { animation: float 3s ease-in-out infinite; }
      `}</style>
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center animate-float">
            <Receipt className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-gray-800 mb-2">PartyFund</h1>
          <p className="text-gray-500 font-medium">Split expenses with friends</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
        )}

        {!showCodeInput ? (
          <>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all hover:shadow-lg active:scale-95 disabled:opacity-50 mb-4"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-4 bg-white text-gray-500 font-medium">OR</span></div>
            </div>

            <button
              onClick={() => setShowCodeInput(true)}
              className="w-full bg-gradient-to-r from-indigo-100 to-purple-100 border-2 border-indigo-200 text-indigo-700 font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all hover:shadow-lg active:scale-95"
            >
              <BarChart3 className="w-5 h-5" />
              View Report by Code
            </button>
            <p className="mt-6 text-center text-xs text-gray-400">Admins sign in to create parties. Anyone can view reports with share code.</p>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Enter Share Code</label>
              <input
                type="text"
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleViewReport()}
                placeholder="ABC123"
                maxLength={6}
                className="w-full px-4 py-4 text-center text-2xl font-black tracking-widest uppercase bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors"
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500 text-center">6-character code shared by trip admin</p>
            </div>
            <button onClick={handleViewReport} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 px-6 rounded-xl hover:shadow-lg active:scale-95 transition-all">View Report</button>
            <button onClick={() => { setShowCodeInput(false); setShareCode(''); setError(''); }} className="w-full bg-gray-100 text-gray-700 font-bold py-3 px-6 rounded-xl hover:bg-gray-200 active:scale-95 transition-all">Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 📝 PARTY LIST
// ============================================================================
function PartyList({ user, onCreate, onSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: parties, loading, error } = useFirestoreCollection('parties', [
    where('adminId', '==', user.uid)
  ]);

  const filteredParties = useMemo(() => {
    return parties
      .filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.shareCode.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
  }, [parties, searchTerm]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBoundary error={error} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-gray-800 mb-2">My Events</h1>
          <p className="text-gray-500">Manage expenses with friends</p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search parties..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={onCreate}
          className="w-full mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 hover:shadow-lg active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          New Event
        </button>

        {filteredParties.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">{searchTerm ? 'No parties found' : 'No events yet. Create one!'}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredParties.map(party => (
              <div
                key={party.id}
                onClick={() => onSelect(party)}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-gray-800 mb-1 group-hover:text-indigo-600 transition-colors">{party.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="font-mono font-bold">CODE: {party.shareCode}</span>
                      <span>•</span>
                      <span>{new Date(party.createdAt?.toDate()).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="bg-indigo-50 rounded-full p-3 group-hover:bg-indigo-100 transition-colors">
                    <ArrowLeft className="w-5 h-5 text-indigo-600 rotate-180" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ➕ CREATE PARTY
// ============================================================================
function CreatePartyForm({ user, onCancel, onSuccess, addToast }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { addToast('Please enter a party name', 'error'); return; }
    setLoading(true);
    try {
      const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await addDoc(collection(db, 'parties'), {
        name: name.trim(),
        adminId: user.uid,
        adminName: user.displayName || user.email.split('@')[0],
        shareCode,
        createdAt: serverTimestamp()
      });
      addToast('Party created successfully!', 'success');
      onSuccess();
    } catch (error) {
      addToast('Failed to create party', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-md mx-auto pt-8">
        <button onClick={onCancel} className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-800">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold">Back</span>
        </button>
        <div className="bg-white p-8 rounded-3xl shadow-lg">
          <h2 className="text-3xl font-black text-gray-800 mb-6">Create New Event</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">Event Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={50}
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xl text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="e.g. Goa Trip 2024"
              />
              <p className="mt-2 text-xs text-gray-400">{name.length}/50 characters</p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 px-6 rounded-xl hover:shadow-lg active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Event'}
              </button>
              <button type="button" onClick={onCancel} className="px-6 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 💰 TRANSACTION MODAL  (with smart category selector)
// ============================================================================
function TransactionModal({ type, members, onClose, onSave, initialData }) {
  const [amt, setAmt] = useState(initialData?.amount || '');
  const [cat, setCat] = useState(initialData?.category || (type === 'in' ? 'Cash' : 'Food'));
  const [who, setWho] = useState(initialData?.memberId || '');
  const [payerId, setPayerId] = useState(initialData?.payerId || 'admin');
  const [splitMode, setSplitMode] = useState('all');
  const [selectedSplitIds, setSelectedSplitIds] = useState(new Set(members.map(m => m.id)));
  const amtRef = useRef(null);

  useEffect(() => { if (amtRef.current) amtRef.current.focus(); }, []);

  const handleSave = () => {
    if (!amt) return alert('Please enter amount');
    if (!cat) return alert('Please select or enter a category');

    const payload = { type, amount: parseFloat(amt), category: cat, description: cat };

    if (type === 'in') {
      if (!who) return alert('Select who gave money');
      const mem = members.find(m => m.id === who);
      payload.memberId = who;
      payload.memberName = mem.name;
    } else {
      if (payerId === 'admin') {
        payload.payerId = 'admin';
        payload.payerName = 'Fund';
      } else {
        const payer = members.find(m => m.id === payerId);
        payload.payerId = payerId;
        payload.payerName = payer?.name || 'Member';
      }
      payload.involvedMemberIds = splitMode === 'all'
        ? members.map(m => m.id)
        : Array.from(selectedSplitIds);
    }

    onSave(payload);
  };

  const isExpense = type === 'out';
  const accentFrom = isExpense ? 'from-rose-500' : 'from-emerald-500';
  const accentTo   = isExpense ? 'to-orange-500' : 'to-teal-500';

  const splitCount = splitMode === 'all' ? members.length : selectedSplitIds.size;
  const perPerson = amt && splitCount > 0 ? (parseFloat(amt) / splitCount).toFixed(0) : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-4 md:items-center">
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl">

        {/* Colored header */}
        <div className={`bg-gradient-to-r ${accentFrom} ${accentTo} p-5 rounded-t-3xl`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white">
              {isExpense ? '💸 Add Expense' : '💰 Add Income'}
            </h2>
            <button type="button" onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
              <XIcon className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Amount</label>
            <div className="flex items-center gap-2 border-b-2 border-slate-200 focus-within:border-indigo-500 transition-colors pb-2">
              <span className="text-3xl font-black text-gray-400">₹</span>
              <input
                ref={amtRef}
                type="number"
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                className="flex-1 text-3xl font-black text-slate-800 outline-none bg-transparent"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Category</label>
            <CategorySelector type={type} value={cat} onChange={setCat} />
          </div>

          {/* Income: from whom */}
          {type === 'in' && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Received From</label>
              <select
                value={who}
                onChange={(e) => setWho(e.target.value)}
                className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-400 transition-colors"
              >
                <option value="">Select person…</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          {/* Expense: paid by */}
          {type === 'out' && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Paid By</label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-400 transition-colors"
              >
                <option value="admin">💼 Fund (Admin)</option>
                {members.map(m => <option key={m.id} value={m.id}>👤 {m.name}</option>)}
              </select>
            </div>
          )}

          {/* Expense: split with */}
          {type === 'out' && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Split With</label>
              <div className="flex gap-2 mb-3">
                {['all', 'select'].map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSplitMode(mode)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                      splitMode === mode
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    {mode === 'all' ? `Everyone (${members.length})` : 'Select people'}
                  </button>
                ))}
              </div>

              {splitMode === 'select' && (
                <div className="grid grid-cols-2 gap-2">
                  {members.map(m => {
                    const active = selectedSplitIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          const next = new Set(selectedSplitIds);
                          active ? next.delete(m.id) : next.add(m.id);
                          setSelectedSplitIds(next);
                        }}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                          active
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${active ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                          {active && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="truncate">{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {perPerson && (
                <p className="mt-2 text-xs text-gray-500 font-medium">
                  Each person pays ≈ ₹{perPerson}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-gray-100 rounded-xl font-bold text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!amt || !cat}
              className={`flex-1 py-3.5 bg-gradient-to-r ${accentFrom} ${accentTo} text-white font-bold rounded-xl hover:shadow-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 📊 ENHANCED REPORT VIEW
// ============================================================================
function EnhancedReport({ party, transactions, members, reportData, stats }) {
  const [activeTab, setActiveTab] = useState('overview');

  const memberDetails = useMemo(() => {
    return members.map(member => {
      const paidTransactions = transactions.filter(t =>
        (t.type === 'in' && t.memberId === member.id) ||
        (t.type === 'out' && t.payerId === member.id)
      );
      const involvedExpenses = transactions.filter(t => {
        if (t.type !== 'out') return false;
        const involvedIds = (t.involvedMemberIds && t.involvedMemberIds.length)
          ? t.involvedMemberIds : members.map(m => m.id);
        return involvedIds.includes(member.id);
      });
      const categorySpending = {};
      involvedExpenses.forEach(t => {
        const splitIds = (t.involvedMemberIds && t.involvedMemberIds.length)
          ? t.involvedMemberIds : members.map(m => m.id);
        const shareAmount = t.amount / splitIds.length;
        const cat = t.category || 'Misc';
        categorySpending[cat] = (categorySpending[cat] || 0) + shareAmount;
      });
      const totalPaid = paidTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const totalShare = involvedExpenses.reduce((sum, t) => {
        const splitIds = (t.involvedMemberIds && t.involvedMemberIds.length)
          ? t.involvedMemberIds : members.map(m => m.id);
        return sum + (t.amount / splitIds.length);
      }, 0);
      return { ...member, paidTransactions, involvedExpenses, categorySpending, totalPaid, totalShare, balance: totalPaid - totalShare };
    });
  }, [members, transactions]);

  const timelineData = useMemo(() => {
    const grouped = {};
    transactions.forEach(t => {
      const date = new Date(t.date?.toDate()).toLocaleDateString();
      if (!grouped[date]) grouped[date] = { income: 0, expenses: 0, transactions: [] };
      if (t.type === 'in') grouped[date].income += Number(t.amount);
      else grouped[date].expenses += Number(t.amount);
      grouped[date].transactions.push(t);
    });
    return Object.entries(grouped).map(([date, data]) => ({ date, ...data })).reverse();
  }, [transactions]);

  const paymentSuggestions = useMemo(() => {
    if (!reportData) return [];
    const debtors = reportData.settlements.filter(s => s.net < 0).map(s => ({...s})).sort((a, b) => a.net - b.net);
    const creditors = reportData.settlements.filter(s => s.net > 0).map(s => ({...s})).sort((a, b) => b.net - a.net);
    const suggestions = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debt = Math.abs(debtors[i].net);
      const credit = creditors[j].net;
      const amount = Math.min(debt, credit);
      suggestions.push({ from: debtors[i].name, to: creditors[j].name, amount: Math.round(amount) });
      debtors[i].net += amount;
      creditors[j].net -= amount;
      if (Math.abs(debtors[i].net) < 1) i++;
      if (Math.abs(creditors[j].net) < 1) j++;
    }
    return suggestions;
  }, [reportData]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'settlement', label: 'Settlement', icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1 flex gap-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 px-3 py-3 rounded-lg font-bold text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Collected', value: `₹${stats.collected}`, from: 'from-blue-500', to: 'to-blue-600', sub: 'blue' },
              { label: 'Total Spent',     value: `₹${stats.spent}`,     from: 'from-red-500',  to: 'to-red-600',  sub: 'red' },
              { label: 'Balance',         value: `₹${stats.balance}`,   from: 'from-green-500',to: 'to-green-600',sub: 'green' },
              { label: 'Transactions',    value: transactions.length,    from: 'from-purple-500',to:'to-purple-600',sub:'purple'},
            ].map(card => (
              <div key={card.label} className={`bg-gradient-to-br ${card.from} ${card.to} text-white p-6 rounded-2xl shadow-lg`}>
                <p className={`text-${card.sub}-100 text-sm mb-1`}>{card.label}</p>
                <p className="text-3xl font-black">{card.value}</p>
              </div>
            ))}
          </div>

          {reportData && Object.keys(reportData.categories).length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-black text-gray-800 mb-4">Spending Distribution</h3>
              <div className="space-y-3">
                {Object.entries(reportData.categories).sort(([,a],[,b]) => b-a).map(([cat, amount], i) => {
                  const percentage = ((amount / parseFloat(stats.spent)) * 100).toFixed(1);
                  return (
                    <div key={cat}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="font-bold text-gray-700">{cat}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-600">₹{amount.toFixed(0)} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {reportData && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xl font-black text-gray-800 mb-4">💸 Who Owes Whom?</h3>
              {paymentSuggestions.length > 0 ? (
                <div className="space-y-3">
                  {paymentSuggestions.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-500 rounded-full flex items-center justify-center text-white font-black text-sm">
                        {s.from.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-800">{s.from} → {s.to}</p>
                        <p className="text-sm text-gray-600">Payment needed</p>
                      </div>
                      <p className="text-2xl font-black text-indigo-600">₹{s.amount}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Everyone is settled up! 🎉</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Members */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <h3 className="text-2xl font-black text-gray-800">Individual Breakdowns</h3>
          {memberDetails.map(member => (
            <div key={member.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className={`p-6 ${member.balance >= 0 ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-gradient-to-r from-rose-500 to-red-500'} text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-black">
                      {member.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-2xl font-black">{member.name}</h4>
                      <p className="text-white/80 text-sm">{member.involvedExpenses.length} expenses</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white/80 mb-1">Net Balance</p>
                    <p className="text-3xl font-black">{member.balance >= 0 ? '+' : ''}₹{Math.round(member.balance)}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-blue-600 text-sm font-bold mb-1">Total Paid</p>
                    <p className="text-2xl font-black text-blue-900">₹{Math.round(member.totalPaid)}</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4">
                    <p className="text-purple-600 text-sm font-bold mb-1">Total Share</p>
                    <p className="text-2xl font-black text-purple-900">₹{Math.round(member.totalShare)}</p>
                  </div>
                </div>
                {Object.keys(member.categorySpending).length > 0 && (
                  <div>
                    <h5 className="font-black text-gray-800 mb-3">Category-wise Spending</h5>
                    <div className="space-y-2">
                      {Object.entries(member.categorySpending).sort(([,a],[,b]) => b-a).map(([cat, amount], idx) => (
                        <div key={cat} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            <span className="font-bold text-gray-700">{cat}</span>
                          </div>
                          <span className="font-black text-gray-900">₹{Math.round(amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Categories */}
      {activeTab === 'categories' && reportData && (
        <div className="space-y-6">
          <h3 className="text-2xl font-black text-gray-800">Category Analysis</h3>
          <div className="grid gap-4">
            {Object.entries(reportData.categories).sort(([,a],[,b]) => b-a).map(([category, total], i) => {
              const contributors = memberDetails.map(m => ({ name: m.name, amount: m.categorySpending[category] || 0 })).filter(c => c.amount > 0);
              return (
                <div key={category} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 text-white" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-2xl font-black">{category}</h4>
                      <p className="text-3xl font-black">₹{total.toFixed(0)}</p>
                    </div>
                    <p className="text-white/80 mt-1">{((total / parseFloat(stats.spent)) * 100).toFixed(1)}% of total</p>
                  </div>
                  <div className="p-6">
                    <h5 className="font-black text-gray-800 mb-3">Member Contributions</h5>
                    <div className="space-y-2">
                      {contributors.map(c => (
                        <div key={c.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="font-bold text-gray-700">{c.name}</span>
                          <div className="text-right">
                            <span className="font-black text-gray-900">₹{Math.round(c.amount)}</span>
                            <span className="text-sm text-gray-500 ml-2">({((c.amount / total) * 100).toFixed(0)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <h3 className="text-2xl font-black text-gray-800">Daily Timeline</h3>
          {timelineData.map((day, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-4 flex items-center justify-between">
                <p className="font-black text-lg">{day.date}</p>
                <div className="flex gap-4">
                  {day.income > 0 && <span className="text-green-300 text-sm font-bold">+₹{day.income}</span>}
                  {day.expenses > 0 && <span className="text-red-300 text-sm font-bold">-₹{day.expenses}</span>}
                </div>
              </div>
              <div className="p-4 space-y-2">
                {day.transactions.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${t.type === 'in' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {t.type === 'in' ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm">{t.description}</p>
                        <p className="text-xs text-gray-500">{t.type === 'in' ? `From ${t.memberName}` : `Paid by ${t.payerName || 'Fund'}`}</p>
                      </div>
                    </div>
                    <span className={`font-black ${t.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.type === 'in' ? '+' : '-'}₹{t.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settlement */}
      {activeTab === 'settlement' && reportData && (
        <div className="space-y-6">
          <h3 className="text-2xl font-black text-gray-800">Final Settlement</h3>
          {paymentSuggestions.length > 0 && (
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
              <h4 className="text-xl font-black mb-4">💸 Simplest Settlement Plan</h4>
              <p className="text-white/80 mb-4">{paymentSuggestions.length} payment(s) to settle everyone</p>
              <div className="space-y-3">
                {paymentSuggestions.map((s, i) => (
                  <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-black text-lg">{s.from} → {s.to}</p>
                      <p className="text-white/80 text-sm">Payment #{i + 1}</p>
                    </div>
                    <p className="text-3xl font-black">₹{s.amount}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3">
            {reportData.settlements.sort((a, b) => b.net - a.net).map(s => (
              <div key={s.id} className={`bg-white rounded-xl border-2 p-6 ${s.net >= 0 ? 'border-emerald-500' : 'border-rose-500'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black ${s.net >= 0 ? 'bg-gradient-to-br from-emerald-500 to-green-500' : 'bg-gradient-to-br from-rose-500 to-red-500'}`}>
                      {s.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-gray-800 text-lg">{s.name}</p>
                      <p className="text-sm text-gray-500">{s.net >= 0 ? 'Gets money back' : 'Needs to pay'}</p>
                    </div>
                  </div>
                  <p className={`text-3xl font-black ${s.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {s.net >= 0 ? '+' : ''}₹{Math.round(s.net)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <div><p className="text-sm text-gray-500 mb-1">Total Paid</p><p className="text-xl font-black text-gray-800">₹{Math.round(s.paid)}</p></div>
                  <div><p className="text-sm text-gray-500 mb-1">Fair Share</p><p className="text-xl font-black text-gray-800">₹{Math.round(s.share)}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 🎯 PARTY DASHBOARD
// ============================================================================
function PartyDashboard({ user, party, onBack, addToast }) {
  const [tab, setTab] = useState('home');
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('out');
  const [editingTx, setEditingTx] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [printMode, setPrintMode] = useState(false);

  const { data: membersRaw } = useFirestoreCollection('members', [where('partyId', '==', party.id)]);
  const { data: transactionsRaw } = useFirestoreCollection('transactions', [where('partyId', '==', party.id)]);

  const members = useMemo(() => [...membersRaw].sort((a, b) => {
    const dA = a.createdAt?.toDate?.() || new Date(0);
    const dB = b.createdAt?.toDate?.() || new Date(0);
    return dA - dB;
  }), [membersRaw]);

  const transactions = useMemo(() => [...transactionsRaw].sort((a, b) => {
    const dA = a.date?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
    const dB = b.date?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
    return dB - dA;
  }), [transactionsRaw]);

  const isAdmin = party.adminId === user.uid;

  const stats = useMemo(() => {
    const spent = transactions.filter(t => t.type === 'out').reduce((s, t) => s + Number(t.amount), 0);
    const collected = transactions.filter(t => t.type === 'in').reduce((s, t) => s + Number(t.amount), 0);
    const adminPaid = transactions.filter(t => t.type === 'out' && (!t.payerId || t.payerId === 'admin')).reduce((s, t) => s + Number(t.amount), 0);
    return { spent: spent.toFixed(2), collected: collected.toFixed(2), balance: (collected - adminPaid).toFixed(2) };
  }, [transactions]);

  const reportData = useMemo(() => {
    if (!members.length) return null;
    const balances = {};
    members.forEach(m => balances[m.id] = { paid: 0, share: 0, name: m.name });
    const categories = {};
    transactions.forEach(t => {
      if (t.type === 'out') {
        const amt = Number(t.amount);
        categories[t.category || 'Misc'] = (categories[t.category || 'Misc'] || 0) + amt;
        if (t.payerId && t.payerId !== 'admin' && balances[t.payerId]) balances[t.payerId].paid += amt;
        const splitIds = (t.involvedMemberIds && t.involvedMemberIds.length) ? t.involvedMemberIds : members.map(m => m.id);
        const splitAmt = amt / splitIds.length;
        splitIds.forEach(id => { if (balances[id]) balances[id].share += splitAmt; });
      } else if (t.type === 'in') {
        if (t.memberId && balances[t.memberId]) balances[t.memberId].paid += Number(t.amount);
      }
    });
    return {
      settlements: Object.entries(balances).map(([id, d]) => ({ id, ...d, net: d.paid - d.share })),
      categories
    };
  }, [members, transactions]);

  const handleSaveTx = async (txData) => {
    try {
      if (editingTx) {
        await updateDoc(doc(db, 'transactions', editingTx.id), txData);
        addToast('Transaction updated', 'success');
      } else {
        await addDoc(collection(db, 'transactions'), { ...txData, partyId: party.id, date: serverTimestamp(), createdAt: serverTimestamp() });
        addToast('Transaction added', 'success');
      }
      setShowTxModal(false);
      setEditingTx(null);
    } catch (error) {
      addToast('Failed to save transaction', 'error');
    }
  };

  const confirmDeleteTx = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'transactions', deleteId));
      addToast('Transaction deleted', 'success');
      setDeleteId(null);
    } catch (error) {
      addToast('Failed to delete transaction', 'error');
    }
  };

  if (printMode) {
    return <PrintView party={party} stats={stats} report={reportData} transactions={transactions} members={members} onClose={() => setPrintMode(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-20">
      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Transaction?</h3>
            <p className="text-gray-600 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-700 hover:bg-gray-200">Cancel</button>
              <button onClick={confirmDeleteTx} className="flex-1 py-3 bg-red-600 rounded-xl font-bold text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <button onClick={onBack} className="flex items-center gap-2 mb-4 hover:opacity-80">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold">Back</span>
          </button>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-black mb-1">{party.name}</h1>
              <p className="text-white/80 font-mono font-bold">CODE: {party.shareCode}</p>
            </div>
            <button onClick={() => setPrintMode(true)} className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20">
              <Printer className="w-4 h-4" />
              <span className="font-bold text-sm">PDF</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/80 text-sm mb-1">Total Spent</p>
              <p className="text-2xl font-black">₹{stats.spent}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/80 text-sm mb-1">Cash in Hand</p>
              <p className="text-2xl font-black">₹{stats.balance}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4">
        {tab === 'home' && (
          <div className="space-y-6">
            {isAdmin ? (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setEditingTx(null); setTxType('in'); setShowTxModal(true); }}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-6 rounded-2xl shadow-md hover:shadow-lg active:scale-95 transition-all"
                >
                  <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                  <span className="font-bold">Add Income</span>
                </button>
                <button
                  onClick={() => { setEditingTx(null); setTxType('out'); setShowTxModal(true); }}
                  className="bg-gradient-to-r from-red-500 to-rose-500 text-white p-6 rounded-2xl shadow-md hover:shadow-lg active:scale-95 transition-all"
                >
                  <TrendingDown className="w-8 h-8 mx-auto mb-2" />
                  <span className="font-bold">Add Expense</span>
                </button>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <p className="text-yellow-800 font-bold">👁️ View Only Mode</p>
                <p className="text-yellow-600 text-sm mt-1">Only admin can add transactions</p>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-black text-gray-800">Transactions</h2>
                <span className="text-sm text-gray-500 font-bold">{transactions.length} total</span>
              </div>
              <div className="space-y-3">
                {transactions.map(t => (
                  <div key={t.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-lg ${t.type === 'in' ? 'bg-green-50' : 'bg-red-50'}`}>
                          {t.type === 'in' ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800">{t.description}</h3>
                          <p className="text-sm text-gray-500">
                            {t.type === 'in' ? `From: ${t.memberName}` : `Paid by: ${t.payerName || 'Fund'}`}
                          </p>
                          {t.category && (
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold border ${CHIP_COLORS[t.category] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {t.category}
                            </span>
                          )}
                          <p className="text-xs text-gray-400 mt-1">{new Date(t.date?.toDate()).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xl font-black ${t.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'in' ? '+' : '-'}₹{t.amount}
                        </span>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setEditingTx(t); setTxType(t.type); setShowTxModal(true); }}
                              className="p-2 bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteId(t.id)} className="p-2 bg-slate-100 rounded-lg text-slate-500 hover:text-rose-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <div className="text-center py-12">
                    <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-400 font-medium">No transactions yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'friends' && (
          <MembersManager user={user} partyId={party.id} members={members} isAdmin={isAdmin} addToast={addToast} />
        )}

        {tab === 'report' && reportData && (
          <EnhancedReport party={party} transactions={transactions} members={members} reportData={reportData} stats={stats} />
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto flex justify-around">
          {['home', 'friends', 'report'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`p-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${tab === t ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              {t === 'home' && <Home className="w-6 h-6" />}
              {t === 'friends' && <Users className="w-6 h-6" />}
              {t === 'report' && <BarChart3 className="w-6 h-6" />}
              <span className="text-xs font-bold capitalize">{t}</span>
            </button>
          ))}
        </div>
      </div>

      {showTxModal && (
        <TransactionModal
          type={txType}
          members={members}
          onClose={() => { setShowTxModal(false); setEditingTx(null); }}
          onSave={handleSaveTx}
          initialData={editingTx}
        />
      )}
    </div>
  );
}

// ============================================================================
// 👥 MEMBERS MANAGER
// ============================================================================
function MembersManager({ user, partyId, members, isAdmin, addToast }) {
  const [newMemberName, setNewMemberName] = useState('');
  const [editingMember, setEditingMember] = useState(null);
  const [editName, setEditName] = useState('');
  const [deleteMemberId, setDeleteMemberId] = useState(null);

  const addMember = async (e) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    try {
      await addDoc(collection(db, 'members'), { partyId, name: newMemberName.trim(), createdAt: serverTimestamp() });
      setNewMemberName('');
      addToast('Friend added!', 'success');
    } catch { addToast('Failed to add friend', 'error'); }
  };

  const saveEdit = async () => {
    if (!editingMember || !editName.trim()) return;
    try {
      await updateDoc(doc(db, 'members', editingMember.id), { name: editName.trim() });
      setEditingMember(null); setEditName('');
      addToast('Friend updated!', 'success');
    } catch { addToast('Failed to update friend', 'error'); }
  };

  const confirmDeleteMember = async () => {
    if (!deleteMemberId) return;
    try {
      await deleteDoc(doc(db, 'members', deleteMemberId));
      setDeleteMemberId(null);
      addToast('Friend removed', 'success');
    } catch { addToast('Failed to remove friend', 'error'); }
  };

  return (
    <div className="space-y-6">
      {editingMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Edit Friend</h3>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 mb-4 focus:border-indigo-500 outline-none" autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setEditingMember(null)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-700">Cancel</button>
              <button onClick={saveEdit} className="flex-1 py-3 bg-indigo-600 rounded-xl font-bold text-white">Save</button>
            </div>
          </div>
        </div>
      )}
      {deleteMemberId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Remove Friend?</h3>
            <p className="text-gray-600 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteMemberId(null)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-700">Cancel</button>
              <button onClick={confirmDeleteMember} className="flex-1 py-3 bg-red-600 rounded-xl font-bold text-white">Remove</button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div>
          <h2 className="text-2xl font-black text-gray-800 mb-4">Add Friend</h2>
          <form onSubmit={addMember} className="flex gap-2">
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Friend's name..."
              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg active:scale-95 transition-all">
              <Plus className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-black text-gray-800 mb-4">Friends</h2>
        <div className="space-y-3">
          {members.map(m => (
            <div key={m.id} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-black">
                  {m.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="font-bold text-gray-800">{m.name}</span>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <button onClick={() => { setEditingMember(m); setEditName(m.name); }} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteMemberId(m.id)} className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">No friends added yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 🖨️ PRINT VIEW
// ============================================================================
function PrintView({ party, stats, report, transactions, members, onClose }) {
  const memberDetails = useMemo(() => {
    return members.map(member => {
      const involvedExpenses = transactions.filter(t => {
        if (t.type !== 'out') return false;
        const involvedIds = (t.involvedMemberIds && t.involvedMemberIds.length) ? t.involvedMemberIds : members.map(m => m.id);
        return involvedIds.includes(member.id);
      });
      const categorySpending = {};
      involvedExpenses.forEach(t => {
        const splitIds = (t.involvedMemberIds && t.involvedMemberIds.length) ? t.involvedMemberIds : members.map(m => m.id);
        const shareAmount = t.amount / splitIds.length;
        const cat = t.category || 'Misc';
        categorySpending[cat] = (categorySpending[cat] || 0) + shareAmount;
      });
      const settlement = report.settlements.find(s => s.id === member.id);
      return { ...member, categorySpending, totalShare: settlement?.share || 0, totalPaid: settlement?.paid || 0, balance: settlement?.net || 0 };
    });
  }, [members, transactions, report]);

  const paymentSuggestions = useMemo(() => {
    const debtors = report.settlements.filter(s => s.net < 0).map(s => ({...s})).sort((a, b) => a.net - b.net);
    const creditors = report.settlements.filter(s => s.net > 0).map(s => ({...s})).sort((a, b) => b.net - a.net);
    const suggestions = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debt = Math.abs(debtors[i].net);
      const credit = creditors[j].net;
      const amount = Math.min(debt, credit);
      suggestions.push({ from: debtors[i].name, to: creditors[j].name, amount: Math.round(amount) });
      debtors[i].net += amount; creditors[j].net -= amount;
      if (Math.abs(debtors[i].net) < 1) i++;
      if (Math.abs(creditors[j].net) < 1) j++;
    }
    return suggestions;
  }, [report]);

  if (!report) return null;

  return (
    <div className="min-h-screen bg-white p-8">
      <style>{`
        @media print {
          @page { size: A4; margin: 1cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { break-before: page; }
          .avoid-break { break-inside: avoid; }
        }
      `}</style>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-end gap-2 mb-6 no-print">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold">Close</button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>

        {/* Header */}
        <div className="mb-8 pb-6 border-b-4 border-indigo-600 avoid-break">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-black text-gray-900 mb-2">{party.name}</h1>
              <p className="text-lg text-gray-600 font-bold">Expense Report</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">Report Date</p>
              <p className="text-lg font-black text-gray-900">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p className="text-sm text-gray-500 mt-2">Share Code: <span className="font-mono font-bold text-gray-900">{party.shareCode}</span></p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-8 avoid-break">
          <h2 className="text-2xl font-black text-gray-900 mb-4">📊 Executive Summary</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Collected', val: `₹${stats.collected}`, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', val2: 'text-blue-900' },
              { label: 'Total Spent',     val: `₹${stats.spent}`,     bg: 'bg-red-50',  border: 'border-red-200',  text: 'text-red-600',  val2: 'text-red-900' },
              { label: 'Balance',         val: `₹${stats.balance}`,   bg: 'bg-green-50',border: 'border-green-200',text: 'text-green-600',val2: 'text-green-900' },
              { label: 'Transactions',    val: transactions.length,   bg: 'bg-purple-50',border:'border-purple-200',text:'text-purple-600',val2:'text-purple-900'},
            ].map(c => (
              <div key={c.label} className={`${c.bg} border-2 ${c.border} rounded-lg p-4`}>
                <p className={`${c.text} text-sm font-bold mb-1`}>{c.label}</p>
                <p className={`text-3xl font-black ${c.val2}`}>{c.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Settlement Plan */}
        {paymentSuggestions.length > 0 && (
          <div className="mb-8 bg-indigo-50 border-2 border-indigo-200 rounded-lg p-6 avoid-break">
            <h2 className="text-2xl font-black text-gray-900 mb-4">💸 Quick Settlement Plan</h2>
            <div className="space-y-2">
              {paymentSuggestions.map((s, i) => (
                <div key={i} className="bg-white border-2 border-indigo-300 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-black text-sm">{i + 1}</div>
                    <p className="font-black text-gray-900 text-lg">{s.from} → {s.to}</p>
                  </div>
                  <p className="text-3xl font-black text-indigo-600">₹{s.amount}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categories */}
        <div className="mb-8 avoid-break">
          <h2 className="text-2xl font-black text-gray-900 mb-4">🏷️ Spending by Category</h2>
          <table className="w-full border-2 border-gray-200">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="text-left py-3 px-4 font-black text-gray-900">Category</th>
                <th className="text-right py-3 px-4 font-black text-gray-900">Amount</th>
                <th className="text-right py-3 px-4 font-black text-gray-900">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.categories).sort(([,a],[,b]) => b-a).map(([category, amount], i) => (
                <tr key={category} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                  <td className="py-3 px-4 font-bold text-gray-900">{category}</td>
                  <td className="py-3 px-4 text-right font-black text-gray-900">₹{amount.toFixed(0)}</td>
                  <td className="py-3 px-4 text-right font-bold text-gray-600">{((amount / parseFloat(stats.spent)) * 100).toFixed(1)}%</td>
                </tr>
              ))}
              <tr className="bg-indigo-100 border-t-2 border-indigo-300">
                <td className="py-3 px-4 font-black text-indigo-900">TOTAL</td>
                <td className="py-3 px-4 text-right font-black text-indigo-900">₹{stats.spent}</td>
                <td className="py-3 px-4 text-right font-black text-indigo-900">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="page-break"></div>

        {/* Member Breakdowns */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-gray-900 mb-4">👥 Individual Member Breakdowns</h2>
          <div className="space-y-6">
            {memberDetails.map(member => (
              <div key={member.id} className={`border-2 rounded-lg overflow-hidden avoid-break ${member.balance >= 0 ? 'border-green-300' : 'border-red-300'}`}>
                <div className={`p-4 ${member.balance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg ${member.balance >= 0 ? 'bg-green-600' : 'bg-red-600'}`}>
                        {member.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-gray-900">{member.name}</h3>
                        <p className="text-sm text-gray-600 font-medium">{member.balance >= 0 ? 'Gets money back' : 'Needs to pay'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 font-bold mb-1">Net Balance</p>
                      <p className={`text-3xl font-black ${member.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {member.balance >= 0 ? '+' : ''}₹{Math.round(member.balance)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-white">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <p className="text-blue-600 text-sm font-bold mb-1">Total Paid</p>
                      <p className="text-2xl font-black text-blue-900">₹{Math.round(member.totalPaid)}</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded p-3">
                      <p className="text-purple-600 text-sm font-bold mb-1">Fair Share</p>
                      <p className="text-2xl font-black text-purple-900">₹{Math.round(member.totalShare)}</p>
                    </div>
                  </div>
                  {Object.keys(member.categorySpending).length > 0 && (
                    <div>
                      <h4 className="font-black text-gray-900 mb-2">Category-wise Spending:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(member.categorySpending).sort(([,a],[,b]) => b-a).map(([cat, amount]) => (
                          <div key={cat} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="font-bold text-gray-700 text-sm">{cat}</span>
                            <span className="font-black text-gray-900">₹{Math.round(amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="page-break"></div>

        {/* Transaction History */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-gray-900 mb-4">📝 Complete Transaction History</h2>
          <table className="w-full border-2 border-gray-200">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="text-left py-3 px-4 font-black text-gray-900">Date</th>
                <th className="text-left py-3 px-4 font-black text-gray-900">Description</th>
                <th className="text-left py-3 px-4 font-black text-gray-900">Category</th>
                <th className="text-left py-3 px-4 font-black text-gray-900">Type</th>
                <th className="text-right py-3 px-4 font-black text-gray-900">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <tr key={t.id} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                  <td className="py-2 px-4 text-sm text-gray-700">{new Date(t.date?.toDate()).toLocaleDateString()}</td>
                  <td className="py-2 px-4 font-bold text-gray-900">{t.description}</td>
                  <td className="py-2 px-4 text-sm text-gray-700">{t.category}</td>
                  <td className="py-2 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {t.type === 'in' ? 'Income' : 'Expense'}
                    </span>
                  </td>
                  <td className={`py-2 px-4 text-right font-black ${t.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'in' ? '+' : '-'}₹{t.amount}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td colSpan="4" className="py-3 px-4 font-black text-gray-900">TOTAL EXPENSES</td>
                <td className="py-3 px-4 text-right font-black text-gray-900">
                  ₹{transactions.filter(t => t.type === 'out').reduce((s, t) => s + Number(t.amount), 0).toFixed(0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Final Settlement */}
        <div className="mb-8 avoid-break">
          <h2 className="text-2xl font-black text-gray-900 mb-4">💰 Final Settlement Summary</h2>
          <table className="w-full border-2 border-gray-200">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="text-left py-3 px-4 font-black text-gray-900">Member</th>
                <th className="text-right py-3 px-4 font-black text-gray-900">Total Paid</th>
                <th className="text-right py-3 px-4 font-black text-gray-900">Fair Share</th>
                <th className="text-right py-3 px-4 font-black text-gray-900">Net Balance</th>
              </tr>
            </thead>
            <tbody>
              {report.settlements.sort((a, b) => b.net - a.net).map((s, i) => (
                <tr key={s.id} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                  <td className="py-3 px-4 font-bold text-gray-900">{s.name}</td>
                  <td className="py-3 px-4 text-right font-black text-gray-900">₹{Math.round(s.paid)}</td>
                  <td className="py-3 px-4 text-right font-black text-gray-900">₹{Math.round(s.share)}</td>
                  <td className={`py-3 px-4 text-right font-black ${s.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {s.net >= 0 ? '+' : ''}₹{Math.round(s.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded">
            <p className="text-sm text-gray-700">
              <strong>Legend:</strong>
              <span className="text-green-600 font-bold ml-2">+ Positive</span> = Gets money back •
              <span className="text-red-600 font-bold ml-2">- Negative</span> = Needs to pay
            </p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t-2 border-gray-300 text-center avoid-break">
          <p className="text-sm text-gray-600 mb-2">Generated by <strong className="text-indigo-600">PartyFund</strong></p>
          <p className="text-xs text-gray-500">All calculations are based on recorded transactions.</p>
          <p className="text-xs text-gray-500 mt-2">Party ID: {party.id} • Generated on {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 👁️ PUBLIC REPORT VIEW
// ============================================================================
function PublicReportView({ shareCode, onBack }) {
  const [party, setParty] = useState(null);
  const [members, setMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    const fetchPartyData = async () => {
      try {
        setLoading(true); setError(null);
        const q = query(collection(db, 'parties'), where('shareCode', '==', shareCode.toUpperCase()));
        const partySnapshot = await getDocs(q);
        if (partySnapshot.empty) { setError('Party not found. Please check the share code.'); setLoading(false); return; }
        const partyData = { id: partySnapshot.docs[0].id, ...partySnapshot.docs[0].data() };
        setParty(partyData);

        const membersSnapshot = await getDocs(query(collection(db, 'members'), where('partyId', '==', partyData.id)));
        const membersData = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMembers(membersData.sort((a, b) => (a.createdAt?.toDate?.() || new Date(0)) - (b.createdAt?.toDate?.() || new Date(0))));

        const txSnapshot = await getDocs(query(collection(db, 'transactions'), where('partyId', '==', partyData.id)));
        const txData = txSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTransactions(txData.sort((a, b) => {
          const dA = a.date?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
          const dB = b.date?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
          return dB - dA;
        }));
        setLoading(false);
      } catch (err) {
        setError('Failed to load party data. Please try again.');
        setLoading(false);
      }
    };
    fetchPartyData();
  }, [shareCode]);

  const stats = useMemo(() => {
    const spent = transactions.filter(t => t.type === 'out').reduce((s, t) => s + Number(t.amount), 0);
    const collected = transactions.filter(t => t.type === 'in').reduce((s, t) => s + Number(t.amount), 0);
    const adminPaid = transactions.filter(t => t.type === 'out' && (!t.payerId || t.payerId === 'admin')).reduce((s, t) => s + Number(t.amount), 0);
    return { spent: spent.toFixed(2), collected: collected.toFixed(2), balance: (collected - adminPaid).toFixed(2) };
  }, [transactions]);

  const reportData = useMemo(() => {
    if (!members.length) return null;
    const balances = {};
    members.forEach(m => balances[m.id] = { paid: 0, share: 0, name: m.name });
    const categories = {};
    transactions.forEach(t => {
      if (t.type === 'out') {
        const amt = Number(t.amount);
        categories[t.category || 'Misc'] = (categories[t.category || 'Misc'] || 0) + amt;
        if (t.payerId && t.payerId !== 'admin' && balances[t.payerId]) balances[t.payerId].paid += amt;
        const splitIds = (t.involvedMemberIds && t.involvedMemberIds.length) ? t.involvedMemberIds : members.map(m => m.id);
        splitIds.forEach(id => { if (balances[id]) balances[id].share += amt / splitIds.length; });
      } else if (t.type === 'in') {
        if (t.memberId && balances[t.memberId]) balances[t.memberId].paid += Number(t.amount);
      }
    });
    return { settlements: Object.entries(balances).map(([id, d]) => ({ id, ...d, net: d.paid - d.share })), categories };
  }, [members, transactions]);

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XIcon className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={onBack} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg active:scale-95 transition-all">Try Again</button>
        </div>
      </div>
    );
  }

  if (printMode) {
    return <PrintView party={party} stats={stats} report={reportData} transactions={transactions} members={members} onClose={() => setPrintMode(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-20">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <button onClick={onBack} className="flex items-center gap-2 mb-4 hover:opacity-80">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold">Back</span>
          </button>
          <div className="bg-yellow-500/20 backdrop-blur-sm border border-yellow-300/30 rounded-xl p-3 mb-4 flex items-center gap-3">
            <Eye className="w-5 h-5" />
            <div className="flex-1">
              <p className="font-bold text-sm">View-Only Mode</p>
              <p className="text-xs text-white/80">Public report — no login required</p>
            </div>
          </div>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-black mb-1">{party.name}</h1>
              <p className="text-white/80 font-mono font-bold">CODE: {party.shareCode}</p>
            </div>
            <button onClick={() => setPrintMode(true)} className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20">
              <Printer className="w-4 h-4" />
              <span className="font-bold text-sm">PDF</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/80 text-sm mb-1">Total Spent</p>
              <p className="text-2xl font-black">₹{stats.spent}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/80 text-sm mb-1">Cash in Hand</p>
              <p className="text-2xl font-black">₹{stats.balance}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Transactions */}
        <div>
          <h2 className="text-2xl font-black text-gray-800 mb-4">Transactions</h2>
          <div className="space-y-3">
            {transactions.map(t => (
              <div key={t.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${t.type === 'in' ? 'bg-green-50' : 'bg-red-50'}`}>
                      {t.type === 'in' ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800">{t.description}</h3>
                      <p className="text-sm text-gray-500">{t.type === 'in' ? `From: ${t.memberName}` : `Paid by: ${t.payerName || 'Fund'}`}</p>
                      {t.category && (
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold border ${CHIP_COLORS[t.category] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {t.category}
                        </span>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{new Date(t.date?.toDate()).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-xl font-black ${t.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'in' ? '+' : '-'}₹{t.amount}
                  </span>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="text-center py-12">
                <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">No transactions yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Categories */}
        {reportData && Object.keys(reportData.categories).length > 0 && (
          <div>
            <h2 className="text-2xl font-black text-gray-800 mb-4">Categories</h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(reportData.categories).map(([cat, val], i) => (
                <div key={cat} className="bg-white p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-bold text-gray-600">{cat}</span>
                  </div>
                  <p className="text-2xl font-black text-gray-800">₹{val.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settlement */}
        {reportData && (
          <div>
            <h2 className="text-2xl font-black text-gray-800 mb-4">Settlement</h2>
            <div className="space-y-3">
              {reportData.settlements.map(s => (
                <div key={s.id} className={`bg-white p-4 rounded-xl border-2 ${s.net >= 0 ? 'border-emerald-500' : 'border-rose-500'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-800">{s.name}</span>
                    <span className={`text-xl font-black ${s.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {s.net >= 0 ? '+' : ''}₹{Math.round(s.net)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Paid: ₹{Math.round(s.paid)}</span>
                    <span>Share: ₹{Math.round(s.share)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div>
          <h2 className="text-2xl font-black text-gray-800 mb-4">Trip Members</h2>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
            {members.map(m => (
              <div key={m.id} className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-black">
                  {m.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="font-bold text-gray-800">{m.name}</span>
              </div>
            ))}
            {members.length === 0 && <div className="p-8 text-center text-gray-400">No members added yet</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 🚀 MAIN APP
// ============================================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [selectedParty, setSelectedParty] = useState(null);
  const [publicShareCode, setPublicShareCode] = useState(null);
  const { toasts, addToast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('list');
      setSelectedParty(null);
      addToast('Logged out successfully', 'success');
    } catch {
      addToast('Failed to logout', 'error');
    }
  };

  if (loading) return <LoadingSpinner />;

  if (publicShareCode) {
    return (
      <>
        <Toast toasts={toasts} />
        <PublicReportView shareCode={publicShareCode} onBack={() => setPublicShareCode(null)} />
      </>
    );
  }

  if (!user) return <LoginScreen onViewReport={(code) => setPublicShareCode(code)} />;

  return (
    <div className="min-h-screen">
      <Toast toasts={toasts} />

      {view !== 'detail' && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-black">PartyFund</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">{user.email}</span>
              <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'list' && (
        <PartyList
          user={user}
          onCreate={() => setView('create')}
          onSelect={(p) => { setSelectedParty(p); setView('detail'); }}
        />
      )}
      {view === 'create' && (
        <CreatePartyForm user={user} onCancel={() => setView('list')} onSuccess={() => setView('list')} addToast={addToast} />
      )}
      {view === 'detail' && selectedParty && (
        <PartyDashboard
          user={user}
          party={selectedParty}
          onBack={() => { setSelectedParty(null); setView('list'); }}
          addToast={addToast}
        />
      )}
    </div>
  );
}
