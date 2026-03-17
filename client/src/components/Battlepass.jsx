import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { claimBattlepassTier, fetchBattlepass } from '../lib/api';

export default function Battlepass({ isOpen, onClose }) {
  const { token, updateUserData } = useAuth();
  const [battlepass, setBattlepass] = useState(null);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!isOpen || !token) return;
    setLoading(true);
    fetchBattlepass(token)
      .then(setBattlepass)
      .catch((error) => setToast({ msg: error.message, type: 'error' }))
      .finally(() => setLoading(false));
  }, [isOpen, token]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const handleClaim = async (tierId) => {
    setClaimingId(tierId);
    try {
      const data = await claimBattlepassTier(token, tierId);
      setBattlepass(data.battlepass);
      updateUserData(data.reward.user || null);
      setToast({
        msg: data.reward.rewardType === 'coins'
          ? `+${data.reward.coinsGranted} CC`
          : `${data.reward.item.skin_name} recuperee`,
        type: 'success',
      });
    } catch (error) {
      setToast({ msg: error.message, type: 'error' });
    } finally {
      setClaimingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <aside className="fixed top-0 right-0 w-[720px] max-w-full h-full bg-dark-900/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-black bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-transparent">Battlepass</h2>
            <p className="text-sm text-gray-500">Debloque des paliers en gagnant des spins.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading || !battlepass ? (
            <div className="text-gray-500">Chargement...</div>
          ) : (
            <>
              <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-5 mb-6">
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300/70 font-black">Progression</div>
                <div className="text-3xl font-black text-white mt-2">{battlepass.totalSpins} spins</div>
              </div>

              <div className="space-y-4">
                {battlepass.tiers.map((tier) => {
                  const rewardLabel = tier.reward.type === 'coins'
                    ? `${tier.reward.amount} CC`
                    : tier.reward.label;
                  return (
                    <div key={tier.id} className={`rounded-3xl border p-5 ${tier.claimed ? 'border-emerald-500/30 bg-emerald-500/5' : tier.unlocked ? 'border-cyan-500/25 bg-white/[0.03]' : 'border-white/10 bg-white/[0.02] opacity-70'}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.3em] text-gray-500 font-black">Palier {tier.id.replace('bp_', '')}</div>
                          <div className="text-lg font-black text-white mt-1">{tier.spinsRequired} spins</div>
                          <div className="text-sm text-gray-400 mt-1">{rewardLabel}</div>
                        </div>

                        <button
                          disabled={!tier.unlocked || tier.claimed || claimingId === tier.id}
                          onClick={() => handleClaim(tier.id)}
                          className="px-4 py-2 rounded-2xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {tier.claimed ? 'Claimed' : tier.unlocked ? 'Recuperer' : 'Verrouille'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </aside>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-xl font-semibold text-sm backdrop-blur-xl border ${toast.type === 'success' ? 'border-emerald-500/50 text-emerald-400 bg-dark-900/90' : 'border-red-500/50 text-red-400 bg-dark-900/90'}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
