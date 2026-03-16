import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, upgrades } = useAuth();

  if (!user) return null;

  const stats = [
    { label: 'Total Earned', value: formatNumber(user.total_earned), icon: '💰' },
    { label: 'Total Spins', value: formatNumber(user.total_spins), icon: '🎰' },
    { label: 'Multiplier', value: `x${Math.pow(2, upgrades.multiplier || 0)}`, icon: '✖️' },
    { label: 'Wheels', value: 1 + (upgrades.extra_wheel || 0), icon: '🎡' },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 mb-6">
      {/* User card */}
      <div className="glass rounded-2xl p-5 flex items-center gap-5 mb-5">
        <img
          src={user.avatar}
          alt={user.username}
          className="w-14 h-14 rounded-full ring-2 ring-gold/50 shadow-lg"
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate">{user.username}</h2>
          <p className="text-gray-500 text-sm">ChiboubRoll Player</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 bg-dark-700/60 rounded-full px-5 py-2.5">
            <span className="text-2xl">🪙</span>
            <span className="text-2xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(245,166,35,0.4)]">
              {formatNumber(user.coins)}
            </span>
            <span className="text-sm font-semibold text-yellow-500/70">CC</span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl p-3 text-center">
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-lg font-bold text-white">{s.value}</div>
            <div className="text-[0.65rem] text-gray-500 uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatNumber(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
