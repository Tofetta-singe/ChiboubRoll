import { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { doSpin } from '../lib/api';

// ===== SEGMENT DEFINITIONS (mirrors server) =====
function getSegments(isGolden, megaLevel) {
  let segments = [
    { value: 1, color: '#4a3580', label: '1' },
    { value: 2, color: '#5b3d9e', label: '2' },
    { value: 3, color: '#6d45bc', label: '3' },
    { value: 5, color: '#7c4ddb', label: '5' },
    { value: 2, color: '#5540a0', label: '2' },
    { value: 1, color: '#483278', label: '1' },
    { value: 10, color: '#f5a623', label: '10' },
    { value: 3, color: '#6840b5', label: '3' },
    { value: 1, color: '#4c3685', label: '1' },
    { value: 5, color: '#7a4bd8', label: '5' },
    { value: 2, color: '#5a3c9b', label: '2' },
    { value: 20, color: '#e6941e', label: '20' },
  ];

  if (megaLevel >= 1) { segments[6] = { value: 25, color: '#e88b15', label: '25' }; segments.push({ value: 50, color: '#d4790f', label: '50' }); }
  if (megaLevel >= 2) { segments.push({ value: 100, color: '#c46a0a', label: '💯' }); }
  if (megaLevel >= 3) { segments.push({ value: 250, color: '#b35b05', label: '💎250' }); }

  if (isGolden) {
    segments = segments.map(s => ({
      ...s, value: s.value * 3, label: String(s.value * 3),
      color: adjustColor(s.color, 40),
    }));
  }
  return segments;
}

function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function drawWheel(canvas, segments, rotation = 0) {
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = cx - 15;
  const segAngle = (2 * Math.PI) / segments.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(245, 166, 35, 0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Segments
  segments.forEach((seg, i) => {
    const startAngle = rotation + i * segAngle;
    const endAngle = startAngle + segAngle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, adjustColor(seg.color, 30));
    grad.addColorStop(1, seg.color);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + segAngle / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${seg.value >= 100 ? 13 : 16}px Outfit, sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(seg.label, r * 0.65, 0);
    ctx.restore();
  });

  // Outer ring decoration
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 14;
  ctx.stroke();

  // Tick marks
  for (let i = 0; i < segments.length; i++) {
    const angle = rotation + i * segAngle;
    ctx.beginPath();
    ctx.moveTo(cx + (r + 1) * Math.cos(angle), cy + (r + 1) * Math.sin(angle));
    ctx.lineTo(cx + (r + 14) * Math.cos(angle), cy + (r + 14) * Math.sin(angle));
    ctx.strokeStyle = 'rgba(245, 166, 35, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function formatNumber(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.floor(n));
}

// ===== COMPONENT =====
export default function WheelGame() {
  const { token, upgrades, updateUserData } = useAuth();
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(null);
  const [bigWin, setBigWin] = useState(false);
  const wheelRefs = useRef([]);
  const rotations = useRef([]);
  const autoSpinRef = useRef(null);

  const wheelCount = 1 + (upgrades.extra_wheel || 0);
  const hasGolden = (upgrades.golden_wheel || 0) > 0;
  const megaLevel = upgrades.mega_segments || 0;
  const spinDuration = Math.max(1200, 3000 - (upgrades.turbo_spin || 0) * 400);

  // Initialize wheel refs and draw
  useEffect(() => {
    for (let i = 0; i < wheelCount; i++) {
      const canvas = wheelRefs.current[i];
      if (!canvas) continue;
      if (!rotations.current[i]) rotations.current[i] = 0;
      const isGolden = i === 0 && hasGolden;
      const segments = getSegments(isGolden, megaLevel);
      drawWheel(canvas, segments, rotations.current[i]);
    }
  }, [wheelCount, hasGolden, megaLevel]);

  // Auto-spin
  useEffect(() => {
    if (autoSpinRef.current) clearInterval(autoSpinRef.current);
    const autoLevel = upgrades.auto_spin || 0;
    if (autoLevel > 0) {
      const interval = Math.max(1000, 3000 - (autoLevel - 1) * 800);
      autoSpinRef.current = setInterval(() => {
        handleSpin();
      }, interval);
    }
    return () => { if (autoSpinRef.current) clearInterval(autoSpinRef.current); };
  }, [upgrades.auto_spin, token]);

  const spawnFloatingCoins = (rect, count) => {
    for (let i = 0; i < Math.min(8, count); i++) {
      const coin = document.createElement('div');
      coin.className = 'floating-coin';
      coin.textContent = '🪙';
      coin.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 80) + 'px';
      coin.style.top = (rect.top + rect.height / 2 + (Math.random() - 0.5) * 40) + 'px';
      coin.style.animationDelay = `${i * 0.08}s`;
      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 1500);
    }
  };

  const spawnParticles = () => {
    const colors = ['#f5a623', '#ffd700', '#7c3aed', '#a78bfa', '#10b981', '#ef4444'];
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.top = (60 + Math.random() * 40) + 'vh';
      p.style.width = p.style.height = (4 + Math.random() * 8) + 'px';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.animationDuration = (2 + Math.random() * 3) + 's';
      p.style.animationDelay = Math.random() * 0.5 + 's';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 6000);
    }
  };

  const handleSpin = useCallback(async () => {
    if (spinning) return;
    setSpinning(true);
    setLastWin(null);

    try {
      // Call server to get results
      const data = await doSpin(token);

      // Animate each wheel to land on the server-determined segment
      const animPromises = data.results.map((result, wIdx) => {
        return new Promise((resolve) => {
          const canvas = wheelRefs.current[wIdx];
          if (!canvas) { resolve(); return; }

          const isGolden = result.isGolden;
          const segments = getSegments(isGolden, megaLevel);
          const segAngle = (2 * Math.PI) / segments.length;
          const targetAngle = -Math.PI / 2 - result.segmentIndex * segAngle - segAngle / 2;
          const extraSpins = 4 + Math.floor(Math.random() * 3);
          const startRot = rotations.current[wIdx] || 0;
          const deltaRot = extraSpins * 2 * Math.PI + targetAngle - startRot;

          const startTime = performance.now();
          const delay = wIdx * 150;
          const duration = spinDuration + wIdx * 200;

          const animate = (now) => {
            const elapsed = now - startTime - delay;
            if (elapsed < 0) { requestAnimationFrame(animate); return; }
            const t = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - t, 4);
            const currentRot = startRot + deltaRot * ease;
            rotations.current[wIdx] = currentRot;
            drawWheel(canvas, segments, currentRot);

            if (t < 1) {
              requestAnimationFrame(animate);
            } else {
              // Spawn coins on this wheel
              const rect = canvas.getBoundingClientRect();
              spawnFloatingCoins(rect, Math.max(3, Math.floor(result.value / 5)));
              resolve();
            }
          };
          requestAnimationFrame(animate);
        });
      });

      await Promise.all(animPromises);

      // Update state
      updateUserData({
        coins: data.coins,
        total_earned: data.totalEarned,
        total_spins: data.totalSpins,
      });

      setLastWin(data.totalWin);
      setBigWin(data.totalWin >= 50);
      if (data.totalWin >= 100) spawnParticles();

    } catch (err) {
      console.error('Spin error:', err);
    } finally {
      setSpinning(false);
    }
  }, [spinning, token, megaLevel, spinDuration, updateUserData]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space') { e.preventDefault(); handleSpin(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSpin]);

  return (
    <div className="flex flex-col items-center gap-6 relative z-10">
      {/* Wheels */}
      <div className="flex flex-wrap gap-7 justify-center items-center">
        {Array.from({ length: wheelCount }).map((_, i) => {
          const isGolden = i === 0 && hasGolden;
          return (
            <div key={i} className="relative" style={{ width: 320, height: 320 }}>
              <canvas
                ref={(el) => { wheelRefs.current[i] = el; }}
                width={340}
                height={340}
                className={`w-full h-full ${isGolden ? 'drop-shadow-[0_0_30px_rgba(255,215,0,0.5)]' : 'drop-shadow-[0_0_20px_rgba(124,58,237,0.3)]'}`}
              />
              {/* Pointer */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-3xl text-yellow-400 drop-shadow-lg z-10">
                ▼
              </div>
              {/* Center cap */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-dark-600 to-dark-800 border-[3px] border-gold shadow-[0_0_15px_rgba(245,166,35,0.4),inset_0_0_10px_rgba(0,0,0,0.5)] z-10" />
            </div>
          );
        })}
      </div>

      {/* Spin button */}
      <button
        id="spin-btn"
        onClick={handleSpin}
        disabled={spinning}
        className="shimmer relative flex flex-col items-center gap-1 bg-gradient-to-br from-yellow-400 to-amber-600 text-dark-900 font-black text-xl px-16 py-5 rounded-full transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(245,166,35,0.4)] active:translate-y-0 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        <span>🎰 SPIN!</span>
        <span className="text-xs font-normal opacity-70">
          {spinning ? 'Spinning...' : 'Clique ou appuie sur Espace'}
        </span>
      </button>

      {/* Last win */}
      {lastWin !== null && (
        <div
          className={`font-bold text-yellow-400 drop-shadow-[0_0_15px_rgba(245,166,35,0.4)] transition-all ${
            bigWin ? 'text-2xl animate-pop' : 'text-lg'
          }`}
        >
          +{formatNumber(lastWin)} Chiboub Coins! 🪙
        </div>
      )}

      {/* Auto-spin indicator */}
      {(upgrades.auto_spin || 0) > 0 && (
        <div className="text-xs text-purple-400/70 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          Auto-Spin actif
        </div>
      )}
    </div>
  );
}
