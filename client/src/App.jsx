import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './context/AuthContext';
import { API_BASE } from './lib/api';
import LoginButton from './components/LoginButton';
import Dashboard from './components/Dashboard';
import WheelGame from './components/WheelGame';
import Shop from './components/Shop';
import Leaderboard from './components/Leaderboard';
import CaseOpening from './components/CaseOpening';
import Inventory from './components/Inventory';
import CaseBattle from './components/CaseBattle';
import Battlepass from './components/Battlepass';
import LiveDropFeed from './components/LiveDropFeed';
import TradePanel from './components/TradePanel';

export default function App() {
  const { isAuthenticated, loading, user, token, logout, loadUser } = useAuth();
  const [activePanel, setActivePanel] = useState(null);
  const [socket, setSocket] = useState(null);
  const [tradeInvite, setTradeInvite] = useState(null);
  const [tradeRoom, setTradeRoom] = useState(null);
  const [tradeNotice, setTradeNotice] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socket) socket.disconnect();
      setSocket(null);
      return;
    }

    const nextSocket = io(API_BASE, { auth: { token } });
    nextSocket.on('trade:invite_received', ({ from }) => setTradeInvite(from));
    nextSocket.on('trade:started', (room) => {
      setTradeInvite(null);
      setTradeRoom(room);
    });
    nextSocket.on('trade:update', (room) => setTradeRoom(room));
    nextSocket.on('trade:complete', () => {
      setTradeNotice('Echange termine.');
      setTradeRoom(null);
      loadUser();
    });
    nextSocket.on('trade:declined', ({ user: tradeUser }) => {
      setTradeNotice(`${tradeUser?.username || 'Un joueur'} a refuse l invitation.`);
    });
    nextSocket.on('trade:error', ({ error }) => setTradeNotice(error));
    nextSocket.on('trade:online_users', ({ users }) => setOnlineUserIds(users || []));
    setSocket(nextSocket);

    return () => nextSocket.disconnect();
  }, [isAuthenticated, token, loadUser]);

  useEffect(() => {
    if (!tradeNotice) return undefined;
    const timeout = setTimeout(() => setTradeNotice(null), 2500);
    return () => clearTimeout(timeout);
  }, [tradeNotice]);

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

  if (!isAuthenticated) {
    return <LoginButton />;
  }

  return (
    <div className="min-h-screen relative">
      {!activePanel && !tradeRoom && (
        <LiveDropFeed
          socket={socket}
          onInviteTrade={(targetUserId) => {
            if (socket) socket.emit('trade:invite', { userId: targetUserId });
            setTradeNotice('Invitation envoyee.');
          }}
        />
      )}

      <header className="fixed top-0 left-0 right-0 h-20 flex items-center justify-between px-6 bg-dark-900/85 backdrop-blur-xl border-b border-white/10 z-[100]">
        <h1 className="text-xl font-extrabold bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-600 bg-clip-text text-transparent">
          🪙 ChiboubRoll
        </h1>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 glass rounded-full px-6 py-2">
            <span className="text-xl">🪙</span>
            <span className="text-xl font-extrabold text-yellow-400 min-w-[50px] text-center">
              {formatNumber(user?.coins || 0)}
            </span>
            <span className="text-sm font-semibold text-yellow-500/70">CC</span>
          </div>
          <div className="flex gap-4 text-[0.65rem] text-gray-600">
            <span>{formatNumber(user?.total_spins || 0)} spins</span>
            <span>{formatNumber(user?.total_earned || 0)} CC gagnes</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setActivePanel('leaderboard')} className="bg-gradient-to-br from-yellow-500 to-amber-600 text-dark-900 font-semibold px-4 py-2 rounded-full text-xs">
            🏆 Top 10
          </button>
          <button onClick={() => setActivePanel('shop')} className="bg-gradient-to-br from-purple-600 to-purple-800 text-white font-semibold px-4 py-2 rounded-full text-xs">
            🛒 Shop
          </button>
          <button onClick={() => setActivePanel('cases')} className="bg-gradient-to-br from-orange-500 to-red-600 text-white font-semibold px-4 py-2 rounded-full text-xs">
            📦 Caisses
          </button>
          <button onClick={() => setActivePanel('inventory')} className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-semibold px-4 py-2 rounded-full text-xs">
            🎒 Inventaire
          </button>
          <button onClick={() => setActivePanel('battlepass')} className="bg-gradient-to-br from-cyan-500 to-sky-700 text-white font-semibold px-4 py-2 rounded-full text-xs">
            🚀 Battlepass
          </button>
          <button onClick={() => setActivePanel('battle')} className="bg-gradient-to-br from-red-600 to-pink-700 text-white font-semibold px-4 py-2 rounded-full text-xs">
            ⚔️ Battle
          </button>
          <button onClick={logout} className="glass rounded-full px-3 py-2 text-xs text-gray-400 hover:text-white transition-colors">
            Deco
          </button>
        </div>
      </header>

      <main className={`flex flex-col items-center justify-center min-h-screen pt-28 pb-10 pr-8 relative z-10 ${!activePanel && !tradeRoom ? 'pl-[320px] max-[1100px]:pl-8' : 'pl-8'}`}>
        <Dashboard />
        <WheelGame />
      </main>

      <Shop isOpen={activePanel === 'shop'} onClose={() => setActivePanel(null)} />
      <Leaderboard
        isOpen={activePanel === 'leaderboard'}
        onClose={() => setActivePanel(null)}
        onlineUserIds={onlineUserIds}
        onInviteTrade={(targetUserId) => {
          if (socket) socket.emit('trade:invite', { userId: targetUserId });
          setTradeNotice('Invitation envoyee.');
        }}
      />
      <CaseOpening isOpen={activePanel === 'cases'} onClose={() => setActivePanel(null)} />
      <Inventory isOpen={activePanel === 'inventory'} onClose={() => setActivePanel(null)} />
      <Battlepass isOpen={activePanel === 'battlepass'} onClose={() => setActivePanel(null)} />
      <CaseBattle isOpen={activePanel === 'battle'} onClose={() => setActivePanel(null)} socket={socket} />

      <TradePanel
        socket={socket}
        invite={tradeInvite}
        tradeRoom={tradeRoom}
        onCloseInvite={() => setTradeInvite(null)}
        onCloseTrade={() => setTradeRoom(null)}
      />

      {tradeNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-xl font-semibold text-sm backdrop-blur-xl border border-white/15 text-white bg-dark-900/90">
          {tradeNotice}
        </div>
      )}
    </div>
  );
}

function formatNumber(n) {
  if (!n) return '0';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
