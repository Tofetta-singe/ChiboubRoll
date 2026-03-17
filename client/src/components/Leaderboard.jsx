import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Leaderboard({ isOpen, onClose }) {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchLeaderboard()
      .then(data => setPlayers(data.leaderboard || []))
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-dark-900/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-pop">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent">
              🏆 Leaderboard — Top 10
            </h2>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full glass flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-5 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="text-center text-gray-500 py-10">
                <div className="text-4xl animate-bounce mb-3">🏆</div>
                Chargement...
              </div>
            ) : players.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                Aucun joueur pour le moment.
              </div>
            ) : (
              <div className="space-y-2">
                {players.map((p, i) => {
                  const isMe = user && p.id === user.id;
                  const isTop3 = i < 3;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                        isMe
                          ? 'bg-purple-500/15 border border-purple-500/30'
                          : isTop3
                            ? 'bg-yellow-500/5 border border-yellow-500/10'
                            : 'bg-white/[0.02] border border-white/5'
                      }`}
                    >
                      {/* Rank */}
                      <div className={`w-8 text-center font-black ${isTop3 ? 'text-xl' : 'text-sm text-gray-500'}`}>
                        {isTop3 ? medals[i] : `#${i + 1}`}
                      </div>

                      {/* Avatar */}
                      <img
                        src={p.avatar}
                        alt={p.username}
                        className={`w-10 h-10 rounded-full ${isTop3 ? 'ring-2 ring-yellow-400/50' : ''}`}
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold text-sm truncate ${isMe ? 'text-purple-300' : ''}`}>
                          {p.username} {isMe && '(toi)'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatNumber(p.total_spins)} spins
                        </div>
                      </div>

                      {/* Coins */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 font-bold text-yellow-400 text-sm">
                          <span>🪙</span>
                          <span>{formatNumber(p.total_earned)}</span>
                        </div>
                        <div className="text-[0.6rem] text-gray-600">total gagné</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function formatNumber(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
