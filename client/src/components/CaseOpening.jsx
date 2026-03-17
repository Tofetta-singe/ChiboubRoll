import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchCases, openCase, sellSkin } from '../lib/api';

export default function CaseOpening({ isOpen, onClose }) {
  const { token, user, updateUserData } = useAuth();
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const stripRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchCases().then(data => setCases(data.cases || [])).catch(console.error);
    }
  }, [isOpen]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleOpen = async (caseData) => {
    if (opening) return;
    if (!user || user.coins < caseData.price) {
      showToast('Pas assez de Chiboub Coins!', 'error');
      return;
    }

    setSelectedCase(caseData);
    setOpening(true);
    setResult(null);

    try {
      const data = await openCase(token, caseData.id);
      updateUserData({ coins: data.coins });

      // Animate the strip before showing result
      await animateStrip(data.item, caseData);

      setResult(data.item);
    } catch (err) {
      showToast(err.message, 'error');
      setSelectedCase(null);
    } finally {
      setOpening(false);
    }
  };

  const animateStrip = (winItem, caseData) => {
    return new Promise((resolve) => {
      const strip = stripRef.current;
      if (!strip) { resolve(); return; }

      // Build fake items for the rolling strip
      const rarityColors = {};
      caseData.drops.forEach(d => { rarityColors[d.rarity] = d.color; });

      const items = [];
      for (let i = 0; i < 40; i++) {
        const rarityPool = caseData.drops;
        const pick = rarityPool[Math.floor(Math.random() * rarityPool.length)];
        items.push({
          rarity: pick.rarity,
          color: pick.color || '#555',
          fake: true,
        });
      }
      // Place the winning item at position 35 (near the end)
      items[35] = {
        rarity: winItem.rarity,
        color: winItem.rarity_color || '#fff',
        name: winItem.skin_name,
        image: winItem.skin_image,
        fake: false,
      };

      // Render strip
      strip.innerHTML = '';
      items.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'case-strip-item';
        div.style.borderColor = item.color;
        if (item.image && !item.fake) {
          div.innerHTML = `<img src="${item.image}" alt="" style="width:60px;height:45px;object-fit:contain;" /><span style="font-size:10px;color:${item.color}">${item.rarity}</span>`;
        } else {
          div.innerHTML = `<div style="width:60px;height:45px;background:${item.color}22;border-radius:6px;display:flex;align-items:center;justify-content:center"><span style="font-size:10px;color:${item.color}">${item.rarity}</span></div>`;
        }
        strip.appendChild(div);
      });

      // The winning item is at index 35, each item is 100px wide
      // We want item 35 centered → offset = 35*100 - container_width/2 + 50
      const containerWidth = strip.parentElement?.clientWidth || 380;
      const targetOffset = 35 * 100 - containerWidth / 2 + 50;

      strip.style.transition = 'none';
      strip.style.transform = 'translateX(0)';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          strip.style.transition = 'transform 3.5s cubic-bezier(0.15, 0.85, 0.35, 1)';
          strip.style.transform = `translateX(-${targetOffset}px)`;
        });
      });

      setTimeout(resolve, 3800);
    });
  };

  const handleSell = async (item) => {
    try {
      const data = await sellSkin(token, item.id);
      updateUserData({ coins: data.coins });
      showToast(`+${data.soldValue} CC 🪙`, 'success');
      setResult(null);
      setSelectedCase(null);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleKeep = () => {
    showToast('Skin ajouté à l\'inventaire! 🎒', 'success');
    setResult(null);
    setSelectedCase(null);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Panel */}
      <aside className="fixed top-0 right-0 w-[520px] max-w-full h-full bg-dark-900/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
            📦 Ouvrir des Caisses
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Opening Animation */}
          {(opening || result) && selectedCase && (
            <div className="glass rounded-2xl p-4 border border-white/10">
              <h3 className="text-center text-sm font-bold text-gray-400 mb-3">
                {opening ? '🎰 Ouverture en cours...' : '🎉 Résultat!'}
              </h3>

              {/* Strip container */}
              <div className="relative overflow-hidden rounded-xl bg-dark-800 h-24 mb-4">
                {/* Center indicator */}
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-yellow-400 z-10 shadow-[0_0_10px_rgba(245,166,35,0.6)]" />
                <div className="relative h-full" style={{ overflow: 'hidden' }}>
                  <div ref={stripRef} className="flex items-center h-full gap-1 absolute top-0 left-0" />
                </div>
              </div>

              {/* Result display */}
              {result && (
                <div className="flex flex-col items-center gap-3 animate-pop">
                  <div
                    className="p-3 rounded-xl border-2 bg-dark-800"
                    style={{ borderColor: result.rarity_color }}
                  >
                    {result.skin_image && (
                      <img
                        src={result.skin_image}
                        alt={result.skin_name}
                        className="w-32 h-24 object-contain mx-auto mb-2"
                      />
                    )}
                    <p className="text-sm font-bold text-center" style={{ color: result.rarity_color }}>
                      {result.skin_name}
                    </p>
                    <p className="text-xs text-center font-semibold" style={{ color: result.rarity_color + 'aa' }}>
                      {result.rarity}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">Valeur:</span>
                    <span className="text-yellow-400 font-bold">🪙 {result.sell_value} CC</span>
                  </div>

                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => handleSell(result)}
                      className="flex-1 bg-gradient-to-br from-yellow-500 to-amber-600 text-dark-900 font-bold py-2.5 rounded-xl text-sm hover:-translate-y-0.5 hover:shadow-[0_4px_15px_rgba(245,166,35,0.3)] transition-all"
                    >
                      💰 Vendre ({result.sell_value} CC)
                    </button>
                    <button
                      onClick={handleKeep}
                      className="flex-1 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white font-bold py-2.5 rounded-xl text-sm hover:-translate-y-0.5 hover:shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all"
                    >
                      🎒 Garder
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Case list */}
          {!opening && !result && (
            <div className="space-y-3">
              {cases.map((c) => {
                const canAfford = user && user.coins >= c.price;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleOpen(c)}
                    disabled={!canAfford}
                    className={`w-full p-4 rounded-2xl border transition-all duration-200 text-left ${
                      canAfford
                        ? 'border-white/10 hover:border-white/30 hover:-translate-x-1 hover:shadow-[4px_0_20px_rgba(0,0,0,0.2)] cursor-pointer bg-white/[0.03]'
                        : 'border-white/5 opacity-40 cursor-not-allowed bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="text-3xl w-14 h-14 flex items-center justify-center rounded-xl"
                        style={{ background: c.color + '22', border: `2px solid ${c.color}44` }}
                      >
                        {c.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-sm" style={{ color: c.color }}>
                          {c.name}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.drops.map((d) => (
                            <span
                              key={d.rarity}
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                              style={{ background: d.color + '22', color: d.color, border: `1px solid ${d.color}33` }}
                            >
                              {d.rarity} ({d.chance}%)
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-yellow-400 text-sm shrink-0">
                        🪙 {c.price}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-xl font-semibold text-sm backdrop-blur-xl border shadow-lg animate-slide-in
          ${toast.type === 'success' ? 'border-emerald-500/50 text-emerald-400 bg-dark-900/90' : 'border-red-500/50 text-red-400 bg-dark-900/90'}`}>
          {toast.msg}
        </div>
      )}

      <style>{`
        .case-strip-item {
          min-width: 96px;
          max-width: 96px;
          height: 76px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 2px solid #555;
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          flex-shrink: 0;
          gap: 2px;
        }
      `}</style>
    </>
  );
}
