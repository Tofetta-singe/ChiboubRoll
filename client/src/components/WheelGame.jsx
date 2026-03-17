import { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { doSpin } from '../lib/api';

function getSegments(wheelIndex, activeUpgrades, isPowerActive = false) {
  const megaLevel = activeUpgrades.mega_segments || 0;
  const multiplierLevel = activeUpgrades.multiplier || 0;
  const magnetLevel = activeUpgrades.coin_magnet || 0;

  const coinMultiplier = Math.pow(1.8, multiplierLevel);
  const magnetBonus = 1 + magnetLevel * 0.1;
  let wheelMultiplier = coinMultiplier * magnetBonus;

  if (isPowerActive) {
    const powerBoostLevel = activeUpgrades.power_roll_boost || 0;
    wheelMultiplier *= 5 + powerBoostLevel * 2;
  }

  let values = [
    { base: 5, color: '#4a3580' },
    { base: 5, color: '#5b3d9e' },
    { base: 5, color: '#6d45bc' },
    { base: 10, color: '#7c4ddb' },
    { base: 5, color: '#5540a0' },
    { base: 5, color: '#483278' },
    { base: 15, color: '#f5a623' },
    { base: 5, color: '#6840b5' },
    { base: 5, color: '#4c3685' },
    { base: 10, color: '#7a4bd8' },
    { base: 5, color: '#5a3c9b' },
    { base: 25, color: '#e6941e' },
  ];

  if (megaLevel >= 1) { values[6].base = 30; values.push({ base: 40, color: '#d4790f' }); }
  if (megaLevel >= 2) values.push({ base: 80, color: '#c46a0a' });
  if (megaLevel >= 3) values.push({ base: 150, color: '#b35b05' });

  return values.map((value) => {
    const finalValue = Math.floor(value.base * wheelMultiplier);
    return { value: finalValue, label: formatNumber(finalValue), color: value.color };
  });
}

function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function drawWheel(canvas, segments, rotation = 0, isPowerRoll = false) {
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = cx - 15;
  const segAngle = (2 * Math.PI) / segments.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (isPowerRoll) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + 18, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 200, 0, 0.8)';
    ctx.lineWidth = 6;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 30;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.strokeStyle = isPowerRoll ? 'rgba(255, 200, 0, 0.8)' : 'rgba(245, 166, 35, 0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();

  segments.forEach((seg, index) => {
    const startAngle = rotation + index * segAngle;
    const endAngle = startAngle + segAngle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const baseColor = isPowerRoll ? adjustColor(seg.color, 60) : seg.color;
    grad.addColorStop(0, adjustColor(baseColor, 30));
    grad.addColorStop(1, baseColor);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + segAngle / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';

    const labelStr = seg.label;
    let fontSize = 16;
    if (labelStr.length > 3) fontSize = 14;
    if (labelStr.length > 5) fontSize = 11;
    if (labelStr.length > 7) fontSize = 9;

    ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(labelStr, r * 0.65, 0);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.strokeStyle = isPowerRoll ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 14;
  ctx.stroke();

  for (let index = 0; index < segments.length; index++) {
    const angle = rotation + index * segAngle;
    ctx.beginPath();
    ctx.moveTo(cx + (r + 1) * Math.cos(angle), cy + (r + 1) * Math.sin(angle));
    ctx.lineTo(cx + (r + 14) * Math.cos(angle), cy + (r + 14) * Math.sin(angle));
    ctx.strokeStyle = isPowerRoll ? 'rgba(255, 215, 0, 0.9)' : 'rgba(245, 166, 35, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function formatNumber(n) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.floor(n));
}

export default function WheelGame() {
  const { token, upgrades, updateUserData } = useAuth();
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(null);
  const [bigWin, setBigWin] = useState(false);
  const [specialEvent, setSpecialEvent] = useState(null);
  const [comboStreak, setComboStreak] = useState(0);
  const [powerProgress, setPowerProgress] = useState({ current: 0, threshold: 25 });
  const wheelRefs = useRef([]);
  const rotations = useRef([]);
  const autoSpinRef = useRef(null);
  const queuedSpinsRef = useRef(0);
  const spinningRef = useRef(false);

  const wheelCount = 1 + (upgrades.extra_wheel || 0);
  const spinDuration = Math.max(1200, 3000 - (upgrades.turbo_spin || 0) * 400);
  const hasPowerRoll = (upgrades.power_roll || 0) > 0;

  useEffect(() => {
    for (let index = 0; index < wheelCount; index++) {
      const canvas = wheelRefs.current[index];
      if (!canvas) continue;
      if (rotations.current[index] == null) rotations.current[index] = 0;
      const segments = getSegments(index, upgrades, false);
      drawWheel(canvas, segments, rotations.current[index], false);
    }
  }, [wheelCount, upgrades]);

  const spawnFloatingCoins = (rect, count) => {
    for (let index = 0; index < Math.min(8, count); index++) {
      const coin = document.createElement('div');
      coin.className = 'floating-coin';
      coin.textContent = '🪙';
      coin.style.left = `${rect.left + rect.width / 2 + (Math.random() - 0.5) * 80}px`;
      coin.style.top = `${rect.top + rect.height / 2 + (Math.random() - 0.5) * 40}px`;
      coin.style.animationDelay = `${index * 0.08}s`;
      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 1500);
    }
  };

  const spawnParticles = (colors) => {
    const defaultColors = ['#f5a623', '#ffd700', '#7c3aed', '#a78bfa', '#10b981', '#ef4444'];
    const palette = colors || defaultColors;
    for (let index = 0; index < 30; index++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = `${Math.random() * 100}vw`;
      particle.style.top = `${60 + Math.random() * 40}vh`;
      particle.style.width = particle.style.height = `${4 + Math.random() * 8}px`;
      particle.style.background = palette[Math.floor(Math.random() * palette.length)];
      particle.style.animationDuration = `${2 + Math.random() * 3}s`;
      particle.style.animationDelay = `${Math.random() * 0.5}s`;
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 6000);
    }
  };

  const performSpin = useCallback(async () => {
    spinningRef.current = true;
    setSpinning(true);
    setLastWin(null);
    setSpecialEvent(null);

    try {
      const data = await doSpin(token);
      const isPower = data.isPowerRoll;

      const animPromises = data.results.map((result, wheelIndex) => new Promise((resolve) => {
        const canvas = wheelRefs.current[wheelIndex];
        if (!canvas) return resolve();

        const segments = getSegments(wheelIndex, upgrades, isPower);
        const segAngle = (2 * Math.PI) / segments.length;
        const targetAngle = -Math.PI / 2 - result.segmentIndex * segAngle - segAngle / 2;
        const extraSpins = isPower ? 6 + Math.floor(Math.random() * 3) : 4 + Math.floor(Math.random() * 3);
        const startRot = rotations.current[wheelIndex] || 0;
        const deltaRot = extraSpins * 2 * Math.PI + targetAngle - startRot;
        const startTime = performance.now();
        const delay = wheelIndex * 150;
        const duration = spinDuration + wheelIndex * 200;

        const animate = (now) => {
          const elapsed = now - startTime - delay;
          if (elapsed < 0) return requestAnimationFrame(animate);

          const t = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - t, 4);
          const currentRot = startRot + deltaRot * ease;
          rotations.current[wheelIndex] = currentRot;
          drawWheel(canvas, segments, currentRot, isPower);

          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            const rect = canvas.getBoundingClientRect();
            spawnFloatingCoins(rect, Math.max(3, Math.floor(result.value / 5)));
            drawWheel(canvas, getSegments(wheelIndex, upgrades, false), currentRot, false);
            resolve();
          }
        };

        requestAnimationFrame(animate);
      }));

      await Promise.all(animPromises);

      updateUserData({
        coins: data.coins,
        total_earned: data.totalEarned,
        total_spins: data.totalSpins,
      });

      setLastWin(data.totalWin);
      setBigWin(data.totalWin >= 50);
      setComboStreak(data.comboStreak || 0);
      setPowerProgress({
        current: data.spinsSincePower || 0,
        threshold: data.powerRollThreshold || 25,
      });

      if (data.isJackpot) {
        setSpecialEvent('jackpot');
        spawnParticles(['#ffd700', '#ff6b00', '#ff0000', '#ffaa00']);
      } else if (data.isPowerRoll) {
        setSpecialEvent('power');
        spawnParticles(['#ffd700', '#ff9500', '#ffcc00', '#fff200']);
      } else if (data.isDiamondRain) {
        setSpecialEvent('diamond');
        spawnParticles(['#00bfff', '#00e5ff', '#7df9ff', '#b9f2ff']);
      } else if (data.totalWin >= 100) {
        spawnParticles();
      }

      if (data.isJackpot || data.isPowerRoll || data.isDiamondRain) {
        setTimeout(() => setSpecialEvent(null), 3000);
      }
    } catch (error) {
      console.error('Spin error:', error);
      alert(`Erreur de spin: ${error.message}`);
    } finally {
      spinningRef.current = false;
      setSpinning(false);
      if (queuedSpinsRef.current > 0) {
        queuedSpinsRef.current -= 1;
        performSpin();
      }
    }
  }, [token, upgrades, spinDuration, updateUserData]);

  const handleSpin = useCallback(() => {
    if (spinningRef.current) {
      queuedSpinsRef.current = Math.min(queuedSpinsRef.current + 1, 5);
      return;
    }
    performSpin();
  }, [performSpin]);

  useEffect(() => {
    if (autoSpinRef.current) clearInterval(autoSpinRef.current);
    const autoLevel = upgrades.auto_spin || 0;
    if (autoLevel > 0) {
      const interval = Math.max(1000, 3000 - (autoLevel - 1) * 800);
      autoSpinRef.current = setInterval(() => handleSpin(), interval);
    }
    return () => {
      if (autoSpinRef.current) clearInterval(autoSpinRef.current);
    };
  }, [handleSpin, upgrades.auto_spin, token]);

  useEffect(() => {
    const handler = (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        handleSpin();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSpin]);

  return (
    <div className="flex flex-col items-center gap-6 relative z-10">
      {specialEvent && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[200] px-8 py-4 rounded-2xl font-black text-2xl text-center animate-pop backdrop-blur-xl border shadow-2xl ${specialEvent === 'jackpot' ? 'bg-red-900/80 text-yellow-300 border-yellow-500/60 shadow-yellow-500/30' : specialEvent === 'power' ? 'bg-amber-900/80 text-yellow-200 border-amber-400/60 shadow-amber-400/30' : 'bg-cyan-900/80 text-cyan-200 border-cyan-400/60 shadow-cyan-400/30'}`}>
          {specialEvent === 'jackpot' && '🎰 JACKPOT x10!! 🎰'}
          {specialEvent === 'power' && '💥 POWER ROLL! 💥'}
          {specialEvent === 'diamond' && '💠 PLUIE DE DIAMANTS x2! 💠'}
        </div>
      )}

      {hasPowerRoll && (
        <div className="w-72 glass rounded-full p-1">
          <div className="flex items-center gap-2 px-3 py-1">
            <span className="text-sm">💥</span>
            <div className="flex-1 h-3 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(100, (powerProgress.current / powerProgress.threshold) * 100)}%`,
                  background: powerProgress.current >= powerProgress.threshold - 1
                    ? 'linear-gradient(90deg, #ffd700, #ff6b00)'
                    : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                }}
              />
            </div>
            <span className="text-xs font-bold text-gray-400 min-w-[40px] text-right">
              {powerProgress.current}/{powerProgress.threshold}
            </span>
          </div>
        </div>
      )}

      {comboStreak > 1 && (
        <div className="flex items-center gap-2 text-sm font-bold text-orange-400 animate-pulse">
          <span>🔗</span>
          <span>Combo x{comboStreak}</span>
          <span className="text-xs text-orange-400/60">+{((upgrades.combo_streak || 0) * 5 * (comboStreak - 1))}% bonus</span>
        </div>
      )}

      <div className="flex flex-wrap gap-7 justify-center items-center">
        {Array.from({ length: wheelCount }).map((_, index) => (
          <div key={index} className="relative" style={{ width: 320, height: 320 }}>
            <canvas
              ref={(el) => { wheelRefs.current[index] = el; }}
              width={340}
              height={340}
              className="w-full h-full drop-shadow-[0_0_20px_rgba(124,58,237,0.3)]"
            />
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-3xl text-yellow-400 drop-shadow-lg z-10">▼</div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-dark-600 to-dark-800 border-[3px] border-gold shadow-[0_0_15px_rgba(245,166,35,0.4),inset_0_0_10px_rgba(0,0,0,0.5)] z-10" />
          </div>
        ))}
      </div>

      <button
        id="spin-btn"
        onClick={handleSpin}
        className="shimmer relative flex flex-col items-center gap-1 bg-gradient-to-br from-yellow-400 to-amber-600 text-dark-900 font-black text-xl px-16 py-5 rounded-full transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(245,166,35,0.4)] active:translate-y-0 active:scale-[0.97]"
      >
        <span>🎰 SPIN!</span>
        <span className="text-xs font-normal opacity-70">
          {spinning ? `Spinning... (${queuedSpinsRef.current} en attente)` : 'Clique ou appuie sur Espace'}
        </span>
      </button>

      {lastWin !== null && (
        <div className={`font-bold text-yellow-400 drop-shadow-[0_0_15px_rgba(245,166,35,0.4)] transition-all ${bigWin ? 'text-2xl animate-pop' : 'text-lg'}`}>
          +{formatNumber(lastWin)} Chiboub Coins! 🪙
        </div>
      )}

      {(upgrades.auto_spin || 0) > 0 && (
        <div className="text-xs text-purple-400/70 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          Auto-Spin actif
        </div>
      )}
    </div>
  );
}
