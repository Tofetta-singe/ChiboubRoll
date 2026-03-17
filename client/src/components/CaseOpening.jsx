import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchCases, openCase, sellManySkins, sellSkin } from '../lib/api';

const STRIP_ITEM_WIDTH = 124;
const STRIP_GAP = 10;
const WINNING_INDEX = 35;
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

export default function CaseOpening({ isOpen, onClose }) {
  const { token, user, updateUserData } = useAuth();
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [amount, setAmount] = useState(1);
  const [opening, setOpening] = useState(false);
  const [results, setResults] = useState([]);
  const [revealedItemIds, setRevealedItemIds] = useState([]);
  const [toast, setToast] = useState(null);
  const [sellingIds, setSellingIds] = useState([]);
  const [sellingAll, setSellingAll] = useState(false);
  const [sfxVolume, setSfxVolume] = useState(DEFAULT_SFX_VOLUME);
  const stripRefs = useRef([]);
  const scrollAudioRef = useRef(null);
  const basicRevealAudioRef = useRef(null);
  const legendaryRevealAudioRef = useRef(null);
  const revealTimeoutsRef = useRef([]);
  const scrollRateTimerRef = useRef(null);

  useEffect(() => {
    setSfxVolume(readStoredVolume());
  }, []);

  useEffect(() => {
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
    return () => stopAllAudio();
  }, []);

  useEffect(() => {
    const syncVolume = (event) => {
      if (event?.detail?.sfxVolume !== undefined) {
        setSfxVolume(Math.min(1, Math.max(0, Number(event.detail.sfxVolume) || 0)));
      } else {
        setSfxVolume(readStoredVolume());
      }
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
    if (!isOpen) stopAllAudio();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetchCases()
      .then((data) => setCases([...(data.cases || [])].sort((a, b) => a.price - b.price)))
      .catch((error) => showToast(error.message, 'error'));
  }, [isOpen]);

  const applyAudioVolumes = (volume) => {
    if (scrollAudioRef.current) scrollAudioRef.current.volume = volume * 0.32;
    if (basicRevealAudioRef.current) basicRevealAudioRef.current.volume = volume * 0.48;
    if (legendaryRevealAudioRef.current) legendaryRevealAudioRef.current.volume = volume * 0.58;
  };

  const clearRevealTimeouts = () => {
    revealTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    revealTimeoutsRef.current = [];
  };

  const clearScrollRateTimer = () => {
    if (scrollRateTimerRef.current) {
      clearInterval(scrollRateTimerRef.current);
      scrollRateTimerRef.current = null;
    }
  };

  const stopAllAudio = () => {
    clearRevealTimeouts();
    clearScrollRateTimer();
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
    audio.playbackRate = 2.45;
    clearScrollRateTimer();
    const startTime = Date.now();
    scrollRateTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - progress) * (1 - progress);
      audio.playbackRate = 2.45 - eased * 1.75;
      if (progress >= 1) {
        audio.playbackRate = 0.7;
        clearScrollRateTimer();
      }
    }, 60);
    try {
      await audio.play();
    } catch {}
  };

  const playRevealBurst = (items) => {
    clearRevealTimeouts();
    const highest = [...items].map((entry) => entry.item).sort((a, b) => Number(isLegendaryItem(b)) - Number(isLegendaryItem(a)))[0];
    const timeout = setTimeout(() => {
      const source = isLegendaryItem(highest) ? legendaryRevealAudioRef.current : basicRevealAudioRef.current;
      if (!source) return;
      const nextSound = source.cloneNode();
      nextSound.volume = source.volume;
      nextSound.play().catch(() => {});
    }, 100);
    revealTimeoutsRef.current.push(timeout);
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const resetOpeningState = () => {
    setResults([]);
    setRevealedItemIds([]);
    setSelectedCase(null);
    setSellingIds([]);
    setSellingAll(false);
    stopAllAudio();
  };

  const handleClose = () => {
    stopAllAudio();
    onClose?.();
  };

  const handleOpen = async (caseData) => {
    if (opening || sellingAll) return;
    const nextAmount = caseData.price === 0 ? 1 : amount;
    if ((user?.coins || 0) < caseData.price * nextAmount) {
      showToast('Pas assez de Chiboub Coins!', 'error');
      return;
    }

    stopAllAudio();
    setSelectedCase(caseData);
    setOpening(true);
    setResults([]);
    setRevealedItemIds([]);
    setSellingIds([]);

    try {
      const data = await openCase(token, caseData.id, nextAmount);
      updateUserData({ coins: data.coins });
      setResults(data.items || []);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await animateStrips(data.items || []);
      playRevealBurst(data.items || []);
    } catch (error) {
      showToast(error.message, 'error');
      setSelectedCase(null);
      stopAllAudio();
    } finally {
      setOpening(false);
    }
  };

  const animateStrips = async (items) => {
    const maxDuration = 3900 + Math.max(0, items.length - 1) * 150;
    await playScrollLoop(maxDuration);
    await Promise.all(items.map((entry, index) => new Promise((resolve) => {
      const strip = stripRefs.current[index];
      if (!strip) return resolve();
      strip.innerHTML = '';
      const paddedStrip = [...entry.strip, ...entry.strip.slice(0, 12)];
      paddedStrip.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'case-strip-item';
        div.style.borderColor = item.rarity_color;
        div.innerHTML = `
          <div style="width:100%;height:58px;display:flex;align-items:center;justify-content:center;padding:0 4px;overflow:hidden;">
            ${item.skin_image ? `<img src="${item.skin_image}" alt="" style="max-width:98px;max-height:54px;object-fit:contain;filter:drop-shadow(0 6px 12px rgba(0,0,0,0.48));transform:scale(1.06);" />` : `<div style="width:80px;height:34px;border-radius:8px;background:${item.rarity_color}22;"></div>`}
          </div>
          <div style="font-size:8px;font-weight:800;color:${item.rarity_color};text-align:center;padding:0 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%">${item.skin_name}</div>
          <div style="font-size:7px;color:#cbd5e1">${item.wear_short} ${Number(item.float_value).toFixed(4)}</div>`;
        strip.appendChild(div);
      });
      const containerWidth = strip.parentElement?.clientWidth || 900;
      const targetOffset = WINNING_INDEX * (STRIP_ITEM_WIDTH + STRIP_GAP) - containerWidth / 2 + STRIP_ITEM_WIDTH / 2;
      strip.style.transition = 'none';
      strip.style.transform = 'translateX(0)';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          strip.style.transition = `transform ${3.5 + index * 0.15}s cubic-bezier(0.15, 0.85, 0.35, 1)`;
          strip.style.transform = `translateX(-${targetOffset}px)`;
        });
      });
      setTimeout(() => {
        setRevealedItemIds((prev) => (prev.includes(entry.item.id) ? prev : [...prev, entry.item.id]));
        resolve();
      }, 3900 + index * 150);
    })));

    if (scrollAudioRef.current) {
      scrollAudioRef.current.pause();
      scrollAudioRef.current.currentTime = 0;
      scrollAudioRef.current.playbackRate = 1;
    }
    clearScrollRateTimer();
  };

  const handleSell = async (item) => {
    if (sellingIds.includes(item.id) || sellingAll) return;
    setSellingIds((prev) => [...prev, item.id]);
    try {
      const data = await sellSkin(token, item.id);
      updateUserData({ coins: data.coins });
      const nextResults = results.filter((entry) => entry.item.id !== item.id);
      setResults(nextResults);
      setRevealedItemIds((prev) => prev.filter((id) => id !== item.id));
      showToast(`Skin vendue: +${data.soldValue} CC`, 'success');
      if (nextResults.length === 0) setTimeout(() => resetOpeningState(), 250);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSellingIds((prev) => prev.filter((id) => id !== item.id));
    }
  };

  const handleSellAll = async () => {
    const itemIds = results.map((entry) => entry.item.id);
    if (itemIds.length === 0 || sellingAll) return;
    setSellingAll(true);
    try {
      const data = await sellManySkins(token, itemIds);
      updateUserData({ coins: data.coins });
      showToast(`${data.soldItemIds.length} skins vendus: +${data.soldValue} CC`, 'success');
      resetOpeningState();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSellingAll(false);
    }
  };

  if (!isOpen) return null;

  const accent = selectedCase?.color || '#f97316';
  const totalPrice = selectedCase ? selectedCase.price * (selectedCase.price === 0 ? 1 : amount) : 0;
  const gridClass = results.length <= 2 ? 'grid-cols-1' : results.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 max-[1400px]:grid-cols-1';

  return (
    <>
      <div className="fixed inset-0 bg-black/80 z-40" onClick={handleClose} />
      <div className="fixed inset-0 z-50 p-4">
        <div className="case-shell relative w-full h-full overflow-hidden rounded-[36px] border border-white/10 shadow-2xl">
          <div className="absolute inset-0 case-shell-backdrop pointer-events-none" />

          <div className="relative h-full flex flex-col">
            <div className="flex items-center justify-between px-7 py-6 border-b border-white/10 shrink-0">
              <div>
                <div className="text-[11px] uppercase tracking-[0.45em] text-orange-300/70 font-black">Case Room</div>
                <h2 className="mt-2 text-4xl font-black text-white">Ouverture de caisses</h2>
                <p className="mt-2 text-sm text-slate-400">Une interface plus premium, plus lisible et plus theatrale.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden min-[950px]:flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500 font-black">Coins</div>
                    <div className="mt-1 text-lg font-black text-yellow-300">{user?.coins || 0} CC</div>
                  </div>
                </div>
                <button onClick={handleClose} className="w-11 h-11 rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all">✕</button>
              </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-[360px_1fr] max-[1180px]:grid-cols-1">
              <aside className="border-r border-white/10 p-5 overflow-y-auto max-[1180px]:border-r-0 max-[1180px]:border-b">
                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-slate-500 font-black">Multiplicateur</div>
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((qty) => (
                      <button key={qty} onClick={() => setAmount(qty)} className={`rounded-2xl py-3 text-sm font-black transition-all ${amount === qty ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-[0_12px_30px_rgba(249,115,22,0.35)] -translate-y-0.5' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                        {qty}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.35em] text-slate-500 font-black">Catalogue</div>
                      <div className="mt-1 text-sm text-slate-400">Trie du moins cher au plus cher</div>
                    </div>
                    <div className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-black text-slate-300">{cases.length} caisses</div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {cases.map((caseData) => {
                      const price = caseData.price * (caseData.price === 0 ? 1 : amount);
                      const active = selectedCase?.id === caseData.id;
                      return (
                        <button key={caseData.id} onClick={() => handleOpen(caseData)} className={`group w-full overflow-hidden rounded-[24px] border p-4 text-left transition-all ${active ? 'border-white/20 bg-white/[0.08] shadow-[0_18px_45px_rgba(0,0,0,0.25)]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15'}`}>
                          <div className="flex items-center gap-4">
                            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shrink-0" style={{ background: `radial-gradient(circle at 30% 30%, ${caseData.color}55, ${caseData.color}12 70%, transparent 100%)` }}>
                              <span className="relative z-10 drop-shadow-[0_0_12px_rgba(255,255,255,0.18)]">{caseData.icon}</span>
                              <div className="absolute inset-1 rounded-2xl border border-white/10" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-black truncate" style={{ color: caseData.color }}>{caseData.name}</div>
                                  <div className="mt-1 text-[11px] text-slate-500">{caseData.price === 0 ? 'Ouverture gratuite' : `${amount > 1 ? `${amount} ouvertures` : '1 ouverture'}`}</div>
                                </div>
                                <div className="rounded-full bg-black/20 px-3 py-1 text-xs font-black text-yellow-300 shrink-0">{price} CC</div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {caseData.drops.slice(0, 5).map((drop) => (
                                  <span key={drop.rarity} className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: `${drop.color}18`, color: drop.color }}>{drop.rarity}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>

              <section className="p-5 min-h-0 overflow-hidden flex flex-col">
                <div className="rounded-[30px] border border-white/10 p-5 shrink-0 overflow-hidden relative" style={{ background: `linear-gradient(135deg, ${accent}20 0%, rgba(15,23,42,0.72) 36%, rgba(2,6,23,0.92) 100%)` }}>
                  <div className="absolute inset-0 pointer-events-none case-hero-noise" />
                  <div className="relative flex items-center justify-between gap-6 max-[900px]:flex-col max-[900px]:items-start">
                    <div className="flex items-center gap-5">
                      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px] text-4xl" style={{ background: `radial-gradient(circle at 30% 30%, ${accent}66, ${accent}18 70%, transparent 100%)` }}>
                        <span className="drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{selectedCase?.icon || '🎁'}</span>
                        <div className="absolute inset-2 rounded-[22px] border border-white/10" />
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.35em] text-slate-400 font-black">En cours</div>
                        <div className="mt-2 text-3xl font-black text-white">{selectedCase?.name || 'Choisis une caisse'}</div>
                        <div className="mt-2 text-sm text-slate-400">{selectedCase ? `${amount} ouverture${amount > 1 ? 's' : ''} prete${amount > 1 ? 's' : ''}` : 'Selectionne une caisse a gauche pour commencer'}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 min-[900px]:min-w-[320px] max-[520px]:grid-cols-1">
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-black">Total</div>
                        <div className="mt-2 text-2xl font-black text-yellow-300">{selectedCase ? `${totalPrice} CC` : '--'}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-black">Etat</div>
                        <div className="mt-2 text-sm font-black text-white">{opening ? 'Ouverture en cours' : results.length > 0 ? 'Drops disponibles' : 'En attente'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {(opening || results.length > 0) ? (
                  <div className="mt-4 flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3 flex items-center justify-between shrink-0">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500 font-black">Session</div>
                        <div className="mt-1 text-sm text-slate-200">{opening ? 'Le reveal tourne. Attends la fin du spin.' : sellingAll ? 'Vente groupee en cours...' : `${results.length} skin${results.length > 1 ? 's' : ''} a gerer`}</div>
                      </div>
                      {results.length > 1 && <button onClick={handleSellAll} disabled={sellingAll || opening} className="rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-500 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_14px_30px_rgba(250,204,21,0.25)] disabled:opacity-50">{sellingAll ? 'Vente...' : `Vendre les ${results.length}`}</button>}
                    </div>

                    <div className={`grid ${gridClass} gap-4 min-h-0 overflow-hidden auto-rows-fr`}>
                      {results.map((entry, index) => {
                        const isSelling = sellingIds.includes(entry.item.id);
                        const isRevealed = revealedItemIds.includes(entry.item.id);
                        return (
                          <article key={entry.item.id} className={`case-result-card rounded-[28px] border p-4 transition-all flex flex-col min-h-0 ${isRevealed ? 'border-white/15 bg-white/[0.07] shadow-[0_20px_60px_rgba(0,0,0,0.22)]' : 'border-white/10 bg-white/[0.04]'} ${isSelling ? 'opacity-60' : ''}`}>
                            <div className="relative overflow-hidden rounded-[22px] bg-slate-950 h-32 mb-4 case-strip-shell shrink-0">
                              <div className="absolute inset-0 case-stage-glow" />
                              <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-slate-950 via-slate-950/92 to-transparent z-[11]" />
                              <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-slate-950 via-slate-950/92 to-transparent z-[11]" />
                              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-yellow-400 z-10 case-center-beam" />
                              <div className="absolute inset-0 case-strip-shine pointer-events-none z-[9]" />
                              <div className="relative h-full overflow-hidden">
                                <div ref={(el) => { stripRefs.current[index] = el; }} className="flex items-center h-full gap-[10px] absolute top-0 left-0" />
                              </div>
                            </div>

                            <div className={`flex items-center justify-between gap-4 rounded-[22px] border p-4 flex-1 min-h-0 transition-all ${isRevealed ? 'border-white/12 bg-black/24 shadow-[0_0_35px_rgba(250,204,21,0.08)]' : 'border-white/8 bg-black/20'}`}>
                              <div className="flex items-center gap-4 min-w-0">
                                <div className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-2xl border ${isRevealed ? 'border-white/10 bg-white/[0.04]' : 'border-white/5 bg-white/[0.03]'}`}>
                                  <div className="absolute inset-0 case-thumb-shine" />
                                  {isRevealed && entry.item.skin_image ? <img src={entry.item.skin_image} alt={entry.item.skin_name} className="relative z-10 h-full w-full object-contain p-2" /> : <div className="absolute inset-0 flex items-center justify-center"><div className="h-8 w-14 rounded-xl bg-white/10 animate-pulse" /></div>}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 font-black">Resultat</div>
                                  <div className="mt-2 text-base font-black truncate" style={{ color: isRevealed ? entry.item.rarity_color : '#e2e8f0' }}>{isRevealed ? entry.item.skin_name : 'Skin en reveal...'}</div>
                                  <div className="mt-1 text-xs text-slate-400">{isRevealed ? `${entry.item.rarity} • ${entry.item.wear_short} • ${Number(entry.item.float_value).toFixed(4)}` : 'Le drop reste cache jusqu a la fin du spin'}</div>
                                  {isRevealed && <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${isLegendaryItem(entry.item) ? 'bg-amber-400/15 text-amber-300' : 'bg-cyan-400/15 text-cyan-300'}`}>{isLegendaryItem(entry.item) ? 'Drop rare' : 'Drop standard'}</div>}
                                  {isSelling && <div className="mt-2 text-[11px] font-bold text-amber-300">Vente en cours...</div>}
                                </div>
                              </div>
                              <div className="shrink-0 flex flex-col items-end gap-3">
                                <div className={`text-lg font-black ${isRevealed ? 'text-yellow-300' : 'text-slate-500'}`}>{isRevealed ? `${entry.item.sell_value} CC` : '???'}</div>
                                <button onClick={() => handleSell(entry.item)} disabled={isSelling || sellingAll || opening || !isRevealed} className="rounded-2xl bg-gradient-to-r from-yellow-300 to-amber-500 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_14px_26px_rgba(251,191,36,0.22)] disabled:opacity-50">{isSelling ? 'Vente...' : 'Vendre'}</button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex-1 min-h-0 rounded-[30px] border border-dashed border-white/10 bg-white/[0.03] overflow-hidden relative">
                    <div className="absolute inset-0 case-empty-grid opacity-70" />
                    <div className="relative h-full flex items-center justify-center p-10">
                      <div className="max-w-[560px] text-center">
                        <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.04] text-5xl shadow-[0_25px_70px_rgba(0,0,0,0.25)]">{selectedCase?.icon || '🎁'}</div>
                        <div className="text-[11px] uppercase tracking-[0.38em] text-slate-500 font-black">Ready To Open</div>
                        <h3 className="mt-3 text-3xl font-black text-white">Choisis une caisse et lance le spin</h3>
                        <p className="mt-3 text-sm text-slate-400">Une meilleure hierarchie visuelle, un hero panel plus fort et des cartes de drops plus premium.</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      {toast && <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-2xl font-semibold text-sm backdrop-blur-xl border shadow-lg ${toast.type === 'success' ? 'border-emerald-500/50 text-emerald-300 bg-slate-950/92' : 'border-red-500/50 text-red-300 bg-slate-950/92'}`}>{toast.msg}</div>}

      <style>{`
        .case-shell {
          background:
            radial-gradient(circle at top left, rgba(249, 115, 22, 0.12), transparent 28%),
            radial-gradient(circle at top right, rgba(251, 191, 36, 0.1), transparent 22%),
            linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(2, 6, 23, 0.98) 100%);
          backdrop-filter: blur(28px);
        }
        .case-shell-backdrop {
          background:
            linear-gradient(90deg, rgba(255,255,255,0.03) 0%, transparent 20%, transparent 80%, rgba(255,255,255,0.02) 100%),
            radial-gradient(circle at 20% 20%, rgba(255,255,255,0.05), transparent 28%);
        }
        .case-hero-noise {
          background:
            linear-gradient(120deg, rgba(255,255,255,0.04), transparent 18%, transparent 82%, rgba(255,255,255,0.03)),
            radial-gradient(circle at 10% 20%, rgba(255,255,255,0.06), transparent 18%);
        }
        .case-empty-grid {
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(circle at center, black 40%, transparent 90%);
        }
        .case-strip-item {
          min-width: ${STRIP_ITEM_WIDTH}px;
          max-width: ${STRIP_ITEM_WIDTH}px;
          height: 94px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding-top: 6px;
          border: 2px solid #555;
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), rgba(255,255,255,0.04);
          flex-shrink: 0;
          gap: 3px;
          overflow: hidden;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .case-strip-shell::after {
          content: '';
          position: absolute;
          inset: 10px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: inset 0 0 35px rgba(255,255,255,0.04);
          pointer-events: none;
        }
        .case-stage-glow {
          background: radial-gradient(circle at center, rgba(251, 191, 36, 0.12), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 28%);
        }
        .case-center-beam {
          box-shadow: 0 0 20px rgba(250, 204, 21, 0.95);
          animation: case-beam-pulse 0.8s ease-in-out infinite alternate;
        }
        .case-strip-shine {
          background: linear-gradient(105deg, transparent 0%, transparent 38%, rgba(255,255,255,0.13) 50%, transparent 62%, transparent 100%);
          transform: translateX(-120%);
          animation: case-shine 1.7s linear infinite;
          opacity: 0.7;
        }
        .case-thumb-shine {
          background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.09) 50%, transparent 100%);
          transform: translateX(-120%);
          animation: case-thumb-shine 2.1s linear infinite;
        }
        .case-result-card { animation: case-card-enter 0.45s ease-out; }
        .case-reveal-card { animation: case-card-reveal 0.38s ease-out; }
        @keyframes case-beam-pulse {
          from { opacity: 0.68; transform: translateX(-50%) scaleY(0.94); }
          to { opacity: 1; transform: translateX(-50%) scaleY(1.05); }
        }
        @keyframes case-shine {
          from { transform: translateX(-120%); }
          to { transform: translateX(120%); }
        }
        @keyframes case-thumb-shine {
          from { transform: translateX(-120%); }
          to { transform: translateX(140%); }
        }
        @keyframes case-card-enter {
          0% { opacity: 0; transform: translateY(12px) scale(0.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes case-card-reveal {
          0% { transform: translateY(8px) scale(0.985); opacity: 0.72; }
          55% { transform: translateY(0) scale(1.012); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
