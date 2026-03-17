import { useEffect, useState } from 'react';

export default function LiveDropFeed({ socket, onInviteTrade }) {
  const [drops, setDrops] = useState([]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleInit = ({ drops: nextDrops }) => setDrops(nextDrops || []);
    const handleDrop = (drop) => setDrops((prev) => [drop, ...prev].slice(0, 40));

    socket.on('global:drops_init', handleInit);
    socket.on('global:drop', handleDrop);
    return () => {
      socket.off('global:drops_init', handleInit);
      socket.off('global:drop', handleDrop);
    };
  }, [socket]);

  return (
    <aside className="fixed left-4 top-28 bottom-4 w-[300px] z-[90] max-[1100px]:hidden">
      <div className="h-full rounded-3xl border border-white/10 bg-dark-900/75 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-xs uppercase tracking-[0.35em] text-cyan-300/70 font-black">Live Feed</div>
          <div className="text-lg font-black text-white">Toutes les ouvertures</div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {drops.length === 0 && (
            <div className="text-sm text-gray-500 p-4 text-center">Les ouvertures apparaitront ici.</div>
          )}

          {drops.map((drop) => (
            <div key={drop.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-dark-800 border border-white/10 shrink-0">
                  {drop.avatar ? <img src={drop.avatar} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <button onClick={() => onInviteTrade?.(drop.userId)} className="text-left min-w-0 flex-1">
                  <div className="text-sm font-bold text-white truncate">{drop.username}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-[0.25em] truncate">{drop.caseName}</div>
                </button>
              </div>

              <div className="mt-3 rounded-xl p-3 border border-white/8 bg-dark-950/70 flex items-center gap-3">
                <div className="w-16 h-12 rounded-lg bg-black/20 flex items-center justify-center shrink-0 overflow-hidden">
                  {drop.skinImage ? <img src={drop.skinImage} alt={drop.skin} className="max-w-[58px] max-h-[36px] object-contain" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black truncate" style={{ color: drop.rarityColor }}>{drop.skin}</div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400 gap-2">
                    <span className="truncate">{drop.rarity}</span>
                    <span className="shrink-0">{drop.wearShort} {Number(drop.floatValue).toFixed(4)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
