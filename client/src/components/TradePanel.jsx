import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchInventory } from '../lib/api';

export default function TradePanel({ socket, invite, tradeRoom, onCloseInvite, onCloseTrade }) {
  const { token, user } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!tradeRoom || !token) return;
    fetchInventory(token)
      .then((data) => setInventory(data.inventory || []))
      .catch((error) => setToast(error.message));
  }, [tradeRoom, token]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const myOfferIds = useMemo(() => new Set((tradeRoom?.offers?.[user?.id] || []).map((item) => item.id)), [tradeRoom, user?.id]);
  const theirUser = tradeRoom?.users?.find((entry) => entry?.id !== user?.id);

  return (
    <>
      {invite && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50">
          <div className="w-[420px] rounded-3xl border border-white/10 bg-dark-900/95 p-6">
            <div className="text-xl font-black text-white">Invitation echange</div>
            <p className="text-sm text-gray-400 mt-2">{invite.username} veut trader avec toi.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => socket?.emit('trade:accept', { userId: invite.id })} className="flex-1 rounded-2xl bg-emerald-600 py-3 font-bold text-white">Accepter</button>
              <button onClick={() => { socket?.emit('trade:decline', { userId: invite.id }); onCloseInvite(); }} className="flex-1 rounded-2xl bg-white/10 py-3 font-bold text-white">Refuser</button>
            </div>
          </div>
        </div>
      )}

      {tradeRoom && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/70 p-4">
          <div className="w-[1100px] max-w-full h-[80vh] rounded-3xl border border-white/10 bg-dark-900/95 p-6 flex gap-6">
            <div className="flex-1 flex flex-col">
              <div className="text-xl font-black text-white">Trade Room</div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <TradeOffer title="Mon offre" items={tradeRoom.offers?.[user?.id] || []} />
                <TradeOffer title={theirUser?.username || 'Adversaire'} items={tradeRoom.offers?.[theirUser?.id] || []} />
              </div>

              <div className="mt-4 flex gap-3">
                <button onClick={() => socket?.emit('trade:ready', { roomId: tradeRoom.id })} className="rounded-2xl bg-cyan-600 px-4 py-3 font-bold text-white">
                  {tradeRoom.ready?.[user?.id] ? 'Annuler Ready' : 'Ready'}
                </button>
                <button onClick={() => socket?.emit('trade:confirm', { roomId: tradeRoom.id })} className="rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white">
                  Confirmer
                </button>
                <button onClick={onCloseTrade} className="rounded-2xl bg-white/10 px-4 py-3 font-bold text-white">Fermer</button>
              </div>
            </div>

            <div className="w-[360px] rounded-3xl border border-white/10 bg-dark-950/70 p-4 overflow-y-auto">
              <div className="text-sm font-black uppercase tracking-[0.25em] text-gray-500">Inventaire</div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {inventory.map((item) => {
                  const selected = myOfferIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => socket?.emit(selected ? 'trade:remove_item' : 'trade:add_item', { roomId: tradeRoom.id, inventoryId: item.id })}
                      className={`rounded-2xl border p-3 text-left ${selected ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 bg-white/[0.03]'}`}
                    >
                      <div className="text-xs font-black truncate" style={{ color: item.rarity_color }}>{item.skin_name}</div>
                      <div className="text-[11px] text-gray-500 mt-1">{item.wear_short} {Number(item.float_value).toFixed(4)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-xl font-semibold text-sm backdrop-blur-xl border border-red-500/50 text-red-400 bg-dark-900/90">
          {toast}
        </div>
      )}
    </>
  );
}

function TradeOffer({ title, items }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 min-h-[220px]">
      <div className="text-sm font-black uppercase tracking-[0.25em] text-gray-500">{title}</div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border p-3 border-white/10 bg-dark-950/60">
            <div className="text-xs font-black truncate" style={{ color: item.rarity_color }}>{item.skin_name}</div>
            <div className="text-[11px] text-gray-500 mt-1">{item.wear_short} {Number(item.float_value).toFixed(4)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
