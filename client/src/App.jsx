import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import LoginButton from './components/LoginButton';
import Dashboard from './components/Dashboard';
import WheelGame from './components/WheelGame';
import Shop from './components/Shop';

export default function App() {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const [shopOpen, setShopOpen] = useState(false);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl animate-bounce">🎰</div>
          <p className="text-gray-500 font-semibold">Chargement de ChiboubRoll...</p>
        </div>
      </div>
    );
  }

  // Not authenticated → show login
  if (!isAuthenticated) {
    return <LoginButton />;
  }

  // Authenticated → show game
  return (
    <div className="min-h-screen relative">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-20 flex items-center justify-between px-6 bg-dark-900/85 backdrop-blur-xl border-b border-white/10 z-[100]">
        {/* Left: Brand */}
        <h1 className="text-xl font-extrabold bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-600 bg-clip-text text-transparent">
          🪙 ChiboubRoll
        </h1>

        {/* Center: Coin display */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 glass rounded-full px-6 py-2">
            <span className="text-xl">🪙</span>
            <span className="text-xl font-extrabold text-yellow-400 drop-shadow-[0_0_15px_rgba(245,166,35,0.4)] min-w-[50px] text-center">
              {formatNumber(user?.coins || 0)}
            </span>
            <span className="text-sm font-semibold text-yellow-500/70">CC</span>
          </div>
          <div className="flex gap-4 text-[0.65rem] text-gray-600">
            <span>{formatNumber(user?.total_spins || 0)} spins</span>
            <span>{formatNumber(user?.total_earned || 0)} CC gagnés</span>
          </div>
        </div>

        {/* Right: Shop + User */}
        <div className="flex items-center gap-3">
          <button
            id="btn-shop-toggle"
            onClick={() => setShopOpen(true)}
            className="bg-gradient-to-br from-purple-600 to-purple-800 text-white font-semibold px-5 py-2.5 rounded-full text-sm hover:-translate-y-0.5 hover:shadow-[0_6px_25px_rgba(124,58,237,0.4)] transition-all"
          >
            🛒 Shop
          </button>
          <button
            onClick={logout}
            className="glass rounded-full px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-col items-center justify-center min-h-screen pt-28 pb-10 relative z-10">
        <Dashboard />
        <WheelGame />
      </main>

      {/* Shop */}
      <Shop isOpen={shopOpen} onClose={() => setShopOpen(false)} />
    </div>
  );
}

function formatNumber(n) {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
