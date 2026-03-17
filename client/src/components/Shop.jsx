import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { buyUpgrade } from '../lib/api';

const UPGRADE_CATEGORIES = [
  {
    title: '🎡 Roue',
    upgrades: [
      { id: 'extra_wheel',   icon: '🎡', name: 'Roue Supplémentaire', desc: '+1 roue simultanée', baseCost: 150, costScale: 2.8, maxLevel: 10 },
      { id: 'turbo_spin',    icon: '⚡', name: 'Turbo Spin', desc: 'Vitesse de rotation accélérée', baseCost: 100, costScale: 1.5, maxLevel: 10 },
      { id: 'golden_wheel',  icon: '👑', name: 'Golden Wheels', desc: 'Rend les roues successives dorées (x3)', baseCost: 5000, costScale: 5.0, maxLevel: 5 },
      { id: 'mega_segments', icon: '💎', name: 'Méga Segments', desc: 'Ajoute des segments ultra-riches', baseCost: 1500, costScale: 2.5, maxLevel: 10 },
    ],
  },
  {
    title: '💰 Gains',
    upgrades: [
      { id: 'multiplier',    icon: '✖️', name: 'Multiplicateur', desc: 'x1.8 sur TOUS les gains (cumulatif!)', baseCost: 250, costScale: 1.35, maxLevel: 50 },
      { id: 'coin_magnet',   icon: '🧲', name: 'Coin Magnet', desc: '+10% bonus constant', baseCost: 200, costScale: 1.25, maxLevel: 100 },
      { id: 'lucky',         icon: '🍀', name: 'Lucky Wheel', desc: 'Force la roue vers les gros segments', baseCost: 500, costScale: 1.8, maxLevel: 15 },
    ],
  },
  {
    title: '💥 Power Roll',
    upgrades: [
      { id: 'power_roll',       icon: '💥', name: 'Power Roll', desc: 'Active le roll puissant périodique', baseCost: 2000, costScale: 2.5, maxLevel: 10 },
      { id: 'power_roll_boost', icon: '🔥', name: 'Power Boost', desc: 'Augmente le multiplicateur du Power Roll', baseCost: 3000, costScale: 2.0, maxLevel: 25 },
      { id: 'power_roll_freq',  icon: '⏩', name: 'Fréquence Power', desc: 'Réduit le délai entre les Power Rolls', baseCost: 5000, costScale: 1.8, maxLevel: 5 },
    ],
  },
  {
    title: '✨ Bonus Spéciaux',
    upgrades: [
      { id: 'diamond_rain',   icon: '💠', name: 'Pluie de Diamants', desc: 'Chance de doubler le gain final', baseCost: 10000, costScale: 2.2, maxLevel: 10 },
      { id: 'combo_streak',   icon: '🔗', name: 'Combo Streak', desc: 'Bonus massif pour les spins rapides', baseCost: 1200, costScale: 1.4, maxLevel: 30 },
      { id: 'jackpot_chance',  icon: '🎰', name: 'Jackpot!', desc: 'Chance rare de multiplier par 10', baseCost: 25000, costScale: 3.5, maxLevel: 5 },
      { id: 'auto_spin',      icon: '🤖', name: 'Auto-Spin', desc: 'Tourne tout seul, de plus en plus vite', baseCost: 1000, costScale: 2.2, maxLevel: 10 },
    ],
  },
];

export default function Shop({ isOpen, onClose }) {
  const { token, user, upgrades, updateUserData } = useAuth();
  const [buyingId, setBuyingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleBuy = async (upg) => {
    if (buyingId) return;
    setBuyingId(upg.id);
    try {
      const data = await buyUpgrade(token, upg.id);
      updateUserData(data.user, data.upgrades);
      showToast(`${upg.icon} ${upg.name} amélioré!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBuyingId(null);
    }
  };

  const getCost = (upg) => {
    const lvl = upgrades[upg.id] || 0;
    return Math.floor(upg.baseCost * Math.pow(upg.costScale, lvl));
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 w-[420px] max-w-full h-full bg-dark-900/95 backdrop-blur-xl border-l border-white/10 z-50 transition-transform duration-300 ease-out flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.5)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
            🛒 Shop — {UPGRADE_CATEGORIES.reduce((acc, cat) => acc + cat.upgrades.length, 0)} Upgrades
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Items by category */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {UPGRADE_CATEGORIES.map((cat) => (
            <div key={cat.title}>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {cat.title}
              </h3>
              <div className="space-y-2">
                {cat.upgrades.map((upg) => {
                  const lvl = upgrades[upg.id] || 0;
                  const isMaxed = lvl >= upg.maxLevel;
                  const cost = getCost(upg);
                  const canAfford = user && user.coins >= cost;
                  const isBuying = buyingId === upg.id;

                  return (
                    <button
                      key={upg.id}
                      id={`shop-${upg.id}`}
                      disabled={isMaxed || !canAfford || isBuying}
                      onClick={() => handleBuy(upg)}
                      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all duration-200 text-left
                        ${isMaxed
                          ? 'border-emerald-500/30 opacity-40 cursor-default'
                          : canAfford
                            ? 'border-white/10 hover:border-purple-500/60 hover:-translate-x-1 hover:shadow-[4px_0_20px_rgba(124,58,237,0.15)] cursor-pointer bg-white/[0.03]'
                            : 'border-white/5 opacity-40 cursor-not-allowed bg-white/[0.02]'
                        }`}
                    >
                      <div className="text-2xl w-11 h-11 flex items-center justify-center glass rounded-xl flex-shrink-0 p-2">
                        {upg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{upg.name}</div>
                        <div className="text-xs text-gray-500 leading-snug">{upg.desc}</div>
                        <div className="text-xs font-semibold text-purple-400 mt-0.5">
                          {isMaxed ? '✅ MAX' : `Niveau ${lvl}/${upg.maxLevel}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-yellow-400 shrink-0 text-sm">
                        {isMaxed ? '—' : (
                          <>
                            <span>🪙</span>
                            <span>{formatNumber(cost)}</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-xl font-semibold text-sm backdrop-blur-xl border shadow-lg animate-slide-in
          ${toast.type === 'success' ? 'border-emerald-500/50 text-emerald-400 bg-dark-900/90' : 'border-red-500/50 text-red-400 bg-dark-900/90'}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}

function formatNumber(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.floor(n));
}
