import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminUpdateCoins, fetchAdminBootstrap, searchAdminUsers } from '../lib/api';

const ADMIN_DISCORD_ID = '690562240759464027';

export default function AdminPanel({ isOpen, onClose }) {
  const { token, user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!isOpen || !token || user?.id !== ADMIN_DISCORD_ID) return;
    fetchAdminBootstrap(token)
      .then((data) => setLogs(data.logs || []))
      .catch((error) => setToast({ msg: error.message, type: 'error' }));
  }, [isOpen, token, user?.id]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const doSearch = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const data = await searchAdminUsers(token, query);
      setResults(data.users || []);
    } catch (error) {
      setToast({ msg: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const applyCoins = async (mode) => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const data = await adminUpdateCoins(token, {
        targetUserId: selectedUser.id,
        mode,
        amount: Number(amount),
      });
      setSelectedUser(data.user);
      setLogs(data.logs || []);
      setResults((prev) => prev.map((entry) => (entry.id === data.user.id ? data.user : entry)));
      setToast({ msg: 'Operation admin appliquee', type: 'success' });
    } catch (error) {
      setToast({ msg: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || user?.id !== ADMIN_DISCORD_ID) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <aside className="fixed top-0 right-0 w-[900px] max-w-full h-full bg-dark-900/95 backdrop-blur-xl border-l border-red-500/20 z-50 flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-black bg-gradient-to-r from-red-400 to-orange-500 bg-clip-text text-transparent">Admin Panel</h2>
            <p className="text-sm text-gray-500">Reserve au compte Discord {ADMIN_DISCORD_ID}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-[1.15fr_0.85fr] flex-1 min-h-0">
          <div className="p-6 border-r border-white/10 overflow-y-auto">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-gray-500 font-black">Recherche joueur</div>
              <div className="flex gap-3 mt-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ID Discord ou pseudo"
                  className="flex-1 rounded-2xl bg-dark-950/80 border border-white/10 px-4 py-3 text-sm text-white outline-none"
                />
                <button onClick={doSearch} disabled={loading} className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                  Chercher
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {results.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedUser(entry)}
                  className={`w-full rounded-2xl border p-4 text-left ${selectedUser?.id === entry.id ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 bg-white/[0.03]'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-black text-white truncate">{entry.username}</div>
                      <div className="text-xs text-gray-500 truncate">{entry.id}</div>
                    </div>
                    <div className="text-yellow-400 font-black">{entry.coins} CC</div>
                  </div>
                </button>
              ))}
              {!loading && results.length === 0 && <div className="text-sm text-gray-600">Aucun resultat.</div>}
            </div>

            {selectedUser && (
              <div className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/5 p-5">
                <div className="text-xs uppercase tracking-[0.3em] text-red-300/70 font-black">Action cible</div>
                <div className="text-xl font-black text-white mt-2">{selectedUser.username}</div>
                <div className="text-sm text-gray-500">{selectedUser.id}</div>
                <div className="text-sm text-yellow-400 font-bold mt-2">{selectedUser.coins} CC</div>

                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Montant"
                  className="w-full mt-4 rounded-2xl bg-dark-950/80 border border-white/10 px-4 py-3 text-sm text-white outline-none"
                />

                <div className="grid grid-cols-3 gap-3 mt-4">
                  <button onClick={() => applyCoins('add')} disabled={loading} className="rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">Ajouter</button>
                  <button onClick={() => applyCoins('remove')} disabled={loading} className="rounded-2xl bg-amber-500 py-3 text-sm font-bold text-dark-900 disabled:opacity-50">Retirer</button>
                  <button onClick={() => applyCoins('set')} disabled={loading} className="rounded-2xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-50">Definir</button>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 overflow-y-auto">
            <div className="text-xs uppercase tracking-[0.3em] text-gray-500 font-black">Audit Log</div>
            <div className="space-y-3 mt-4">
              {logs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-black text-white">{log.action}</div>
                    <div className="text-[11px] text-gray-500">{log.created_at}</div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">Cible: {log.target_user_id || 'n/a'}</div>
                  <div className="text-[11px] text-gray-500 mt-2 break-all">{log.details}</div>
                </div>
              ))}
              {logs.length === 0 && <div className="text-sm text-gray-600">Aucune action admin.</div>}
            </div>
          </div>
        </div>
      </aside>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-xl font-semibold text-sm backdrop-blur-xl border ${toast.type === 'success' ? 'border-emerald-500/50 text-emerald-400 bg-dark-900/90' : 'border-red-500/50 text-red-400 bg-dark-900/90'}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
