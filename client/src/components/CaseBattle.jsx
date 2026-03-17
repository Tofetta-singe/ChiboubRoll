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
  const [currentRound, setCurrentRound] = useState(null);
  const [roundResults, setRoundResults] = useState([]);
  
  // Cart state
  const [cart, setCart] = useState([]); // Array of { id, caseId, name, icon, color, price }
  
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

      newSocket.on('battle:start_all', ({ room }) => {
        setActiveRoom(room);
        setBattleResult(null);
        setRoundResults([]);
        setCurrentRound(null);
        setIsStarting(true);
      });

      newSocket.on('battle:round_start', ({ roundIndex, creatorStrip, joinerStrip }) => {
        setCurrentRound({ index: roundIndex, creatorStrip, joinerStrip, state: 'rolling' });
      });

      newSocket.on('battle:round_result', ({ roundIndex, creatorSkin, joinerSkin, creatorRoundWins }) => {
        setCurrentRound(prev => prev ? { ...prev, state: 'result', creatorSkin, joinerSkin } : null);
        setRoundResults(prev => [...prev, { roundIndex, creatorSkin, joinerSkin, creatorRoundWins }]);
      });

      newSocket.on('battle:finish', (result) => {
        setIsStarting(false);
        setCurrentRound(null);
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
        setCurrentRound(null);
        setRoundResults([]);
      };
    } else if (!isOpen && socket) {
      socket.disconnect();
      setSocket(null);
      setActiveRoom(null);
      setBattleResult(null);
      setIsStarting(false);
      setCurrentRound(null);
      setRoundResults([]);
    }
  }, [isOpen, token]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleCreateRoom = () => {
    if (cart.length === 0) return;
    const totalPrice = cart.reduce((acc, c) => acc + c.price, 0);
    if (user.coins < totalPrice) {
      showToast('Pas assez de CC!', 'error');
      return;
    }
    const caseIds = cart.map(c => c.caseId);
    socket.emit('battle:create', { caseIds });
    setCart([]);
  };

  const addToCart = (caseObj) => {
    if (cart.length >= 10) {
      showToast('Maximum 10 caisses par battle', 'error');
      return;
    }
    setCart([...cart, { id: Math.random().toString(), caseId: caseObj.id, name: caseObj.name, icon: caseObj.icon, color: caseObj.color, price: caseObj.price }]);
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(c => c.id !== id));
  };

  const handleJoinRoom = (roomId) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    if (user.coins < room.totalPrice) {
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
    setCurrentRound(null);
    setRoundResults([]);
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
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex -space-x-2 overflow-hidden items-center group relative cursor-pointer">
                               {room.rounds.slice(0, 5).map((r, i) => (
                                 <div key={i} className="w-8 h-8 rounded-full border-2 border-dark-900 bg-dark-800 flex items-center justify-center text-sm z-10 hover:z-20 transform hover:scale-110 transition-all" style={{borderColor: r.caseColor}}>
                                   {r.caseIcon}
                                 </div>
                               ))}
                               {room.rounds.length > 5 && (
                                 <div className="w-8 h-8 rounded-full border-2 border-dark-900 bg-dark-700 flex items-center justify-center text-xs font-bold text-gray-300 z-0 pl-1">
                                   +{room.rounds.length - 5}
                                 </div>
                               )}
                            </div>
                            <span className="text-yellow-400 font-bold text-sm bg-dark-900/50 px-2 py-1 rounded-lg">
                              🪙 {room.totalPrice}
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
                  <div className="flex justify-between items-end mb-4">
                    <h3 className="text-xl font-bold text-white/90">Créer une Room</h3>
                    {cart.length > 0 && (
                      <div className="flex items-center gap-4 bg-dark-800/80 px-4 py-2 rounded-2xl border border-white/10">
                        <div className="flex gap-1 overflow-x-auto max-w-[200px] no-scrollbar">
                          {cart.map(c => (
                            <div key={c.id} onClick={() => removeFromCart(c.id)} className="cursor-pointer hover:scale-110 transition-transform bg-dark-900 w-8 h-8 rounded shrink-0 flex items-center justify-center text-xs border border-white/5 hover:border-red-500/50 group relative">
                              {c.icon}
                              <div className="absolute inset-0 bg-red-500/80 items-center justify-center rounded hidden group-hover:flex">✕</div>
                            </div>
                          ))}
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-400 text-xs">Total:</span><br/>
                          <span className="text-yellow-400 font-bold">🪙 {cart.reduce((a, b) => a + b.price, 0)}</span>
                        </div>
                        <button onClick={handleCreateRoom} className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-black px-4 py-2 rounded-xl active:scale-95 transition-all shadow-lg whitespace-nowrap">
                          Lancer la Battle ⚔️
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {cases.map(c => (
                      <button
                        key={c.id}
                        onClick={() => addToCart(c)}
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
                        <div className="text-[10px] text-emerald-400 font-bold uppercase mt-1">Ajouter +</div>
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
                <div className="glass px-8 py-3 rounded-3xl flex flex-col items-center gap-2 mb-6 border border-white/10 w-full max-w-4xl">
                  <div className="flex gap-2 mb-2 overflow-x-auto w-full justify-center p-2 no-scrollbar border-b border-white/5 pb-4">
                    {activeRoom.rounds.map((r, i) => (
                      <div key={i} className={`w-12 h-12 flex-shrink-0 rounded-lg flex flex-col items-center justify-center border transition-all ${currentRound && currentRound.index === i ? 'scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)] z-10 brightness-110 border-white' : i < (currentRound?.index || (battleResult ? 999 : 0)) ? 'opacity-40 grayscale border-transparent bg-dark-900' : 'opacity-80 border-white/10 bg-dark-800'}`} style={currentRound && currentRound.index === i ? {borderColor: r.caseColor, backgroundColor: r.caseColor+'33'} : {}}>
                        <span className="text-2xl">{r.caseIcon}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 w-full justify-between px-4">
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-black">
                      Round {currentRound ? currentRound.index + 1 : (battleResult ? activeRoom.rounds.length : 1)} / {activeRoom.rounds.length}
                    </p>
                    <p className="text-sm font-bold text-yellow-400">
                      Top Total: 🪙 {activeRoom.totalPrice} CC
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
                    currentRound={currentRound}
                    isCreator={true}
                    history={roundResults.map(r => r.creatorSkin)}
                    totalValue={battleResult?.creatorTotalValue ?? roundResults.reduce((sum, r) => sum + (r.creatorSkin?.sell_value||0), 0)}
                  />

                  {/* Center VS Indicator */}
                  <div className="flex flex-col items-center justify-start pt-32">
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
                    currentRound={currentRound}
                    isCreator={false}
                    history={roundResults.map(r => r.joinerSkin)}
                    totalValue={battleResult?.joinerTotalValue ?? roundResults.reduce((sum, r) => sum + (r.joinerSkin?.sell_value||0), 0)}
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
function PlayerCard({ player, isWinner, isYou, isStarting, currentRound, isCreator, history, totalValue }) {
  const stripRef = useRef(null);
  
  // Handle animation whenever a new round starts rolling
  useEffect(() => {
    if (currentRound && currentRound.state === 'rolling') {
      const container = stripRef.current;
      if (!container) return;
      
      const serverStrip = isCreator ? currentRound.creatorStrip : currentRound.joinerStrip;
      if (!serverStrip) return;

      // Render actual images onto the strip
      container.innerHTML = '';
      serverStrip.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'flex flex-col items-center justify-start pt-1.5 shrink-0 border-2 rounded-lg gap-0.5 bg-white/5';
        div.style.minWidth = '96px';
        div.style.height = '86px';
        div.style.borderColor = item.rarity_color;
        
        if (item.skin_image) {
          div.innerHTML = `<img src="${item.skin_image}" alt="" style="width:70px;height:45px;object-fit:contain;margin-bottom:2px;" /><span style="font-size:9px;color:${item.rarity_color};font-weight:bold;text-align:center;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px">${item.skin_name}</span>`;
        } else {
          div.innerHTML = `<div style="width:70px;height:45px;background:${item.rarity_color}22;border-radius:6px;display:flex;align-items:center;justify-content:center;margin-bottom:2px;"><span style="font-size:10px;color:${item.rarity_color}">${item.rarity}</span></div><span style="font-size:9px;color:${item.rarity_color};font-weight:bold;text-align:center;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px">${item.skin_name}</span>`;
        }
        container.appendChild(div);
      });

      // Animate
      container.style.transition = 'none';
      container.style.transform = 'translate3d(0, 0, 0)';
      
      // Force internal reflow
      void container.offsetWidth;

      const containerWidth = container.parentElement?.clientWidth || 380;
      // Pos 35 centered. Each item is 96px + 8px gap = 104px
      const targetOffset = 35 * 104 - containerWidth / 2 + 52;

      // Add slight jitter
      const jitter = (Math.random() - 0.5) * 80;

      container.style.transition = 'transform 3.8s cubic-bezier(0.15, 0.85, 0.1, 1)';
      container.style.transform = `translate3d(-${targetOffset + jitter}px, 0, 0)`;
    }
  }, [currentRound, isCreator]);

  if (!player) {
    return (
      <div className="flex-1 glass rounded-3xl p-6 border-2 border-dashed border-gray-600/50 flex flex-col items-center justify-center opacity-50 min-h-[400px]">
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

  const skinResult = currentRound && currentRound.state === 'result' ? (isCreator ? currentRound.creatorSkin : currentRound.joinerSkin) : null;

  return (
    <div className={`flex-1 rounded-3xl p-6 border-2 flex flex-col items-center justify-start transition-all duration-700 min-h-[400px] ${borderClass} ${bgClass}`}>
      {/* Avatar/Name & Total Value */}
      <div className="flex w-full justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-dark-700 border-2 border-dark-900 overflow-hidden relative">
            {player.avatar ? <img src={player.avatar} className="w-full h-full object-cover" /> : <div className="text-2xl mt-3 text-center">👤</div>}
            {isYou && <div className="absolute bottom-0 inset-x-0 bg-blue-500 text-[9px] text-center font-bold">TOI</div>}
          </div>
          <span className="font-black text-xl text-white drop-shadow-md">
            {player.username}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-gray-400 font-bold uppercase uppercase tracking-wider mb-1">Gains Totaux</span>
          <span className={`text-2xl font-black ${isWinner ? 'text-emerald-400' : 'text-yellow-400'}`}>
            🪙 {totalValue}
          </span>
        </div>
      </div>

      {/* Main Rolling / Result Area */}
      <div className="w-full h-32 mb-6 flex flex-col items-center justify-center bg-dark-900 border border-white/5 rounded-2xl relative overflow-hidden">
        
        {!isStarting && !skinResult && (!currentRound || currentRound.state !== 'rolling') && (
          <div className="text-6xl animate-pulse">📦</div>
        )}
        
        {/* Animated Rolling Strip */}
        {currentRound && currentRound.state === 'rolling' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center w-full">
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-yellow-400 z-10 shadow-[0_0_15px_rgba(245,166,35,0.8)]" />
            <div className="relative w-full h-[86px] overflow-hidden">
               <div ref={stripRef} className="absolute inset-y-0 left-0 flex gap-2 w-max" />
            </div>
          </div>
        )}

        {/* Current Round Result Card */}
        {skinResult && (
          <div className="absolute inset-0 bg-dark-900 flex items-center justify-center animate-in zoom-in duration-300">
            <div 
              className="w-full h-full flex items-center justify-between px-6"
              style={{ background: `linear-gradient(to right, ${skinResult.rarity_color}22, transparent)` }}
            >
              <div className="flex items-center gap-4">
                <img src={skinResult.skin_image} alt="" className="w-24 h-20 object-contain drop-shadow-xl" style={{ filter: `drop-shadow(0 0 10px ${skinResult.rarity_color}66)` }}/>
                <div className="flex flex-col">
                  <span className="font-black text-sm" style={{color: skinResult.rarity_color}}>{skinResult.skin_name}</span>
                  <span className="text-[10px] font-bold opacity-70" style={{color: skinResult.rarity_color}}>{skinResult.rarity}</span>
                </div>
              </div>
              <div className="text-xl font-black text-yellow-500 bg-dark-800 px-3 py-2 rounded-xl whitespace-nowrap">
                🪙 {skinResult.sell_value}
              </div>
            </div>
          </div>
        )}
        
        {isWinner === true && (
          <div className="absolute -top-4 -right-4 text-5xl animate-bounce">👑</div>
        )}
      </div>

      {/* Past Rounds History Grid */}
      <div className="w-full mt-auto">
        <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">Historique des drops</h4>
        <div className="grid grid-cols-5 gap-2 w-full max-h-40 overflow-y-auto no-scrollbar">
          {history.map((h, i) => (
             <div key={i} className="aspect-square bg-dark-900 border rounded-lg flex items-center justify-center p-1 relative group hover:scale-110 transition-transform cursor-default" style={{borderColor: h.rarity_color+'66'}}>
                {h.skin_image ? <img src={h.skin_image} className="w-full h-full object-contain mix-blend-screen" /> : <div className="text-xs">?</div>}
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col bg-dark-800 border border-white/20 p-2 rounded-lg z-50 whitespace-nowrap shadow-xl items-center pointer-events-none">
                  <span className="text-xs font-bold" style={{color: h.rarity_color}}>{h.skin_name}</span>
                  <span className="text-yellow-400 font-bold text-[10px]">🪙 {h.value || h.sell_value}</span>
                </div>
             </div>
          ))}
          {(!history || history.length === 0) && (
            <div className="col-span-5 text-center text-xs text-gray-600 py-4 italic">Aucun drop</div>
          )}
        </div>
      </div>

    </div>
  );
}
