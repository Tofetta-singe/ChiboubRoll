import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { fetchCases, API_BASE } from '../lib/api';

export default function CaseBattle({ isOpen, onClose }) {
  const { token, user, updateUserData } = useAuth();
  const [cases, setCases] = useState([]);
  const [socket, setSocket] = useState(null);
  
  // Lobby state
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null); // The room user is in
  
  // Battle state
  const [battleResult, setBattleResult] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchCases().then(data => setCases(data.cases || [])).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && token && !socket) {
      // Connect to Socket.IO using the exact API_BASE (which includes the port if not 80/443)
      const newSocket = io(API_BASE, {
        auth: { token },
      });

      newSocket.on('connect', () => {
        newSocket.emit('battle:getLobby');
      });

      newSocket.on('battle:lobby', ({ rooms }) => {
        setRooms(rooms);
      });

      newSocket.on('battle:created', ({ room }) => {
        setActiveRoom(room);
        setBattleResult(null);
        setIsStarting(false);
      });

      newSocket.on('battle:start', ({ room }) => {
        setActiveRoom(room);
        setBattleResult(null);
        setIsStarting(true);
      });

      newSocket.on('battle:result', (result) => {
        setIsStarting(false);
        setBattleResult(result);
      });

      newSocket.on('battle:error', ({ error }) => {
        showToast(error, 'error');
      });

      newSocket.on('battle:cancelled', () => {
        showToast('La room a été annulée.', 'error');
        setActiveRoom(null);
        setBattleResult(null);
      });

      newSocket.on('battle:coins', ({ coins }) => {
        updateUserData({ coins });
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
        setSocket(null);
        setActiveRoom(null);
        setBattleResult(null);
        setIsStarting(false);
      };
    } else if (!isOpen && socket) {
      socket.disconnect();
      setSocket(null);
      setActiveRoom(null);
      setBattleResult(null);
      setIsStarting(false);
    }
  }, [isOpen, token]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleCreateRoom = (caseId) => {
    const c = cases.find((x) => x.id === caseId);
    if (!c) return;
    if (user.coins < c.price) {
      showToast('Pas assez de CC!', 'error');
      return;
    }
    socket.emit('battle:create', { caseId });
  };

  const handleJoinRoom = (roomId) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    if (user.coins < room.price) {
      showToast('Pas assez de CC!', 'error');
      return;
    }
    socket.emit('battle:join', { roomId });
  };

  const handleCancelRoom = () => {
    if (activeRoom) {
      socket.emit('battle:cancel', { roomId: activeRoom.id });
      setActiveRoom(null);
    }
  };

  const handleLeaveRoom = () => {
    setActiveRoom(null);
    setBattleResult(null);
    // Refresh lobby
    if (socket) socket.emit('battle:getLobby');
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/80 z-[110] backdrop-blur-sm flex items-center justify-center p-4">
        {/* Main large modal */}
        <div className="w-[90vw] max-w-6xl h-[85vh] bg-dark-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
            <h2 className="text-3xl font-black bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent flex items-center gap-3">
              ⚔️ Case Battle (En direct)
            </h2>
            <div className="flex items-center gap-4">
              <div className="glass px-4 py-2 rounded-xl text-yellow-400 font-bold text-sm">
                🪙 {user?.coins || 0} CC
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full glass hover:bg-white/10 flex items-center justify-center text-xl transition-all"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-6 relative">
            
            {/* 1) LOBBY: We are not in a room */}
            {!activeRoom && (
              <div className="flex flex-col gap-8">
                
                {/* Rooms list */}
                <div>
                  <h3 className="text-xl font-bold mb-4 text-white/90">Lobby — Rejoindre un combat</h3>
                  {rooms.length === 0 ? (
                    <div className="glass p-8 rounded-2xl text-center text-gray-500">
                      Aucune room ouverte pour le moment. Crée la tienne !
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {rooms.map(room => (
                        <div key={room.id} className="glass p-4 rounded-2xl border border-white/5 flex flex-col gap-3 hover:border-white/20 transition-all">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl" style={{color: room.caseColor}}>{room.caseIcon}</span>
                              <span className="font-bold text-sm" style={{color: room.caseColor}}>{room.caseName}</span>
                            </div>
                            <span className="text-yellow-400 font-bold text-sm bg-dark-900/50 px-2 py-1 rounded-lg">
                              🪙 {room.price}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between bg-dark-900/40 rounded-xl p-3">
                            <div className="flex flex-col items-center">
                              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center mb-1 overflow-hidden">
                                {room.creator.avatar ? <img src={room.creator.avatar} /> : '👤'}
                              </div>
                              <span className="text-xs font-semibold text-gray-300">
                                {room.creator.id === user?.id ? 'Toi' : room.creator.username}
                              </span>
                            </div>

                            <span className="text-xl font-black text-red-500/50">VS</span>

                            <div className="flex flex-col items-center opacity-50">
                              <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center mb-1">
                                ❓
                              </div>
                              <span className="text-xs font-semibold text-gray-500">
                                En attente...
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleJoinRoom(room.id)}
                            disabled={room.creator.id === user?.id}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white font-bold py-2 rounded-xl transition-all w-full text-sm"
                          >
                            {room.creator.id === user?.id ? 'C\'est ta room' : 'Rejoindre ⚔️'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="h-px bg-white/10 w-full" />

                {/* Create a room */}
                <div>
                  <h3 className="text-xl font-bold mb-4 text-white/90">Créer une Room</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {cases.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleCreateRoom(c.id)}
                        className="glass p-4 rounded-2xl flex flex-col items-center text-center gap-2 hover:-translate-y-1 hover:shadow-xl transition-all hover:bg-white/5"
                        style={{ borderTop: `2px solid ${c.color}` }}
                      >
                        <span className="text-4xl" style={{ filter: `drop-shadow(0 0 10px ${c.color}66)` }}>
                          {c.icon}
                        </span>
                        <div className="font-bold text-sm" style={{ color: c.color }}>
                          {c.name}
                        </div>
                        <div className="text-yellow-400 font-bold text-xs bg-dark-900/50 px-3 py-1 rounded-full w-full">
                          🪙 {c.price} CC
                        </div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Créer ⚔️</div>
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* 2) ACTIVE ROOM: Waiting, Rolling, or Results */}
            {activeRoom && (
              <div className="h-full flex flex-col items-center">
                
                {/* Active Room Header */}
                <div className="glass px-8 py-4 rounded-3xl flex items-center gap-6 mb-10 border border-white/10">
                  <div className="text-4xl">{activeRoom.caseIcon}</div>
                  <div>
                    <h3 className="text-2xl font-black" style={{ color: activeRoom.caseColor }}>
                      {activeRoom.caseName}
                    </h3>
                    <p className="text-sm font-bold text-yellow-400">
                      Mise: 🪙 {activeRoom.price} CC
                    </p>
                  </div>
                </div>

                {/* The Battle Arena */}
                <div className="flex w-full max-w-4xl justify-between items-stretch gap-8 relative">
                  
                  {/* Creator Player Card */}
                  <PlayerCard 
                    player={activeRoom.creator} 
                    isWinner={battleResult ? battleResult.winnerId === activeRoom.creator.id : null}
                    isYou={activeRoom.creator.id === user?.id}
                    isStarting={isStarting}
                    skinResult={battleResult ? battleResult.creatorSkin : null}
                  />

                  {/* Center VS Indicator */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="text-6xl font-black bg-gradient-to-b from-red-500 to-red-800 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                      VS
                    </div>
                  </div>

                  {/* Joiner Player Card */}
                  <PlayerCard 
                    player={activeRoom.joiner} 
                    isWinner={battleResult ? battleResult.winnerId === activeRoom.joiner?.id : null}
                    isYou={activeRoom.joiner?.id === user?.id}
                    isStarting={isStarting}
                    skinResult={battleResult ? battleResult.joinerSkin : null}
                  />

                </div>

                {/* Room actions & Status */}
                <div className="mt-12 text-center">
                  {!activeRoom.joiner && !isStarting && !battleResult && (
                    <div className="space-y-4">
                      <p className="text-xl font-bold text-gray-400 animate-pulse">
                        En attente d'un adversaire...
                      </p>
                      {activeRoom.creator.id === user?.id && (
                        <button 
                          onClick={handleCancelRoom}
                          className="px-6 py-2 bg-red-600/20 text-red-500 hover:bg-red-600/40 font-bold rounded-xl transition-all"
                        >
                          Annuler et Rembourser
                        </button>
                      )}
                    </div>
                  )}

                  {isStarting && (
                    <div className="space-y-4 animate-pop">
                      <p className="text-2xl font-black text-amber-400 animate-pulse drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                        Ouverture des caisses... 🎰
                      </p>
                    </div>
                  )}

                  {battleResult && (
                    <div className="space-y-6 animate-pop">
                      <div className="text-3xl font-black">
                        {battleResult.winnerId === user?.id ? (
                          <span className="text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                            🎉 TU AS GAGNÉ LES DEUX SKINS ! 🎉
                          </span>
                        ) : (
                          <span className="text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                            💀 TU AS PERDU... 💀
                          </span>
                        )}
                      </div>
                      <button
                        onClick={handleLeaveRoom}
                        className="px-8 py-3 bg-white text-dark-900 font-extrabold text-lg rounded-2xl hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                      >
                        Retour au Lobby
                      </button>
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>

      </div>

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

// Subcomponent for displaying player in active room
function PlayerCard({ player, isWinner, isYou, isStarting, skinResult }) {
  if (!player) {
    return (
      <div className="flex-1 glass rounded-3xl p-6 border-2 border-dashed border-gray-600/50 flex flex-col items-center justify-center opacity-50 min-h-[300px]">
        <div className="text-6xl mb-4">❓</div>
        <p className="font-bold text-gray-400 text-lg">En attente...</p>
      </div>
    );
  }

  let borderClass = "border-white/10";
  let bgClass = "bg-dark-800/50";
  
  if (isWinner === true) {
    borderClass = "border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.3)]";
    bgClass = "bg-emerald-900/20";
  } else if (isWinner === false) {
    borderClass = "border-red-500/50";
    bgClass = "bg-red-900/10 opacity-50";
  } else if (isYou) {
    borderClass = "border-blue-500/50";
  }

  return (
    <div className={`flex-1 rounded-3xl p-6 border-2 flex flex-col items-center justify-start transition-all duration-700 min-h-[350px] ${borderClass} ${bgClass}`}>
      {/* Avatar/Name */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-dark-700 border-4 border-dark-900 overflow-hidden mb-3 relative">
          {player.avatar ? <img src={player.avatar} className="w-full h-full object-cover" /> : <div className="text-3xl mt-4">👤</div>}
          {isYou && <div className="absolute bottom-0 inset-x-0 bg-blue-500 text-[10px] text-center font-bold">TOI</div>}
        </div>
        <span className="font-black text-xl text-white drop-shadow-md">
          {player.username}
        </span>
      </div>

      {/* Box / Spin state */}
      <div className="flex-1 w-full flex flex-col items-center justify-center">
        {!isStarting && !skinResult && (
          <div className="text-6xl animate-pulse">📦</div>
        )}
        
        {isStarting && (
          <div className="w-full space-y-3 flex flex-col items-center">
            <div className="text-6xl animate-spin-slow drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">🔄</div>
          </div>
        )}

        {skinResult && (
          <div className="flex flex-col items-center animate-pop w-full">
            <div 
              className="w-full p-4 rounded-2xl border-2 flex flex-col items-center justify-center bg-dark-900/80 shadow-2xl"
              style={{ borderColor: skinResult.rarity_color }}
            >
              <img 
                src={skinResult.skin_image || ''} 
                alt=""
                className="w-32 h-24 object-contain mb-3 drop-shadow-xl" 
                style={{ filter: `drop-shadow(0 0 10px ${skinResult.rarity_color}88)` }}
              />
              <p className="text-sm font-black text-center truncate w-full" style={{ color: skinResult.rarity_color }}>
                {skinResult.skin_name}
              </p>
              <p className="text-[10px] font-bold mt-1" style={{ color: skinResult.rarity_color + 'aa' }}>
                {skinResult.rarity}
              </p>
              <div className="text-base font-black text-yellow-500 mt-2 bg-dark-900 px-4 py-1 rounded-full">
                🪙 {skinResult.sell_value}
              </div>
            </div>
            {isWinner === true && (
              <div className="absolute -top-6 -right-6 text-6xl animate-bounce">👑</div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
