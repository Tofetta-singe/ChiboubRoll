import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchInventory, sellSkin } from '../lib/api';

export default function Inventory({ isOpen, onClose }) {
  const { token, updateUserData } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sellingId, setSellingId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!isOpen || !token) return;
    setLoading(true);
    fetchInventory(token)
      .then((data) => setItems(data.inventory || []))
      .catch((error) => showToast(error.message, 'error'))
      .finally(() => setLoading(false));
  }, [isOpen, token]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleSell = async (item) => {
    if (sellingId) return;
    setSellingId(item.id);
    try {
      const data = await sellSkin(token, item.id);
      updateUserData({ coins: data.coins });
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      showToast(`+${data.soldValue} CC`, 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSellingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <aside className="fixed top-0 right-0 w-[620px] max-w-full h-full bg-dark-900/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
            Inventaire ({items.length} skins)
          </h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-500">Chargement...</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
              <span className="text-3xl">📭</span>
              <span className="text-sm">Inventaire vide.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => (
                <div key={item.id} className="p-3 rounded-xl border-2 bg-white/[0.03] hover:bg-white/[0.06] transition-all group" style={{ borderColor: `${item.rarity_color}55` }}>
                  {item.skin_image && <img src={item.skin_image} alt={item.skin_name} className="w-full h-20 object-contain mb-2" />}
                  <p className="text-xs font-bold truncate" style={{ color: item.rarity_color }}>{item.skin_name}</p>
                  <p className="text-[10px] font-semibold mb-2" style={{ color: `${item.rarity_color}99` }}>{item.rarity}</p>
                  <div className="text-[11px] text-gray-400 mb-3">
                    {item.wear_name} ({item.wear_short}) • {Number(item.float_value).toFixed(4)}
                  </div>
                  <button
                    onClick={() => handleSell(item)}
                    disabled={sellingId === item.id}
                    className="w-full flex items-center justify-center gap-1 bg-gradient-to-br from-yellow-500/80 to-amber-600/80 text-dark-900 font-bold py-1.5 rounded-lg text-xs disabled:opacity-50"
                  >
                    Vendre ({item.sell_value} CC)
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-xl font-semibold text-sm backdrop-blur-xl border shadow-lg ${toast.type === 'success' ? 'border-emerald-500/50 text-emerald-400 bg-dark-900/90' : 'border-red-500/50 text-red-400 bg-dark-900/90'}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
