import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { fetchCases, API_BASE } from '../lib/api';

const SFX_VOLUME_KEY = 'chiboub_sfx_volume';
const DEFAULT_SFX_VOLUME = 0.18;
const RARE_REVEAL_RARITIES = new Set(['Classified', 'Covert', 'Extraordinary', 'Contraband']);

function readStoredVolume() {
  const raw = Number(localStorage.getItem(SFX_VOLUME_KEY));
  if (Number.isFinite(raw)) return Math.min(1, Math.max(0, raw));
  return DEFAULT_SFX_VOLUME;
}

function isLegendaryItem(item) {
  return RARE_REVEAL_RARITIES.has(item?.rarity);
}

export default function CaseBattle({ isOpen, onClose }) {
  const { token, user, updateUserData } = useAuth();
  const [cases, setCases] = useState([]);
  const [socket, setSocket] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [currentRound, setCurrentRound] = useState(null);
  const [roundResults, setRoundResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState(null);
  const [sfxVolume, setSfxVolume] = useState(DEFAULT_SFX_VOLUME);
  const scrollAudioRef = useRef(null);
  const basicRevealAudioRef = useRef(null);
  const legendaryRevealAudioRef = useRef(null);
  const scrollRateTimerRef = useRef(null);

  useEffect(() => {
    setSfxVolume(readStoredVolume());
    const scrollAudio = new Audio('/sounds/sound_ui_csgo_ui_crate_item_scroll.wav');
    scrollAudio.loop = true;
    scrollAudio.preload = 'auto';
    scrollAudioRef.current = scrollAudio;
    const basicRevealAudio = new Audio('/sounds/sound_ui_item_drop_personal.wav');
    basicRevealAudio.preload = 'auto';
    basicRevealAudioRef.current = basicRevealAudio;
    const legendaryRevealAudio = new Audio('/sounds/sound_ui_item_reveal_legendary.wav');
    legendaryRevealAudio.preload = 'auto';
    legendaryRevealAudioRef.current = legendaryRevealAudio;
    return () => stopBattleAudio();
  }, []);

  useEffect(() => {
    const syncVolume = (event) => {
      if (event?.detail?.sfxVolume !== undefined) {
        setSfxVolume(Math.min(1, Math.max(0, Number(event.detail.sfxVolume) || 0)));
        return;
      }
      setSfxVolume(readStoredVolume());
    };
    window.addEventListener('storage', syncVolume);
    window.addEventListener('chiboub:settings', syncVolume);
    return () => {
      window.removeEventListener('storage', syncVolume);
      window.removeEventListener('chiboub:settings', syncVolume);
    };
  }, []);

  useEffect(() => {
    applyAudioVolumes(sfxVolume);
  }, [sfxVolume]);

  useEffect(() => {
    if (isOpen) fetchCases().then((data) => setCases((data.cases || []).filter((item) => item.price > 0))).catch(console.error);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && token && !socket) {
      const newSocket = io(API_BASE, { auth: { token } });
      newSocket.on('connect', () => newSocket.emit('battle:getLobby'));
      newSocket.on('battle:lobby', ({ rooms: nextRooms }) => setRooms(nextRooms));
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
        playScrollLoop(4200);
        setCurrentRound({ index: roundIndex, creatorStrip, joinerStrip, state: 'rolling' });
      });
      newSocket.on('battle:round_result', ({ roundIndex, creatorSkin, joinerSkin, creatorRoundWins }) => {
        stopBattleAudio();
        playRevealForItem(creatorSkin);
        setTimeout(() => playRevealForItem(joinerSkin), 120);
        setCurrentRound((prev) => (prev ? { ...prev, state: 'result', creatorSkin, joinerSkin } : null));
        setRoundResults((prev) => [...prev, { roundIndex, creatorSkin, joinerSkin, creatorRoundWins }]);
      });
      newSocket.on('battle:finish', (result) => {
        stopBattleAudio();
        setIsStarting(false);
        setCurrentRound(null);
        setBattleResult(result);
      });
      newSocket.on('battle:error', ({ error }) => showToast(error, 'error'));
      newSocket.on('battle:cancelled', () => {
        stopBattleAudio();
        showToast('La room a ete annulee.', 'error');
        setActiveRoom(null);
        setBattleResult(null);
      });
      newSocket.on('battle:coins', ({ coins }) => updateUserData({ coins }));
      setSocket(newSocket);
      return () => {
        stopBattleAudio();
        newSocket.disconnect();
        setSocket(null);
        setActiveRoom(null);
        setBattleResult(null);
        setIsStarting(false);
        setCurrentRound(null);
        setRoundResults([]);
      };
    }
    if (!isOpen && socket) {
      stopBattleAudio();
      socket.disconnect();
      setSocket(null);
    }
  }, [isOpen, token]);

  const applyAudioVolumes = (volume) => {
    if (scrollAudioRef.current) scrollAudioRef.current.volume = volume * 0.28;
    if (basicRevealAudioRef.current) basicRevealAudioRef.current.volume = volume * 0.44;
    if (legendaryRevealAudioRef.current) legendaryRevealAudioRef.current.volume = volume * 0.56;
  };

  const stopBattleAudio = () => {
    if (scrollRateTimerRef.current) clearInterval(scrollRateTimerRef.current);
    scrollRateTimerRef.current = null;
    if (scrollAudioRef.current) {
      scrollAudioRef.current.pause();
      scrollAudioRef.current.currentTime = 0;
      scrollAudioRef.current.playbackRate = 1;
    }
  };

  const playScrollLoop = async (durationMs) => {
    const audio = scrollAudioRef.current;
    if (!audio) return;
    applyAudioVolumes(sfxVolume);
    audio.currentTime = 0;
    audio.playbackRate = 2.55;
    if (scrollRateTimerRef.current) clearInterval(scrollRateTimerRef.current);
    const startTime = Date.now();
    scrollRateTimerRef.current = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startTime) / durationMs);
      const eased = 1 - (1 - progress) * (1 - progress);
      audio.playbackRate = 2.55 - eased * 1.8;
      if (progress >= 1) {
        audio.playbackRate = 0.75;
        clearInterval(scrollRateTimerRef.current);
        scrollRateTimerRef.current = null;
      }
    }, 55);
    try {
      await audio.play();
    } catch {}
  };

  const playRevealForItem = (item) => {
    const source = isLegendaryItem(item) ? legendaryRevealAudioRef.current : basicRevealAudioRef.current;
    if (!source) return;
    const nextSound = source.cloneNode();
    nextSound.volume = source.volume;
    nextSound.play().catch(() => {});
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleCreateRoom = () => {
    if (cart.length === 0 || !socket) return;
    const totalPrice = cart.reduce((acc, c) => acc + c.price, 0);
    if (user.coins < totalPrice) return showToast('Pas assez de CC!', 'error');
    socket.emit('battle:create', { caseIds: cart.map((c) => c.caseId) });
    setCart([]);
  };

  const addToCart = (caseObj) => {
    if (cart.length >= 10) return showToast('Maximum 10 caisses par battle', 'error');
    setCart((prev) => [...prev, { id: Math.random().toString(), caseId: caseObj.id, name: caseObj.name, icon: caseObj.icon, color: caseObj.color, price: caseObj.price }]);
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((c) => c.id !== id));

  const handleJoinRoom = (roomId) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room || !socket) return;
    if (user.coins < room.totalPrice) return showToast('Pas assez de CC!', 'error');
    socket.emit('battle:join', { roomId });
  };

  const handleCancelRoom = () => {
    if (!activeRoom || !socket) return;
    stopBattleAudio();
    socket.emit('battle:cancel', { roomId: activeRoom.id });
    setActiveRoom(null);
  };

  const handleLeaveRoom = () => {
    stopBattleAudio();
    setActiveRoom(null);
    setBattleResult(null);
    setCurrentRound(null);
    setRoundResults([]);
    if (socket) socket.emit('battle:getLobby');
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/80 z-[110] backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-[90vw] max-w-6xl h-[85vh] bg-dark-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.12),transparent_30%),radial-gradient(circle_at_bottom_center,rgba(14,165,233,0.08),transparent_26%)]" />
          <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0 relative z-10">
            <h2 className="text-3xl font-black bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">Case Battle</h2>
            <div className="flex items-center gap-4">
              <div className="glass px-4 py-2 rounded-xl text-yellow-400 font-bold text-sm">CC {user?.coins || 0}</div>
              <button onClick={onClose} className="w-10 h-10 rounded-full glass hover:bg-white/10 flex items-center justify-center text-xl transition-all">✕</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6 relative z-10">
            {!activeRoom ? (
              <div className="flex flex-col gap-8">
                <div>
                  <h3 className="text-xl font-bold mb-4 text-white/90">Lobby - Rejoindre un combat</h3>
                  {rooms.length === 0 ? (
                    <div className="glass p-8 rounded-2xl text-center text-gray-500">Aucune room ouverte pour le moment. Cree la tienne.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {rooms.map((room) => (
                        <div key={room.id} className="glass p-4 rounded-2xl border border-white/5 flex flex-col gap-3 hover:border-white/20 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex -space-x-2 overflow-hidden items-center">
                              {room.rounds.slice(0, 5).map((r, i) => <div key={i} className="w-8 h-8 rounded-full border-2 border-dark-900 bg-dark-800 flex items-center justify-center text-sm" style={{ borderColor: r.caseColor }}>{r.caseIcon}</div>)}
                              {room.rounds.length > 5 && <div className="w-8 h-8 rounded-full border-2 border-dark-900 bg-dark-700 flex items-center justify-center text-xs font-bold text-gray-300">+{room.rounds.length - 5}</div>}
                            </div>
                            <span className="text-yellow-400 font-bold text-sm bg-dark-900/50 px-2 py-1 rounded-lg">CC {room.totalPrice}</span>
                          </div>
                          <div className="flex items-center justify-between bg-dark-900/40 rounded-xl p-3">
                            <div className="flex flex-col items-center">
                              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center mb-1 overflow-hidden">{room.creator.avatar ? <img src={room.creator.avatar} alt={room.creator.username} /> : 'J'}</div>
                              <span className="text-xs font-semibold text-gray-300">{room.creator.id === user?.id ? 'Toi' : room.creator.username}</span>
                            </div>
                            <span className="text-xl font-black text-red-500/50">VS</span>
                            <div className="flex flex-col items-center opacity-50">
                              <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center mb-1">?</div>
                              <span className="text-xs font-semibold text-gray-500">En attente...</span>
                            </div>
                          </div>
                          <button onClick={() => handleJoinRoom(room.id)} disabled={room.creator.id === user?.id} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold py-2 rounded-xl transition-all w-full text-sm">{room.creator.id === user?.id ? 'C est ta room' : 'Rejoindre'}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="h-px bg-white/10 w-full" />
                <div>
                  <div className="flex justify-between items-end mb-4 gap-4 flex-wrap">
                    <h3 className="text-xl font-bold text-white/90">Creer une Room</h3>
                    {cart.length > 0 && (
                      <div className="flex items-center gap-4 bg-dark-800/80 px-4 py-2 rounded-2xl border border-white/10">
                        <div className="flex gap-1 overflow-x-auto max-w-[220px] no-scrollbar">
                          {cart.map((c) => <div key={c.id} onClick={() => removeFromCart(c.id)} className="cursor-pointer hover:scale-110 transition-transform bg-dark-900 w-8 h-8 rounded shrink-0 flex items-center justify-center text-xs border border-white/5 hover:border-red-500/50">{c.icon}</div>)}
                        </div>
                        <div className="text-sm"><span className="text-gray-400 text-xs">Total:</span><br /><span className="text-yellow-400 font-bold">CC {cart.reduce((a, b) => a + b.price, 0)}</span></div>
                        <button onClick={handleCreateRoom} className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-black px-4 py-2 rounded-xl active:scale-95 transition-all shadow-lg whitespace-nowrap">Lancer la Battle</button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {cases.map((c) => <button key={c.id} onClick={() => addToCart(c)} className="glass p-4 rounded-2xl flex flex-col items-center text-center gap-2 hover:-translate-y-1 hover:shadow-xl transition-all hover:bg-white/5" style={{ borderTop: `2px solid ${c.color}` }}><span className="text-4xl animate-[battlefloat_2.4s_ease-in-out_infinite]" style={{ filter: `drop-shadow(0 0 10px ${c.color}66)` }}>{c.icon}</span><div className="font-bold text-sm" style={{ color: c.color }}>{c.name}</div><div className="text-yellow-400 font-bold text-xs bg-dark-900/50 px-3 py-1 rounded-full w-full">CC {c.price}</div><div className="text-[10px] text-emerald-400 font-bold uppercase mt-1">Ajouter +</div></button>)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center">
                <div className="glass px-8 py-3 rounded-3xl flex flex-col items-center gap-2 mb-6 border border-white/10 w-full max-w-4xl">
                  <div className="flex gap-2 mb-2 overflow-x-auto w-full justify-center p-2 no-scrollbar border-b border-white/5 pb-4">
                    {activeRoom.rounds.map((r, i) => <div key={i} className={`w-12 h-12 flex-shrink-0 rounded-lg flex items-center justify-center border transition-all ${currentRound && currentRound.index === i ? 'scale-110 shadow-[0_0_20px_rgba(255,255,255,0.28)] z-10 brightness-110 animate-pulse' : i < (currentRound?.index || (battleResult ? 999 : 0)) ? 'opacity-40 grayscale border-transparent bg-dark-900' : 'opacity-80 border-white/10 bg-dark-800'}`} style={currentRound && currentRound.index === i ? { borderColor: r.caseColor, backgroundColor: `${r.caseColor}33` } : {}}><span className="text-2xl">{r.caseIcon}</span></div>)}
                  </div>
                  <div className="flex items-center gap-4 w-full justify-between px-4">
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-black">Round {currentRound ? currentRound.index + 1 : (battleResult ? activeRoom.rounds.length : 1)} / {activeRoom.rounds.length}</p>
                    <p className="text-sm font-bold text-yellow-400">Top Total: CC {activeRoom.totalPrice}</p>
                  </div>
                </div>
                <div className="flex w-full max-w-4xl justify-between items-stretch gap-8 relative">
                  <PlayerCard player={activeRoom.creator} isWinner={battleResult ? battleResult.winnerId === activeRoom.creator.id : null} isYou={activeRoom.creator.id === user?.id} isStarting={isStarting} currentRound={currentRound} isCreator history={roundResults.map((r) => r.creatorSkin)} totalValue={battleResult?.creatorTotalValue ?? roundResults.reduce((sum, r) => sum + (r.creatorSkin?.sell_value || 0), 0)} />
                  <div className="flex flex-col items-center justify-start pt-32"><div className="text-6xl font-black bg-gradient-to-b from-red-500 to-red-800 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse">VS</div></div>
                  <PlayerCard player={activeRoom.joiner} isWinner={battleResult ? battleResult.winnerId === activeRoom.joiner?.id : null} isYou={activeRoom.joiner?.id === user?.id} isStarting={isStarting} currentRound={currentRound} isCreator={false} history={roundResults.map((r) => r.joinerSkin)} totalValue={battleResult?.joinerTotalValue ?? roundResults.reduce((sum, r) => sum + (r.joinerSkin?.sell_value || 0), 0)} />
                </div>
                <div className="mt-12 text-center">
                  {!activeRoom.joiner && !isStarting && !battleResult && <div className="space-y-4"><p className="text-xl font-bold text-gray-400 animate-pulse">En attente d un adversaire...</p>{activeRoom.creator.id === user?.id && <button onClick={handleCancelRoom} className="px-6 py-2 bg-red-600/20 text-red-500 hover:bg-red-600/40 font-bold rounded-xl transition-all">Annuler et rembourser</button>}</div>}
                  {isStarting && <div className="space-y-4 animate-pop"><p className="text-2xl font-black text-amber-400 animate-pulse drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">Ouverture des caisses...</p></div>}
                  {battleResult && <div className="space-y-6 animate-pop"><div className="text-3xl font-black">{battleResult.winnerId === user?.id ? <span className="text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]">Tu as gagne les deux skins</span> : <span className="text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">Tu as perdu</span>}</div><button onClick={handleLeaveRoom} className="px-8 py-3 bg-white text-dark-900 font-extrabold text-lg rounded-2xl hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)]">Retour au Lobby</button></div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {toast && <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-xl font-semibold text-sm backdrop-blur-xl border shadow-lg ${toast.type === 'success' ? 'border-emerald-500/50 text-emerald-400 bg-dark-900/90' : 'border-red-500/50 text-red-400 bg-dark-900/90'}`}>{toast.msg}</div>}
      <style>{`@keyframes battlefloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}`}</style>
    </>
  );
}

function PlayerCard({ player, isWinner, isYou, isStarting, currentRound, isCreator, history, totalValue }) {
  const stripRef = useRef(null);

  useEffect(() => {
    if (currentRound && currentRound.state === 'rolling') {
      const container = stripRef.current;
      if (!container) return;
      const serverStrip = isCreator ? currentRound.creatorStrip : currentRound.joinerStrip;
      if (!serverStrip) return;
      container.innerHTML = '';
      const padded = [...serverStrip, ...serverStrip.slice(0, 10)];
      padded.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'flex flex-col items-center justify-start pt-1.5 shrink-0 border-2 rounded-lg gap-0.5 bg-white/5 overflow-hidden';
        div.style.minWidth = '96px';
        div.style.height = '86px';
        div.style.borderColor = item.rarity_color;
        div.innerHTML = item.skin_image ? `<img src="${item.skin_image}" alt="" style="width:72px;height:46px;object-fit:contain;margin-bottom:3px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.45));" /><span style="font-size:9px;color:${item.rarity_color};font-weight:bold;text-align:center;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px">${item.skin_name}</span>` : `<div style="width:72px;height:46px;background:${item.rarity_color}22;border-radius:6px;display:flex;align-items:center;justify-content:center;margin-bottom:3px;"><span style="font-size:10px;color:${item.rarity_color}">${item.rarity}</span></div><span style="font-size:9px;color:${item.rarity_color};font-weight:bold;text-align:center;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px">${item.skin_name}</span>`;
        container.appendChild(div);
      });
      container.style.transition = 'none';
      container.style.transform = 'translate3d(0,0,0)';
      void container.offsetWidth;
      const containerWidth = container.parentElement?.clientWidth || 380;
      const targetOffset = 35 * 104 - containerWidth / 2 + 52;
      const jitter = (Math.random() - 0.5) * 36;
      container.style.transition = 'transform 4.05s cubic-bezier(0.12, 0.86, 0.16, 1)';
      container.style.transform = `translate3d(-${targetOffset + jitter}px, 0, 0)`;
    }
  }, [currentRound, isCreator]);

  if (!player) return <div className="flex-1 glass rounded-3xl p-6 border-2 border-dashed border-gray-600/50 flex flex-col items-center justify-center opacity-50 min-h-[400px]"><div className="text-6xl mb-4">?</div><p className="font-bold text-gray-400 text-lg">En attente...</p></div>;

  let borderClass = 'border-white/10';
  let bgClass = 'bg-dark-800/50';
  if (isWinner === true) {
    borderClass = 'border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.3)]';
    bgClass = 'bg-emerald-900/20';
  } else if (isWinner === false) {
    borderClass = 'border-red-500/50';
    bgClass = 'bg-red-900/10 opacity-50';
  } else if (isYou) {
    borderClass = 'border-blue-500/50';
  }
  const skinResult = currentRound && currentRound.state === 'result' ? (isCreator ? currentRound.creatorSkin : currentRound.joinerSkin) : null;

  return (
    <div className={`flex-1 rounded-3xl p-6 border-2 flex flex-col items-center justify-start transition-all duration-700 min-h-[400px] ${borderClass} ${bgClass}`}>
      <div className="flex w-full justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-dark-700 border-2 border-dark-900 overflow-hidden relative">{player.avatar ? <img src={player.avatar} alt={player.username} className="w-full h-full object-cover" /> : <div className="text-2xl mt-3 text-center">J</div>}{isYou && <div className="absolute bottom-0 inset-x-0 bg-blue-500 text-[9px] text-center font-bold">TOI</div>}</div>
          <span className="font-black text-xl text-white drop-shadow-md">{player.username}</span>
        </div>
        <div className="flex flex-col items-end"><span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Gains Totaux</span><span className={`text-2xl font-black ${isWinner ? 'text-emerald-400' : 'text-yellow-400'}`}>CC {totalValue}</span></div>
      </div>
      <div className="w-full h-32 mb-6 flex flex-col items-center justify-center bg-dark-900 border border-white/5 rounded-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_0%,transparent_35%,rgba(255,255,255,0.11)_50%,transparent_65%,transparent_100%)] opacity-60 animate-[battleshine_1.8s_linear_infinite]" />
        {!isStarting && !skinResult && (!currentRound || currentRound.state !== 'rolling') && <div className="text-6xl animate-pulse">Case</div>}
        {currentRound && currentRound.state === 'rolling' && <div className="absolute inset-0 flex flex-col items-center justify-center w-full"><div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-dark-900 to-transparent z-[11]" /><div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-dark-900 to-transparent z-[11]" /><div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-yellow-400 z-10 shadow-[0_0_18px_rgba(245,166,35,0.95)] animate-pulse" /><div className="relative w-full h-[88px] overflow-hidden"><div ref={stripRef} className="absolute inset-y-0 left-0 flex gap-2 w-max" /></div></div>}
        {skinResult && <div className="absolute inset-0 bg-dark-900 flex items-center justify-center animate-[battlereveal_0.34s_ease-out]"><div className="w-full h-full flex items-center justify-between px-6" style={{ background: `linear-gradient(to right, ${skinResult.rarity_color}22, transparent)` }}><div className="flex items-center gap-4"><img src={skinResult.skin_image} alt={skinResult.skin_name} className={`w-24 h-20 object-contain drop-shadow-xl ${isLegendaryItem(skinResult) ? 'animate-[battlelegend_0.7s_ease-out]' : 'animate-[battlestd_0.45s_ease-out]'}`} style={{ filter: `drop-shadow(0 0 10px ${skinResult.rarity_color}66)` }} /><div className="flex flex-col"><span className="font-black text-sm" style={{ color: skinResult.rarity_color }}>{skinResult.skin_name}</span><span className="text-[10px] font-bold opacity-70" style={{ color: skinResult.rarity_color }}>{skinResult.rarity}</span></div></div><div className="text-xl font-black text-yellow-500 bg-dark-800 px-3 py-2 rounded-xl whitespace-nowrap">CC {skinResult.sell_value}</div></div></div>}
      </div>
      <div className="w-full mt-auto">
        <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase">Historique des drops</h4>
        <div className="grid grid-cols-5 gap-2 w-full max-h-40 overflow-y-auto no-scrollbar">
          {history.map((h, i) => <div key={i} className="aspect-square bg-dark-900 border rounded-lg flex items-center justify-center p-1 relative group hover:scale-110 transition-transform cursor-default" style={{ borderColor: `${h.rarity_color}66` }}>{h.skin_image ? <img src={h.skin_image} alt={h.skin_name} className="w-full h-full object-contain mix-blend-screen" /> : <div className="text-xs">?</div>}<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col bg-dark-800 border border-white/20 p-2 rounded-lg z-50 whitespace-nowrap shadow-xl items-center pointer-events-none"><span className="text-xs font-bold" style={{ color: h.rarity_color }}>{h.skin_name}</span><span className="text-yellow-400 font-bold text-[10px]">CC {h.value || h.sell_value}</span></div></div>)}
          {(!history || history.length === 0) && <div className="col-span-5 text-center text-xs text-gray-600 py-4 italic">Aucun drop</div>}
        </div>
      </div>
      <style>{`@keyframes battleshine{from{transform:translateX(-120%)}to{transform:translateX(120%)}}@keyframes battlereveal{0%{opacity:0;transform:scale(.98)}65%{opacity:1;transform:scale(1.01)}100%{opacity:1;transform:scale(1)}}@keyframes battlelegend{0%{transform:scale(.88) rotate(-3deg);filter:brightness(1.15)}60%{transform:scale(1.08) rotate(1deg);filter:brightness(1.35)}100%{transform:scale(1) rotate(0);filter:brightness(1)}}@keyframes battlestd{0%{transform:scale(.94)}60%{transform:scale(1.04)}100%{transform:scale(1)}}`}</style>
    </div>
  );
}
