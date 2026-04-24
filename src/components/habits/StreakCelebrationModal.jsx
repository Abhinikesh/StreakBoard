import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

export default function StreakCelebrationModal({ habit, onClose }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!habit || firedRef.current) return;
    firedRef.current = true;

    // Fire confetti burst
    const fire = (particleRatio, opts) => {
      confetti({
        origin: { y: 0.6 },
        ...opts,
        particleCount: Math.floor(200 * particleRatio),
      });
    };

    fire(0.25, { spread: 26, startVelocity: 55, colors: ['#facc15', '#f59e0b', '#fbbf24'] });
    fire(0.2,  { spread: 60, colors: ['#6366f1', '#8b5cf6', '#a78bfa'] });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ['#facc15', '#6366f1'] });
    fire(0.1,  { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1,  { spread: 120, startVelocity: 45 });
  }, [habit]);

  if (!habit) return null;

  const earnedDate = habit.badges?.find(b => b.type === '100_day_streak')?.earnedAt;
  const formattedDate = earnedDate
    ? new Date(earnedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-sm bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 rounded-3xl border border-yellow-400/30 shadow-[0_0_60px_rgba(250,204,21,0.2)] p-8 flex flex-col items-center text-center">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Trophy */}
        <div className="text-7xl mb-4 animate-bounce">🏆</div>

        {/* Stars */}
        <div className="flex gap-1 mb-3 text-yellow-400 text-xl">
          {'★★★★★'.split('').map((s, i) => (
            <span key={i} style={{ animationDelay: `${i * 100}ms` }} className="animate-pulse">{s}</span>
          ))}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">
          100 Day Streak!
        </h2>

        {/* Subtitle */}
        <p className="text-sm font-medium text-gray-300 mb-1">
          You've built an unstoppable habit:
        </p>
        <p className="text-base font-bold text-yellow-400 mb-1">
          {habit.icon || '🎯'} {habit.name}
        </p>
        {formattedDate && (
          <p className="text-xs text-gray-500 mb-6">Earned {formattedDate}</p>
        )}

        {/* CTA Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 px-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-95 transition-all duration-200 text-base"
        >
          Claim Your Badge 🏆
        </button>
      </div>
    </div>
  );
}
