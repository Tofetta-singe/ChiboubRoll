import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchCases, openCase, sellManySkins, sellSkin } from '../lib/api';

const STRIP_ITEM_WIDTH = 108;
const STRIP_GAP = 10;

export default function CaseOpening({ isOpen, onClose }) {
  const { token, user, updateUserData } = useAuth();
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [amount, setAmount] = useState(1);
  const [opening, setOpening] = useState(false);
  const [results, setResults] = useState([]);
  const [toast, setToast] = useState(null);
  const stripRefs = useRef([]);

  useEffect(() => {
    if (!isOpen) return;
    fetchCases()
      .then((data) => setCases(data.cases || []))
      .catch((error) => showToast(error.message, 'error'));
  }, [isOpen]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleOpen = async (caseData) => {
    if (opening) return;

    const nextAmount = caseData.price === 0 ? 1 : amount;
    if ((user?.coins || 0) < caseData.price * nextAmount) {
      showToast('Pas assez de Chiboub Coins!', 'error');
      return;
    }

    setSelectedCase(caseData);
    setOpening(true);
    setResults([]);

    try {
      const data = await openCase(token, caseData.id, nextAmount);
      updateUserData({ coins: data.coins });
      setResults(data.items || []);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await animateStrips(data.items || []);
    } catch (error) {
      showToast(error.message, 'error');
      setSelectedCase(null);
    } finally {
      setOpening(false);
    }
  };

  const animateStrips = async (items) => {
    await Promise.all(
      items.map((entry, index) => new Promise((resolve) => {
        const strip = stripRefs.current[index];
        if (!strip) return resolve();

        strip.innerHTML = '';
        entry.strip.forEach((item) => {
          const div = document.createElement('div');
          div.className = 'case-strip-item';
          div.style.borderColor = item.rarity_color;
          div.innerHTML = `
            <div style="width:100%;height:54px;display:flex;align-items:center;justify-content:center;padding:0 4px;overflow:hidden;">
              ${item.skin_image
                ? `<img src="${item.skin_image}" alt="" style="max-width:88px;max-height:46px;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.45));" />`
                : `<div style="width:72px;height:32px;border-radius:8px;background:${item.rarity_color}22;"></div>`}
            </div>
            <div style="font-size:9px;font-weight:800;color:${item.rarity_color};text-align:center;padding:0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%">
              ${item.skin_name}
            </div>
            <div style="font-size:8px;color:#cbd5e1">${item.wear_short} ${Number(item.float_value).toFixed(4)}</div>
          `;
          strip.appendChild(div);
        });

        const containerWidth = strip.parentElement?.clientWidth || 900;
        const targetOffset = 35 * (STRIP_ITEM_WIDTH + STRIP_GAP) - containerWidth / 2 + STRIP_ITEM_WIDTH / 2;
        strip.style.transition = 'none';
        strip.style.transform = 'translateX(0)';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            strip.style.transition = `transform ${3.5 + index * 0.15}s cubic-bezier(0.15, 0.85, 0.35, 1)`;
            strip.style.transform = `translateX(-${targetOffset}px)`;
          });
        });

        setTimeout(resolve, 3900 + index * 150);
      }))
    );
  };

  const handleSell = async (item) => {
    try {
      const data = await sellSkin(token, item.id);
      updateUserData({ coins: data.coins });
      setResults((prev) => prev.filter((entry) => entry.item.id !== item.id));
      showToast(`+${data.soldValue} CC`, 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleSellAll = async () => {
    const itemIds = results.map((entry) => entry.item.id);
    if (itemIds.length === 0) return;

    try {
      const data = await sellManySkins(token, itemIds);
      updateUserData({ coins: data.coins });
      setResults((prev) => prev.filter((entry) => !data.soldItemIds.includes(entry.item.id)));
      showToast(`+${data.soldValue} CC`, 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 p-6">
        <div className="w-full h-full rounded-[32px] bg-dark-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <h2 className="text-3xl font-black bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">Case Opening</h2>
              <p className="text-sm text-gray-500">Multi-ouverture jusqu a 5 caisses.</p>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full glass text-gray-400 hover:text-white">✕</button>
          </div>

          <div className="flex-1 overflow-hidden grid grid-cols-[360px_1fr] max-[1100px]:grid-cols-1">
            <div className="border-r border-white/10 p-5 overflow-y-auto max-[1100px]:border-r-0 max-[1100px]:border-b">
              <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((qty) => (
                  <button
                    key={qty}
                    onClick={() => setAmount(qty)}
                    className={`flex-1 rounded-xl py-2 text-sm font-bold ${amount === qty ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400'}`}
                  >
                    {qty}x
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {cases.map((caseData) => {
                  const price = caseData.price * (caseData.price === 0 ? 1 : amount);
                  return (
                    <button
                      key={caseData.id}
                      onClick={() => handleOpen(caseData)}
                      className="w-full p-4 rounded-2xl border border-white/10 bg-white/[0.03] text-left hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl" style={{ background: `${caseData.color}22` }}>
                          {caseData.icon}
                        </div>
                        <div className="flex-1">
                          <div className="font-black text-sm" style={{ color: caseData.color }}>{caseData.name}</div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {caseData.drops.map((drop) => (
                              <span key={drop.rarity} className="text-[10px] px-2 py-1 rounded-full font-bold" style={{ background: `${drop.color}22`, color: drop.color }}>
                                {drop.rarity}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-yellow-400 font-black">{price} CC</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              {selectedCase && (
                <div className="mb-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-gray-500 font-black">Selection</div>
                      <div className="text-2xl font-black text-white mt-1">{selectedCase.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="text-2xl font-black text-yellow-400">{selectedCase.price * (selectedCase.price === 0 ? 1 : amount)} CC</div>
                    </div>
                  </div>
                </div>
              )}

              {(opening || results.length > 0) ? (
                <div className="space-y-6">
                  {results.length > 1 && (
                    <div className="flex justify-end">
                      <button
                        onClick={handleSellAll}
                        className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-2 text-dark-900 font-black text-sm"
                      >
                        Vendre les {results.length} skins
                      </button>
                    </div>
                  )}

                  {results.map((entry, index) => (
                    <div key={entry.item.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="relative overflow-hidden rounded-2xl bg-dark-950 h-32 mb-4">
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-yellow-400 z-10" />
                        <div className="relative h-full overflow-hidden">
                          <div ref={(el) => { stripRefs.current[index] = el; }} className="flex items-center h-full gap-2 absolute top-0 left-0" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-dark-950/70 p-4 gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-24 h-16 rounded-xl bg-black/20 flex items-center justify-center shrink-0 overflow-hidden">
                            {entry.item.skin_image ? (
                              <img src={entry.item.skin_image} alt={entry.item.skin_name} className="max-w-[88px] max-h-[52px] object-contain" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-black truncate" style={{ color: entry.item.rarity_color }}>{entry.item.skin_name}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {entry.item.rarity} • {entry.item.wear_short} • {Number(entry.item.float_value).toFixed(4)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-yellow-400 font-black">{entry.item.sell_value} CC</div>
                          <button onClick={() => handleSell(entry.item)} className="rounded-xl bg-yellow-500 px-3 py-2 text-dark-900 font-black text-sm">Vendre</button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {!opening && results.length === 0 && (
                    <div className="text-sm text-gray-500">Ouverture terminee.</div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-lg">
                  Choisis une caisse pour lancer l ouverture.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-xl font-semibold text-sm backdrop-blur-xl border shadow-lg ${toast.type === 'success' ? 'border-emerald-500/50 text-emerald-400 bg-dark-900/90' : 'border-red-500/50 text-red-400 bg-dark-900/90'}`}>
          {toast.msg}
        </div>
      )}

      <style>{`
        .case-strip-item {
          min-width: ${STRIP_ITEM_WIDTH}px;
          max-width: ${STRIP_ITEM_WIDTH}px;
          height: 92px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding-top: 5px;
          border: 2px solid #555;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          flex-shrink: 0;
          gap: 2px;
          overflow: hidden;
        }
      `}</style>
    </>
  );
}
