import { useEffect, useState } from 'react';

const SFX_VOLUME_KEY = 'chiboub_sfx_volume';
const DEFAULT_SFX_VOLUME = 0.18;

function readStoredVolume() {
  const raw = Number(localStorage.getItem(SFX_VOLUME_KEY));
  if (Number.isFinite(raw)) return Math.min(1, Math.max(0, raw));
  return DEFAULT_SFX_VOLUME;
}

function broadcastVolume(volume) {
  window.dispatchEvent(new CustomEvent('chiboub:settings', { detail: { sfxVolume: volume } }));
}

export default function SettingsPanel({ isOpen, onClose }) {
  const [volume, setVolume] = useState(DEFAULT_SFX_VOLUME);

  useEffect(() => {
    if (!isOpen) return;
    setVolume(readStoredVolume());
  }, [isOpen]);

  const handleChange = (event) => {
    const nextVolume = Number(event.target.value) / 100;
    setVolume(nextVolume);
    localStorage.setItem(SFX_VOLUME_KEY, String(nextVolume));
    broadcastVolume(nextVolume);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-dark-900/95 p-6 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.35em] text-gray-500">Settings</div>
              <h2 className="mt-2 text-3xl font-black text-white">Audio</h2>
              <p className="mt-2 text-sm text-gray-400">
                Regle le volume des sons d ouverture de caisse. Le niveau est volontairement limite pour eviter des effets trop forts.
              </p>
            </div>
            <button onClick={onClose} className="h-10 w-10 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white">
              ✕
            </button>
          </div>

          <div className="mt-8 rounded-3xl border border-white/10 bg-dark-950/70 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-black text-white">Sound effects</div>
                <div className="mt-1 text-xs text-gray-500">Ouverture, scroll continu et reveal final des skins</div>
              </div>
              <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-cyan-300">
                {Math.round(volume * 100)}%
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(volume * 100)}
              onChange={handleChange}
              className="mt-6 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400"
            />

            <div className="mt-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">
              <span>Mute</span>
              <span>Low</span>
              <span>Medium</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
