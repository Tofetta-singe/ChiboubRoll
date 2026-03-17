import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { buyUpgrade } from '../lib/api';

const UPGRADE_CATEGORIES = [
  {
    title: 'Roue',
    upgrades: [
      { id: 'extra_wheel', icon: '🎡', name: 'Roue Supplementaire', desc: '+1 roue simultanee', baseCost: 300, costScale: 3.2, maxLevel: 2 },
      { id: 'turbo_spin', icon: '⚡', name: 'Turbo Spin', desc: 'Vitesse de rotation acceleree', baseCost: 180, costScale: 1.8, maxLevel: 3 },
      { id: 'mega_segments', icon: '💎', name: 'Mega Segments', desc: 'Ajoute quelques segments plus rentables', baseCost: 2600, costScale: 3.0, maxLevel: 2 },
    ],
  },
  {
    title: 'Gains',
    upgrades: [
      { id: 'multiplier', icon: '✖️', name: 'Multiplicateur', desc: 'x1.35 sur les gains', baseCost: 450, costScale: 1.7, maxLevel: 3 },
      { id: 'coin_magnet', icon: '🧲', name: 'Coin Magnet', desc: '+5% bonus constant', baseCost: 500, costScale: 1.6, maxLevel: 3 },
      { id: 'lucky', icon: '🍀', name: 'Lucky Wheel', desc: 'Ameliore legerement les gros segments', baseCost: 900, costScale: 2.1, maxLevel: 3 },
    ],
  },
  {
    title: 'Power Roll',
    upgrades: [
      { id: 'power_roll', icon: '💥', name: 'Power Roll', desc: 'Active un roll booste plus rare', baseCost: 4200, costScale: 2.8, maxLevel: 3 },
      { id: 'power_roll_boost', icon: '🔥', name: 'Power Boost', desc: 'Augmente legerement le bonus du Power Roll', baseCost: 5500, costScale: 2.4, maxLevel: 3 },
      { id: 'power_roll_freq', icon: '⏩', name: 'Frequence Power', desc: 'Reduit un peu le delai entre les Power Rolls', baseCost: 7000, costScale: 2.2, maxLevel: 3 },
    ],
  },
  {
    title: 'Bonus Speciaux',
    upgrades: [
      { id: 'diamond_rain', icon: '💠', name: 'Pluie de Diamants', desc: 'Petite chance de doubler le gain final', baseCost: 14000, costScale: 2.5, maxLevel: 3 },
      { id: 'combo_streak', icon: '🔗', name: 'Combo Streak', desc: 'Bonus modere pour les spins rapides', baseCost: 2200, costScale: 1.7, maxLevel: 3 },
      { id: 'jackpot_chance', icon: '🎰', name: 'Jackpot!', desc: 'Tres petite chance de multiplier par 10', baseCost: 42000, costScale: 4.0, maxLevel: 2 },
      { id: 'auto_spin', icon: '🤖', name: 'Auto-Spin', desc: 'Tourne tout seul, mais reste controle', baseCost: 1800, costScale: 2.8, maxLevel: 3 },
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

  const handleBuy = async (upgrade) => {
    if (buyingId) return;
    setBuyingId(upgrade.id);
    try {
      const data = await buyUpgrade(token, upgrade.id);
      updateUserData(data.user, data.upgrades);
      showToast(`${upgrade.icon} ${upgrade.name} ameliore!`, 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBuyingId(null);
    }
  };

  const getCost = (upgrade) => {
    const level = upgrades[upgrade.id] || 0;
    return Math.floor(upgrade.baseCost * Math.pow(upgrade.costScale, level));
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={onClose} />}

      <aside className={`fixed top-0 right-0 w-[420px] max-w-full h-full bg-dark-900/95 backdrop-blur-xl border-l border-white/10 z-50 transition-transform duration-300 ease-out flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.5)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
            Shop - {UPGRADE_CATEGORIES.reduce((acc, category) => acc + category.upgrades.length, 0)} Upgrades
          </h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {UPGRADE_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{category.title}</h3>
              <div className="space-y-2">
                {category.upgrades.map((upgrade) => {
                  const level = upgrades[upgrade.id] || 0;
                  const isMaxed = level >= upgrade.maxLevel;
                  const cost = getCost(upgrade);
                  const canAfford = user && user.coins >= cost;
                  const isBuying = buyingId === upgrade.id;

                  return (
                    <button
                      key={upgrade.id}
                      id={`shop-${upgrade.id}`}
                      disabled={isMaxed || !canAfford || isBuying}
                      onClick={() => handleBuy(upgrade)}
                      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all duration-200 text-left
                        ${isMaxed
                          ? 'border-emerald-500/30 opacity-40 cursor-default'
                          : canAfford
                            ? 'border-white/10 hover:border-purple-500/60 hover:-translate-x-1 hover:shadow-[4px_0_20px_rgba(124,58,237,0.15)] cursor-pointer bg-white/[0.03]'
                            : 'border-white/5 opacity-40 cursor-not-allowed bg-white/[0.02]'
                        }`}
                    >
                      <div className="text-2xl w-11 h-11 flex items-center justify-center glass rounded-xl flex-shrink-0 p-2">{upgrade.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{upgrade.name}</div>
                        <div className="text-xs text-gray-500 leading-snug">{upgrade.desc}</div>
                        <div className="text-xs font-semibold text-purple-400 mt-0.5">
                          {isMaxed ? 'MAX' : `Niveau ${level}/${upgrade.maxLevel}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-yellow-400 shrink-0 text-sm">
                        {isMaxed ? '—' : (<><span>🪙</span><span>{formatNumber(cost)}</span></>)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-xl font-semibold text-sm backdrop-blur-xl border shadow-lg animate-slide-in ${toast.type === 'success' ? 'border-emerald-500/50 text-emerald-400 bg-dark-900/90' : 'border-red-500/50 text-red-400 bg-dark-900/90'}`}>
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
