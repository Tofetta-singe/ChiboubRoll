import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchCases, startCaseBattle } from '../lib/api';

export default function CaseBattle({ isOpen, onClose }) {
  const { token, user, updateUserData } = useAuth();
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [battling, setBattling] = useState(false);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchCases().then(data => setCases(data.cases || [])).catch(console.error);
      setResult(null);
      setShowResult(false);
      setSelectedCase(null);
    }
  }, [isOpen]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleBattle = async (caseData) => {
    if (battling) return;
    if (!user || user.coins < caseData.price) {
      showToast('Pas assez de Chiboub Coins!', 'error');
      return;
    }

    setSelectedCase(caseData);
    setBattling(true);
    setResult(null);
    setShowResult(false);

    try {
      const data = await startCaseBattle(token, caseData.id);
      updateUserData({ coins: data.coins });
      setResult(data);

      // Reveal animation delay
      setTimeout(() => setShowResult(true), 1500);
    } catch (err) {
      showToast(err.message, 'error');
      setSelectedCase(null);
    } finally {
      setBattling(false);
    }
  };

  const handleBack = () => {
    setResult(null);
    setShowResult(false);
    setSelectedCase(null);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Panel */}
      <aside className="fixed top-0 right-0 w-[560px] max-w-full h-full bg-dark-900/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold bg-gradient-to-r from-red-400 to-pink-500 bg-clip-text text-transparent">
            ⚔️ Case Battle
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full glass flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Battle Result */}
          {result && (
            <div className="glass rounded-2xl p-5 border border-white/10 space-y-4">
              <h3 className="text-center text-lg font-black">
                {!showResult ? (
                  <span className="text-yellow-400 animate-pulse">⚔️ Combat en cours...</span>
                ) : result.playerWins ? (
                  <span className="text-emerald-400">🏆 VICTOIRE!</span>
                ) : (
                  <span className="text-red-400">💀 DÉFAITE!</span>
                )}
              </h3>

              {/* Side by side */}
              <div className="grid grid-cols-2 gap-4">
                {/* Player */}
                <div className={`p-3 rounded-xl border-2 text-center transition-all duration-500 ${
                  showResult
                    ? result.playerWins
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                      : 'border-red-500/50 bg-red-500/5 opacity-60'
                    : 'border-white/10 bg-white/[0.03]'
                }`}>
                  <p className="text-xs font-bold text-gray-400 mb-2">🧑 Toi</p>
                  <div className={`transition-all duration-700 ${showResult ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                    {result.playerSkin.skin_image && (
                      <img
                        src={result.playerSkin.skin_image}
                        alt=""
                        className="w-full h-20 object-contain mb-2"
                      />
                    )}
                    <p className="text-xs font-bold truncate" style={{ color: result.playerSkin.rarity_color }}>
                      {result.playerSkin.skin_name}
                    </p>
                    <p className="text-[10px] font-semibold" style={{ color: result.playerSkin.rarity_color + '99' }}>
                      {result.playerSkin.rarity}
                    </p>
                    <p className="text-xs font-bold text-yellow-400 mt-1">
                      🪙 {result.playerSkin.sell_value}
                    </p>
                  </div>
                </div>

                {/* Bot */}
                <div className={`p-3 rounded-xl border-2 text-center transition-all duration-500 ${
                  showResult
                    ? !result.playerWins
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                      : 'border-red-500/50 bg-red-500/5 opacity-60'
                    : 'border-white/10 bg-white/[0.03]'
                }`}>
                  <p className="text-xs font-bold text-gray-400 mb-2">🤖 Bot</p>
                  <div className={`transition-all duration-700 delay-300 ${showResult ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                    {result.botSkin.skin_image && (
                      <img
                        src={result.botSkin.skin_image}
                        alt=""
                        className="w-full h-20 object-contain mb-2"
                      />
                    )}
                    <p className="text-xs font-bold truncate" style={{ color: result.botSkin.rarity_color }}>
                      {result.botSkin.skin_name}
                    </p>
                    <p className="text-[10px] font-semibold" style={{ color: result.botSkin.rarity_color + '99' }}>
                      {result.botSkin.rarity}
                    </p>
                    <p className="text-xs font-bold text-yellow-400 mt-1">
                      🪙 {result.botSkin.sell_value}
                    </p>
                  </div>
                </div>
              </div>

              {/* Result message */}
              {showResult && (
                <div className="text-center animate-pop">
                  {result.playerWins ? (
                    <p className="text-sm font-bold text-emerald-400">
                      Tu gagnes les 2 skins! 🎉
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-red-400">
                      Tu perds ta mise de {selectedCase?.price} CC 😢
                    </p>
                  )}
                  <button
                    onClick={handleBack}
                    className="mt-3 px-6 py-2 bg-gradient-to-br from-purple-600 to-purple-800 text-white font-bold rounded-xl text-sm hover:-translate-y-0.5 transition-all"
                  >
                    🔄 Rejouer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Case selection */}
          {!result && (
            <>
              <div className="text-center text-sm text-gray-400 mb-2">
                <p>Choisis une caisse pour lancer un <strong className="text-white">1v1 contre un Bot</strong>.</p>
                <p className="text-xs mt-1">Le skin le plus rare gagne! Le gagnant remporte les 2 skins.</p>
              </div>

              <div className="space-y-3">
                {cases.map((c) => {
                  const canAfford = user && user.coins >= c.price;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleBattle(c)}
                      disabled={!canAfford || battling}
                      className={`w-full p-4 rounded-2xl border transition-all duration-200 text-left ${
                        canAfford && !battling
                          ? 'border-white/10 hover:border-red-500/40 hover:-translate-x-1 hover:shadow-[4px_0_20px_rgba(239,68,68,0.15)] cursor-pointer bg-white/[0.03]'
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
                            ⚔️ Battle — {c.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            1v1 vs Bot • Le meilleur skin gagne tout
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
            </>
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
    </>
  );
}
