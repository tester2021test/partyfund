import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Plus, Users, Receipt, ArrowLeft, TrendingUp, TrendingDown, Trash2, Home, BarChart3, Pencil, Printer, LogOut, Loader2, X as XIcon, Check, Tag, Calendar, Search, Download, Upload, Bell, Settings, DollarSign } from 'lucide-react';

// ============================================================================
// 🔥 FIREBASE CONFIGURATION
// ============================================================================
// TODO: Replace with your Firebase config from Firebase Console
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

// ============================================================================
// 🪝 CUSTOM HOOKS
// ============================================================================

// Real-time data hook with proper cleanup
const useFirestoreCollection = (collectionName, constraints = []) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      let q = collection(db, collectionName);
      
      if (constraints.length > 0) {
        q = query(q, ...constraints);
      }

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
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

// Toast notification hook
const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
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
          className={`px-4 py-3 rounded-lg shadow-lg text-white font-medium animate-slide-in ${
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
// 🔐 AUTHENTICATION
// ============================================================================

function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
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
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all hover:shadow-lg active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
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

        <p className="mt-6 text-center text-xs text-gray-400">
          Only admins can create parties. Members join via share code.
        </p>
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
    // orderBy('createdAt', 'desc') - Temporarily removed to avoid index requirement
  ]);

  const filteredParties = useMemo(() => {
    // Filter and sort in memory
    return parties
      .filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.shareCode.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA; // Newest first
      });
  }, [parties, searchTerm]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBoundary error={error} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-gray-800 mb-2">My Events</h1>
          <p className="text-gray-500">Manage expenses with friends</p>
        </div>

        {/* Search Bar */}
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

        {/* Create Button */}
        <button
          onClick={onCreate}
          className="w-full mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 hover:shadow-lg active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          New Event
        </button>

        {/* Parties Grid */}
        {filteredParties.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">
              {searchTerm ? 'No parties found' : 'No events yet. Create one!'}
            </p>
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
                    <h3 className="text-xl font-black text-gray-800 mb-1 group-hover:text-indigo-600 transition-colors">
                      {party.name}
                    </h3>
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
    if (!name.trim()) {
      addToast('Please enter a party name', 'error');
      return;
    }

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
      console.error('Error creating party:', error);
      addToast('Failed to create party', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-md mx-auto pt-8">
        <button
          onClick={onCancel}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold">Back</span>
        </button>

        <div className="bg-white p-8 rounded-3xl shadow-lg">
          <h2 className="text-3xl font-black text-gray-800 mb-6">Create New Event</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Event Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={50}
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xl text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="e.g. Goa Trip 2024"
              />
              <p className="mt-2 text-xs text-gray-400">
                {name.length}/50 characters
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 px-6 rounded-xl hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  'Create Event'
                )}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 🎯 MAIN PARTY DASHBOARD
// ============================================================================

function PartyDashboard({ user, party, onBack, addToast }) {
  const [tab, setTab] = useState('home');
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('out');
  const [editingTx, setEditingTx] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [printMode, setPrintMode] = useState(false);

  // Fetch data
  const { data: membersRaw } = useFirestoreCollection('members', [
    where('partyId', '==', party.id)
    // orderBy removed - sorting in memory to avoid index requirement
  ]);

  const { data: transactionsRaw } = useFirestoreCollection('transactions', [
    where('partyId', '==', party.id)
    // orderBy removed - sorting in memory to avoid index requirement
  ]);

  // Sort in memory
  const members = useMemo(() => {
    return [...membersRaw].sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateA - dateB; // Oldest first
    });
  }, [membersRaw]);

  const transactions = useMemo(() => {
    return [...transactionsRaw].sort((a, b) => {
      const dateA = a.date?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.date?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA; // Newest first
    });
  }, [transactionsRaw]);

  const isAdmin = party.adminId === user.uid;

  // Calculate stats
  const stats = useMemo(() => {
    const spent = transactions
      .filter(t => t.type === 'out')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const collected = transactions
      .filter(t => t.type === 'in')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const adminPaid = transactions
      .filter(t => t.type === 'out' && (!t.payerId || t.payerId === 'admin'))
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      spent: spent.toFixed(2),
      collected: collected.toFixed(2),
      balance: (collected - adminPaid).toFixed(2)
    };
  }, [transactions]);

  // Settlement calculations
  const reportData = useMemo(() => {
    if (!members.length) return null;

    const balances = {};
    members.forEach(m => balances[m.id] = { paid: 0, share: 0, name: m.name });

    const categories = {};

    transactions.forEach(t => {
      if (t.type === 'out') {
        const amt = Number(t.amount);
        categories[t.category || 'Misc'] = (categories[t.category || 'Misc'] || 0) + amt;

        if (t.payerId && t.payerId !== 'admin' && balances[t.payerId]) {
          balances[t.payerId].paid += amt;
        }

        const splitIds = (t.involvedMemberIds && t.involvedMemberIds.length)
          ? t.involvedMemberIds
          : members.map(m => m.id);
        
        const splitAmt = amt / splitIds.length;
        splitIds.forEach(id => {
          if (balances[id]) balances[id].share += splitAmt;
        });
      } else if (t.type === 'in') {
        if (t.memberId && balances[t.memberId]) {
          balances[t.memberId].paid += Number(t.amount);
        }
      }
    });

    return {
      settlements: Object.entries(balances).map(([id, d]) => ({
        id,
        ...d,
        net: d.paid - d.share
      })),
      categories
    };
  }, [members, transactions]);

  // Transaction handlers
  const handleSaveTx = async (txData) => {
    try {
      if (editingTx) {
        await updateDoc(doc(db, 'transactions', editingTx.id), txData);
        addToast('Transaction updated', 'success');
      } else {
        await addDoc(collection(db, 'transactions'), {
          ...txData,
          partyId: party.id,
          date: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        addToast('Transaction added', 'success');
      }
      setShowTxModal(false);
      setEditingTx(null);
    } catch (error) {
      console.error('Error saving transaction:', error);
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
      console.error('Error deleting transaction:', error);
      addToast('Failed to delete transaction', 'error');
    }
  };

  if (printMode) {
    return (
      <PrintView
        party={party}
        stats={stats}
        report={reportData}
        transactions={transactions}
        members={members}
        onClose={() => setPrintMode(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-20">
      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Transaction?</h3>
            <p className="text-gray-600 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteTx}
                className="flex-1 py-3 bg-red-600 rounded-xl font-bold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 mb-4 hover:opacity-80"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold">Back</span>
          </button>

          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-black mb-1">{party.name}</h1>
              <p className="text-white/80 font-mono font-bold">CODE: {party.shareCode}</p>
            </div>
            <button
              onClick={() => setPrintMode(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20"
            >
              <Printer className="w-4 h-4" />
              <span className="font-bold text-sm">PDF</span>
            </button>
          </div>

          {/* Stats Cards */}
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

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4">
        {tab === 'home' && (
          <div className="space-y-6">
            {/* Action Buttons (Admin Only) */}
            {isAdmin ? (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setEditingTx(null);
                    setTxType('in');
                    setShowTxModal(true);
                  }}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-6 rounded-2xl shadow-md hover:shadow-lg active:scale-95 transition-all"
                >
                  <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                  <span className="font-bold">Add Income</span>
                </button>
                <button
                  onClick={() => {
                    setEditingTx(null);
                    setTxType('out');
                    setShowTxModal(true);
                  }}
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

            {/* Transactions List */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-black text-gray-800">Transactions</h2>
                <span className="text-sm text-gray-500 font-bold">{transactions.length} total</span>
              </div>

              <div className="space-y-3">
                {transactions.map(t => (
                  <div
                    key={t.id}
                    className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-lg ${t.type === 'in' ? 'bg-green-50' : 'bg-red-50'}`}>
                          {t.type === 'in' ? (
                            <TrendingUp className="w-5 h-5 text-green-600" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800">{t.description}</h3>
                          <p className="text-sm text-gray-500">
                            {t.type === 'in' ? `From: ${t.memberName}` : `Paid by: ${t.payerName || 'Fund'}`}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(t.date?.toDate()).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-xl font-black ${t.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'in' ? '+' : '-'}₹{t.amount}
                        </span>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditingTx(t);
                                setTxType(t.type);
                                setShowTxModal(true);
                              }}
                              className="p-2 bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteId(t.id)}
                              className="p-2 bg-slate-100 rounded-lg text-slate-500 hover:text-rose-600"
                            >
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
          <MembersManager
            user={user}
            partyId={party.id}
            members={members}
            isAdmin={isAdmin}
            addToast={addToast}
          />
        )}

        {tab === 'report' && reportData && (
          <div className="space-y-6">
            {/* Categories */}
            <div>
              <h2 className="text-2xl font-black text-gray-800 mb-4">Categories</h2>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(reportData.categories).map(([cat, val], i) => (
                  <div key={cat} className="bg-white p-4 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-sm font-bold text-gray-600">{cat}</span>
                    </div>
                    <p className="text-2xl font-black text-gray-800">₹{val.toFixed(0)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Settlement */}
            <div>
              <h2 className="text-2xl font-black text-gray-800 mb-4">Settlement</h2>
              <div className="space-y-3">
                {reportData.settlements.map(s => (
                  <div
                    key={s.id}
                    className={`bg-white p-4 rounded-xl border-2 ${
                      s.net >= 0 ? 'border-emerald-500' : 'border-rose-500'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-gray-800">{s.name}</span>
                      <span className={`text-xl font-black ${s.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {s.net >= 0 ? '+' : ''}{Math.round(s.net)}
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
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto flex justify-around">
          {['home', 'friends', 'report'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`p-4 rounded-2xl flex flex-col items-center gap-1 transition-all ${
                tab === t ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              {t === 'home' && <Home className="w-6 h-6" />}
              {t === 'friends' && <Users className="w-6 h-6" />}
              {t === 'report' && <BarChart3 className="w-6 h-6" />}
              <span className="text-xs font-bold capitalize">{t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Transaction Modal */}
      {showTxModal && (
        <TransactionModal
          type={txType}
          members={members}
          onClose={() => {
            setShowTxModal(false);
            setEditingTx(null);
          }}
          onSave={handleSaveTx}
          initialData={editingTx}
        />
      )}
    </div>
  );
}

// ============================================================================
// 💰 TRANSACTION MODAL (Simplified version for brevity)
// ============================================================================

function TransactionModal({ type, members, onClose, onSave, initialData }) {
  const [amt, setAmt] = useState(initialData?.amount || '');
  const [cat, setCat] = useState(initialData?.category || (type === 'in' ? 'Cash' : 'Food'));
  const [who, setWho] = useState(initialData?.memberId || '');
  const [splitMode, setSplitMode] = useState('all');
  const [selectedSplitIds, setSelectedSplitIds] = useState(new Set(members.map(m => m.id)));

  const handleSave = () => {
    if (!amt) return alert('Please enter amount');
    
    const payload = {
      type,
      amount: parseFloat(amt),
      category: cat,
      description: cat
    };

    if (type === 'in') {
      if (!who) return alert('Select who gave money');
      const mem = members.find(m => m.id === who);
      payload.memberId = who;
      payload.memberName = mem.name;
    } else {
      payload.payerId = 'admin';
      payload.payerName = 'Fund';
      payload.involvedMemberIds = splitMode === 'all'
        ? members.map(m => m.id)
        : Array.from(selectedSplitIds);
    }

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4 md:items-center">
      <div className="bg-white rounded-t-3xl md:rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-black text-gray-800 mb-6">
          {type === 'in' ? 'Add Income' : 'Add Expense'}
        </h2>

        {/* Amount */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">Amount</label>
          <input
            type="number"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            className="w-full text-3xl font-black text-slate-800 border-b-2 border-slate-100 focus:border-slate-800 outline-none py-2"
            placeholder="0"
          />
        </div>

        {/* Category */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
          <div className="flex gap-2 flex-wrap">
            {(type === 'in' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  cat === c
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Income Source */}
        {type === 'in' && (
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">From Whom?</label>
            <select
              value={who}
              onChange={(e) => setWho(e.target.value)}
              className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-700 outline-none"
            >
              <option value="">Select Friend...</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Split Logic for Expenses */}
        {type === 'out' && (
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Split With</label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setSplitMode('all')}
                className={`px-4 py-2 rounded-xl text-sm font-bold ${
                  splitMode === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Everyone
              </button>
              <button
                onClick={() => setSplitMode('select')}
                className={`px-4 py-2 rounded-xl text-sm font-bold ${
                  splitMode === 'select' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Select
              </button>
            </div>
            
            {splitMode === 'select' && (
              <div className="grid grid-cols-2 gap-2">
                {members.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      const next = new Set(selectedSplitIds);
                      if (next.has(m.id)) next.delete(m.id);
                      else next.add(m.id);
                      setSelectedSplitIds(next);
                    }}
                    className={`p-3 rounded-xl border text-sm font-bold ${
                      selectedSplitIds.has(m.id)
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-400'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg"
          >
            Save
          </button>
        </div>
      </div>
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
      await addDoc(collection(db, 'members'), {
        partyId,
        name: newMemberName.trim(),
        createdAt: serverTimestamp()
      });
      setNewMemberName('');
      addToast('Friend added!', 'success');
    } catch (error) {
      console.error('Error adding member:', error);
      addToast('Failed to add friend', 'error');
    }
  };

  const saveEdit = async () => {
    if (!editingMember || !editName.trim()) return;

    try {
      await updateDoc(doc(db, 'members', editingMember.id), {
        name: editName.trim()
      });
      setEditingMember(null);
      setEditName('');
      addToast('Friend updated!', 'success');
    } catch (error) {
      console.error('Error updating member:', error);
      addToast('Failed to update friend', 'error');
    }
  };

  const confirmDeleteMember = async () => {
    if (!deleteMemberId) return;

    try {
      await deleteDoc(doc(db, 'members', deleteMemberId));
      setDeleteMemberId(null);
      addToast('Friend removed', 'success');
    } catch (error) {
      console.error('Error deleting member:', error);
      addToast('Failed to remove friend', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Edit Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Edit Friend</h3>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 mb-4 focus:border-indigo-500 outline-none"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setEditingMember(null)}
                className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 py-3 bg-indigo-600 rounded-xl font-bold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteMemberId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Remove Friend?</h3>
            <p className="text-gray-600 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteMemberId(null)}
                className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteMember}
                className="flex-1 py-3 bg-red-600 rounded-xl font-bold text-white"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Friend Form (Admin Only) */}
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
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}

      {/* Members List */}
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
                  <button
                    onClick={() => {
                      setEditingMember(m);
                      setEditName(m.name);
                    }}
                    className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteMemberId(m.id)}
                    className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
// 🖨️ PRINT VIEW (Simplified)
// ============================================================================

function PrintView({ party, stats, report, transactions, members, onClose }) {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Controls */}
        <div className="flex justify-end gap-2 mb-6 print:hidden">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg font-bold">
            Close
          </button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">
            Print
          </button>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-gray-800 mb-2">{party.name}</h1>
          <p className="text-gray-500">Party Expense Report • {new Date().toLocaleDateString()}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="border-2 border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Total Collected</p>
            <p className="text-2xl font-black text-gray-800">₹{stats.collected}</p>
          </div>
          <div className="border-2 border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Total Spent</p>
            <p className="text-2xl font-black text-gray-800">₹{stats.spent}</p>
          </div>
          <div className="border-2 border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Balance</p>
            <p className="text-2xl font-black text-gray-800">₹{stats.balance}</p>
          </div>
        </div>

        {/* Transactions */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-gray-800 mb-4">Transaction History</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 font-bold text-gray-600">Date</th>
                <th className="text-left py-2 font-bold text-gray-600">Description</th>
                <th className="text-left py-2 font-bold text-gray-600">Category</th>
                <th className="text-right py-2 font-bold text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="border-b border-gray-100">
                  <td className="py-2 text-sm">{new Date(t.date?.toDate()).toLocaleDateString()}</td>
                  <td className="py-2 text-sm">{t.description}</td>
                  <td className="py-2 text-sm">{t.category}</td>
                  <td className="py-2 text-sm text-right font-bold">
                    {t.type === 'in' ? '+' : '-'}₹{t.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Settlement */}
        {report && (
          <div>
            <h2 className="text-2xl font-black text-gray-800 mb-4">Final Settlement</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 font-bold text-gray-600">Friend</th>
                  <th className="text-right py-2 font-bold text-gray-600">Paid</th>
                  <th className="text-right py-2 font-bold text-gray-600">Share</th>
                  <th className="text-right py-2 font-bold text-gray-600">Balance</th>
                </tr>
              </thead>
              <tbody>
                {report.settlements.map(s => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2 text-right">₹{Math.round(s.paid)}</td>
                    <td className="py-2 text-right">₹{Math.round(s.share)}</td>
                    <td className={`py-2 text-right font-bold ${s.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {s.net >= 0 ? '+' : ''}₹{Math.round(s.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
  const { toasts, addToast } = useToast();

  // Auto-inject Tailwind CDN
  useEffect(() => {
    const existingScript = document.getElementById('tailwind-cdn');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
  }, []);

  // Auth state listener
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
    } catch (error) {
      console.error('Logout error:', error);
      addToast('Failed to logout', 'error');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!user) return <LoginScreen />;

  return (
    <div className="min-h-screen">
      <Toast toasts={toasts} />

      {/* Top Bar */}
      {view !== 'detail' && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-black">PartyFund</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">{user.email}</span>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {view === 'list' && (
        <PartyList
          user={user}
          onCreate={() => setView('create')}
          onSelect={(p) => {
            setSelectedParty(p);
            setView('detail');
          }}
        />
      )}

      {view === 'create' && (
        <CreatePartyForm
          user={user}
          onCancel={() => setView('list')}
          onSuccess={() => setView('list')}
          addToast={addToast}
        />
      )}

      {view === 'detail' && selectedParty && (
        <PartyDashboard
          user={user}
          party={selectedParty}
          onBack={() => {
            setSelectedParty(null);
            setView('list');
          }}
          addToast={addToast}
        />
      )}
    </div>
  );
}
