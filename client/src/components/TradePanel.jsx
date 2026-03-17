import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchInventory } from '../lib/api';

export default function TradePanel({ socket, invite, tradeRoom, onCloseInvite, onCloseTrade }) {
  const { token, user } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!tradeRoom || !token) return;
    setLoadingInventory(true);
    fetchInventory(token)
      .then((data) => setInventory(data.inventory || []))
      .catch((error) => setToast(error.message))
      .finally(() => setLoadingInventory(false));
  }, [tradeRoom, token]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  const myOfferIds = useMemo(
    () => new Set((tradeRoom?.offers?.[user?.id] || []).map((item) => item.id)),
    [tradeRoom, user?.id]
  );

  const otherUser = tradeRoom?.users?.find((entry) => entry?.id !== user?.id) || null;
  const myReady = Boolean(user?.id && tradeRoom?.ready?.[user.id]);
  const otherReady = Boolean(otherUser?.id && tradeRoom?.ready?.[otherUser.id]);
  const myConfirmed = Boolean(user?.id && tradeRoom?.confirmed?.[user.id]);
  const otherConfirmed = Boolean(otherUser?.id && tradeRoom?.confirmed?.[otherUser.id]);
  const bothReady = myReady && otherReady;

  const toggleTradeItem = (inventoryId, selected) => {
    if (!socket || !tradeRoom?.id || myReady || myConfirmed) return;
    socket.emit(selected ? 'trade:remove_item' : 'trade:add_item', { roomId: tradeRoom.id, inventoryId });
  };

  const toggleReady = () => {
    if (!socket || !tradeRoom?.id || myConfirmed) return;
    socket.emit('trade:ready', { roomId: tradeRoom.id });
  };

  const confirmTrade = () => {
    if (!socket || !tradeRoom?.id || !bothReady || myConfirmed) return;
    socket.emit('trade:confirm', { roomId: tradeRoom.id });
  };

  return (
    <>
      {invite && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-[430px] rounded-[28px] border border-white/10 bg-dark-900/95 p-6 shadow-2xl">
            <div className="text-[11px] font-black uppercase tracking-[0.35em] text-cyan-400">Trade Invite</div>
            <h2 className="mt-2 text-2xl font-black text-white">Invitation d echange</h2>
            <p className="mt-3 text-sm text-gray-400">
              <span className="font-bold text-white">{invite.username}</span> veut ouvrir une room de trade avec toi.
            </p>

            <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              Accepte pour voir directement les statuts Pret et Confirme des deux joueurs.
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => socket?.emit('trade:accept', { userId: invite.id })}
                className="flex-1 rounded-2xl bg-emerald-600 py-3 font-black text-white"
              >
                Accepter
              </button>
              <button
                onClick={() => {
                  socket?.emit('trade:decline', { userId: invite.id });
                  onCloseInvite?.();
                }}
                className="flex-1 rounded-2xl bg-white/10 py-3 font-black text-white"
              >
                Refuser
              </button>
            </div>
          </div>
        </div>
      )}

      {tradeRoom && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/75 p-4">
          <div className="flex h-[82vh] w-full max-w-[1180px] gap-6 overflow-hidden rounded-[30px] border border-white/10 bg-dark-900/95 p-6 shadow-2xl max-[1020px]:h-[92vh] max-[1020px]:flex-col">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.35em] text-gray-500">Trade Room</div>
                  <h2 className="mt-2 text-3xl font-black text-white">Echange securise</h2>
                  <p className="mt-2 text-sm text-gray-400">
                    Le contenu change seulement apres double confirmation. Toute modification retire le ready et la confirmation.
                  </p>
                </div>
                <button
                  onClick={onCloseTrade}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 max-[820px]:grid-cols-1">
                <TradeStatusCard
                  user={user}
                  title="Mon offre"
                  isReady={myReady}
                  isConfirmed={myConfirmed}
                  itemCount={(tradeRoom.offers?.[user?.id] || []).length}
                />
                <TradeStatusCard
                  user={otherUser}
                  title={otherUser?.username || 'Autre joueur'}
                  isReady={otherReady}
                  isConfirmed={otherConfirmed}
                  itemCount={(tradeRoom.offers?.[otherUser?.id] || []).length}
                />
              </div>

              <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-4 max-[820px]:grid-cols-1">
                <TradeOffer
                  title="Mes skins"
                  items={tradeRoom.offers?.[user?.id] || []}
                  isReady={myReady}
                  isConfirmed={myConfirmed}
                  emptyLabel="Tu n as encore rien mis dans l echange."
                />
                <TradeOffer
                  title={otherUser?.username || 'Autre joueur'}
                  items={tradeRoom.offers?.[otherUser?.id] || []}
                  isReady={otherReady}
                  isConfirmed={otherConfirmed}
                  emptyLabel="Aucun skin ajoute pour le moment."
                />
              </div>

              <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                bothReady
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/10 bg-dark-950/70 text-gray-300'
              }`}>
                {bothReady
                  ? 'Les deux joueurs sont prets. Les deux confirmations sont maintenant requises pour finaliser le trade.'
                  : 'Ajoutez vos skins puis passez en mode Pret. Modifier une offre annule les validations en cours.'}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={toggleReady}
                  disabled={myConfirmed}
                  className={`rounded-2xl px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    myReady
                      ? 'bg-amber-400 text-dark-900'
                      : 'bg-cyan-600 text-white hover:bg-cyan-500'
                  }`}
                >
                  {myReady ? 'Annuler le ready' : 'Je suis pret'}
                </button>
                <button
                  onClick={confirmTrade}
                  disabled={!bothReady || myConfirmed}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {myConfirmed ? 'Confirmation envoyee' : 'Confirmer le trade'}
                </button>
                <button
                  onClick={onCloseTrade}
                  className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15"
                >
                  Fermer
                </button>
              </div>
            </div>

            <div className="flex w-[360px] min-h-0 flex-col rounded-[28px] border border-white/10 bg-dark-950/70 p-4 max-[1020px]:w-full">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.35em] text-gray-500">Inventaire</div>
                  <div className="mt-1 text-sm text-gray-400">Clique pour ajouter ou retirer un skin.</div>
                </div>
                {(myReady || myConfirmed) && (
                  <div className="rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                    Offre verrouillee
                  </div>
                )}
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                {loadingInventory ? (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">Chargement de l inventaire...</div>
                ) : inventory.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 text-center text-sm text-gray-500">
                    Aucun skin disponible pour trader.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {inventory.map((item) => {
                      const selected = myOfferIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleTradeItem(item.id, selected)}
                          disabled={myReady || myConfirmed}
                          className={`rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            selected
                              ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'
                              : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                          }`}
                        >
                          <div className="h-14 overflow-hidden rounded-xl bg-black/20">
                            {item.skin_image ? (
                              <img
                                src={item.skin_image}
                                alt={item.skin_name}
                                className="h-full w-full object-contain p-2"
                              />
                            ) : null}
                          </div>
                          <div className="mt-3 text-xs font-black truncate" style={{ color: item.rarity_color }}>
                            {item.skin_name}
                          </div>
                          <div className="mt-1 text-[11px] text-gray-500">
                            {item.wear_short} {Number(item.float_value).toFixed(4)}
                          </div>
                          <div className={`mt-2 text-[10px] font-black uppercase tracking-[0.18em] ${selected ? 'text-cyan-300' : 'text-gray-600'}`}>
                            {selected ? 'Dans l offre' : 'Disponible'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 rounded-xl border border-red-500/50 bg-dark-900/90 px-6 py-3 text-sm font-semibold text-red-400 shadow-lg backdrop-blur-xl">
          {toast}
        </div>
      )}
    </>
  );
}

function TradeStatusCard({ user, title, isReady, isConfirmed, itemCount }) {
  return (
    <div className={`rounded-3xl border p-4 ${
      isConfirmed
        ? 'border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.12)]'
        : isReady
          ? 'border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.12)]'
          : 'border-white/10 bg-white/[0.03]'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">{title}</div>
          <div className="mt-2 text-lg font-black text-white truncate">{user?.username || 'Joueur'}</div>
        </div>
        {user?.avatar ? (
          <img src={user.avatar} alt={user.username || 'Joueur'} className="h-11 w-11 rounded-full border border-white/10 object-cover" />
        ) : (
          <div className="h-11 w-11 rounded-full border border-white/10 bg-white/5" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge active={isReady} activeClass="bg-cyan-500 text-white" inactiveClass="bg-white/10 text-gray-400">
          {isReady ? 'Pret' : 'Pas pret'}
        </StatusBadge>
        <StatusBadge active={isConfirmed} activeClass="bg-emerald-500 text-white" inactiveClass="bg-white/10 text-gray-400">
          {isConfirmed ? 'Confirme' : 'Non confirme'}
        </StatusBadge>
        <StatusBadge active activeClass="bg-white/10 text-gray-200" inactiveClass="bg-white/10 text-gray-200">
          {itemCount} skin{itemCount > 1 ? 's' : ''}
        </StatusBadge>
      </div>
    </div>
  );
}

function TradeOffer({ title, items, isReady, isConfirmed, emptyLabel }) {
  return (
    <div className={`flex min-h-0 flex-col rounded-3xl border p-4 ${
      isConfirmed
        ? 'border-emerald-400/60 bg-emerald-500/10'
        : isReady
          ? 'border-cyan-400/60 bg-cyan-500/10'
          : 'border-white/10 bg-white/[0.03]'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-black uppercase tracking-[0.25em] text-gray-500">{title}</div>
        <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
          isConfirmed
            ? 'bg-emerald-500 text-white'
            : isReady
              ? 'bg-cyan-500 text-white'
              : 'bg-white/10 text-gray-400'
        }`}>
          {isConfirmed ? 'Confirmation recue' : isReady ? 'Pret' : 'En attente'}
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 text-center text-sm text-gray-500">
            {emptyLabel}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-dark-950/65 p-3">
                <div className="h-14 overflow-hidden rounded-xl bg-black/20">
                  {item.skin_image ? (
                    <img src={item.skin_image} alt={item.skin_name} className="h-full w-full object-contain p-2" />
                  ) : null}
                </div>
                <div className="mt-3 text-xs font-black truncate" style={{ color: item.rarity_color }}>
                  {item.skin_name}
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  {item.wear_short} {Number(item.float_value).toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ children, active, activeClass, inactiveClass }) {
  return (
    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${active ? activeClass : inactiveClass}`}>
      {children}
    </span>
  );
}
