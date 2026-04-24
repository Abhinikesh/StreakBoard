import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Navbar from '../components/layout/Navbar';
import { useTheme } from '../context/ThemeContext';

// ─── Sort options ─────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: 'longestStreak', label: '🔥 Best Streak' },
  { key: 'overallRate',   label: '📊 Overall Rate' },
  { key: 'totalDone',     label: '✅ Total Done'   },
];

// ─── Avatar circle ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f59e0b',
  '#10b981','#3b82f6','#ef4444','#14b8a6',
];
function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function AvatarCircle({ name, avatar, size = 40 }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  const style = {
    width: size, height: size, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: size * 0.38, color: '#fff', flexShrink: 0,
    background: avatar ? undefined : avatarColor(name),
    overflow: 'hidden',
  };
  if (avatar) {
    return (
      <div style={style}>
        <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  return <div style={style}>{initial}</div>;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRow({ isDark }) {
  const bg = isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6';
  const pulse = {
    background: isDark
      ? 'linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.1),rgba(255,255,255,0.04))'
      : 'linear-gradient(90deg,#f3f4f6,#e5e7eb,#f3f4f6)',
    backgroundSize: '200% 100%',
    animation: 'lbSkeletonPulse 1.4s ease-in-out infinite',
    borderRadius: 8,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}` }}>
      <div style={{ ...pulse, width: 28, height: 16 }} />
      <div style={{ ...pulse, width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ ...pulse, height: 14, width: '45%' }} />
        <div style={{ ...pulse, height: 11, width: '25%' }} />
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        {[60, 50, 50].map((w, i) => (
          <div key={i} style={{ ...pulse, width: w, height: 14 }} />
        ))}
      </div>
    </div>
  );
}

function SkeletonPodium({ isDark }) {
  const pulse = {
    background: isDark
      ? 'linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.1),rgba(255,255,255,0.04))'
      : 'linear-gradient(90deg,#f3f4f6,#e5e7eb,#f3f4f6)',
    backgroundSize: '200% 100%',
    animation: 'lbSkeletonPulse 1.4s ease-in-out infinite',
    borderRadius: 12,
  };
  const card = (h) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ ...pulse, width: 56, height: 56, borderRadius: '50%' }} />
      <div style={{ ...pulse, width: 64, height: 12 }} />
      <div style={{ ...pulse, width: 44, height: 10 }} />
      <div style={{ ...pulse, width: 48, height: h }} />
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 24, padding: '28px 20px' }}>
      {card(80)}
      {card(112)}
      {card(64)}
    </div>
  );
}

// ─── Podium card ──────────────────────────────────────────────────────────────
const MEDAL = ['🥇','🥈','🥉'];
const BORDER_COLOR = ['#f59e0b','#94a3b8','#b45309'];
const PILLAR_BG = [
  'linear-gradient(180deg,#fbbf24,#f59e0b)',
  'linear-gradient(180deg,#cbd5e1,#94a3b8)',
  'linear-gradient(180deg,#d97706,#b45309)',
];
const PILLAR_H = [112, 80, 64];
const AVATAR_SIZE = [72, 56, 48];

function PodiumCard({ person, rank, isDark, onNavigate, sortKey }) {
  const idx = rank - 1;
  const isFirst = rank === 1;
  const statValue = sortKey === 'longestStreak'
    ? `🔥 ${person.longestStreak}`
    : sortKey === 'overallRate'
    ? `${person.overallRate}%`
    : `✅ ${person.totalDone}`;

  return (
    <div
      onClick={() => person.shareCode && onNavigate(`/u/${person.shareCode}`)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: person.shareCode ? 'pointer' : 'default',
        gap: 6,
      }}
    >
      <span style={{ fontSize: isFirst ? 28 : 22 }}>{MEDAL[idx]}</span>
      <div style={{
        padding: 3, borderRadius: '50%',
        boxShadow: `0 0 0 3px ${BORDER_COLOR[idx]}`,
        transition: 'transform 0.15s',
      }}>
        <AvatarCircle name={person.name} avatar={person.avatar} size={AVATAR_SIZE[idx]} />
      </div>
      <p style={{
        margin: '4px 0 0', fontWeight: 700, fontSize: 13,
        color: isDark ? '#fff' : '#111827',
        maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textAlign: 'center',
      }}>
        {person.name.slice(0, 12)}{person.name.length > 12 ? '…' : ''}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: isDark ? 'rgba(255,255,255,0.55)' : '#6b7280', textAlign: 'center' }}>
        {statValue}
      </p>
      {person.isCurrentUser && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: 'rgba(99,102,241,0.2)', color: '#818cf8',
        }}>You</span>
      )}
      {/* Pillar */}
      <div style={{
        width: 48, height: PILLAR_H[idx], marginTop: 6,
        background: PILLAR_BG[idx], borderRadius: '8px 8px 0 0',
      }} />
    </div>
  );
}

// ─── Ranked list row ──────────────────────────────────────────────────────────
function ListRow({ person, rank, isDark, onNavigate }) {
  const isYou = person.isCurrentUser;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 20px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}`,
        borderLeft: isYou ? '4px solid #6366f1' : '4px solid transparent',
        background: isYou
          ? isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)'
          : 'transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => {
        if (!isYou) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = isYou
          ? isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)'
          : 'transparent';
      }}
    >
      {/* Rank */}
      <span style={{ width: 28, fontWeight: 700, fontSize: 13, color: isDark ? 'rgba(255,255,255,0.35)' : '#9ca3af', flexShrink: 0 }}>
        #{rank}
      </span>

      {/* Avatar + Name */}
      <AvatarCircle name={person.name} avatar={person.avatar} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {person.shareCode && !isYou ? (
            <span
              onClick={() => onNavigate(`/u/${person.shareCode}`)}
              style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer',
                color: isDark ? '#e2e8f0' : '#111827',
                textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = '#6366f1'}
              onMouseLeave={e => e.currentTarget.style.color = isDark ? '#e2e8f0' : '#111827'}
            >
              {person.name}
            </span>
          ) : (
            <span style={{ fontWeight: 600, fontSize: 14, color: isDark ? '#e2e8f0' : '#111827' }}>
              {person.name}
            </span>
          )}
          {isYou && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
              background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              You
            </span>
          )}
        </div>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: isDark ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}>
          {person.totalHabits} habit{person.totalHabits !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
        <StatCell label="🔥 Streak" value={person.longestStreak} color="#f59e0b" isDark={isDark} />
        <StatCell label="📊 Rate" value={`${person.overallRate}%`} color="#6366f1" isDark={isDark} hideOnMobile />
        <StatCell label="✅ Done" value={person.totalDone} color="#10b981" isDark={isDark} hideOnMobile />
        {person.shareCode && !isYou ? (
          <button
            onClick={() => onNavigate(`/u/${person.shareCode}`)}
            style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
              color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)'}
          >
            View →
          </button>
        ) : !isYou ? (
          <span style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            color: isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
            userSelect: 'none',
          }}>
            —
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StatCell({ label, value, color, isDark, hideOnMobile }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 44, display: hideOnMobile ? undefined : undefined }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color }}>{value}</p>
      <p style={{ margin: 0, fontSize: 10, color: isDark ? 'rgba(255,255,255,0.35)' : '#9ca3af' }}>{label}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [sortKey, setSortKey] = useState('longestStreak');

  // Inject skeleton keyframe once
  React.useEffect(() => {
    if (document.getElementById('lb-skeleton-style')) return;
    const s = document.createElement('style');
    s.id = 'lb-skeleton-style';
    s.textContent = `
      @keyframes lbSkeletonPulse {
        0%   { background-position: 200% center; }
        100% { background-position: -200% center; }
      }
    `;
    document.head.appendChild(s);
  }, []);

  // ── Leaderboard data ──────────────────────────────────────────────────────
  const {
    data: board = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['social-leaderboard'],
    queryFn: () => api.get('/api/social/leaderboard').then((r) => r.data),
    staleTime: 60_000,
  });

  // ── Current user's shareCode ──────────────────────────────────────────────
  const { data: shareInfo } = useQuery({
    queryKey: ['my-share-info'],
    queryFn: () => api.get('/api/social/my-share').then((r) => r.data),
    staleTime: 300_000,
  });
  const myShareCode = shareInfo?.shareCode || null;

  // ── Enrich + sort ─────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const enriched = board.map((u) => ({
      ...u,
      isCurrentUser: !!(myShareCode && u.shareCode === myShareCode),
    }));
    return [...enriched].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [board, myShareCode, sortKey]);

  const podium = sorted.slice(0, 3);
  const rest   = sorted.slice(3);

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const cardBg     = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const cardBorder = isDark ? 'rgba(255,255,255,0.09)' : '#e5e7eb';
  const titleColor = isDark ? '#fff' : '#111827';
  const subtitleColor = isDark ? 'rgba(255,255,255,0.5)' : '#6b7280';

  return (
    <div style={{ minHeight: '100vh', background: isDark ? undefined : '#f9fafb' }}>
      <Navbar />

      {/* Inject keyframe for skeleton */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: titleColor, letterSpacing: '-0.5px' }}>
            🏆 Leaderboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: subtitleColor }}>
            Top StreakBoard users ranked by streak
          </p>
        </div>

        {/* ── Sort toggles ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap',
        }}>
          {SORT_OPTIONS.map((opt) => {
            const active = sortKey === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                style={{
                  padding: '8px 18px', borderRadius: 24, fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: 'pointer', transition: 'all 0.18s',
                  background: active
                    ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                    : isDark ? 'rgba(255,255,255,0.07)' : '#fff',
                  color: active ? '#fff' : isDark ? 'rgba(255,255,255,0.7)' : '#374151',
                  boxShadow: active
                    ? '0 4px 14px rgba(99,102,241,0.35)'
                    : isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.1)',
                  outline: active ? 'none' : `1px solid ${cardBorder}`,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {isLoading && (
          <>
            <div style={{
              background: cardBg, border: `1px solid ${cardBorder}`,
              borderRadius: 20, overflow: 'hidden', marginBottom: 16,
            }}>
              <SkeletonPodium isDark={isDark} />
            </div>
            <div style={{
              background: cardBg, border: `1px solid ${cardBorder}`,
              borderRadius: 20, overflow: 'hidden',
            }}>
              {[...Array(6)].map((_, i) => <SkeletonRow key={i} isDark={isDark} />)}
            </div>
          </>
        )}

        {/* ── Error ────────────────────────────────────────────────────── */}
        {isError && !isLoading && (
          <div style={{
            background: cardBg, border: `1px solid ${cardBorder}`,
            borderRadius: 20, padding: '60px 20px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 40, margin: '0 0 12px' }}>⚠️</p>
            <p style={{ fontWeight: 700, fontSize: 16, color: titleColor, margin: '0 0 6px' }}>
              Failed to load leaderboard.
            </p>
            <p style={{ fontSize: 13, color: subtitleColor, margin: '0 0 20px' }}>
              Check your connection and try again.
            </p>
            <button
              onClick={() => refetch()}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Empty ────────────────────────────────────────────────────── */}
        {!isLoading && !isError && sorted.length === 0 && (
          <div style={{
            background: cardBg, border: `1px solid ${cardBorder}`,
            borderRadius: 20, padding: '72px 20px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 48, margin: '0 0 14px' }}>🏆</p>
            <p style={{ fontWeight: 700, fontSize: 17, color: titleColor, margin: '0 0 8px' }}>
              No public profiles yet.
            </p>
            <p style={{ fontSize: 14, color: subtitleColor }}>
              Be the first on the leaderboard!
            </p>
          </div>
        )}

        {/* ── Podium (top 3) ───────────────────────────────────────────── */}
        {!isLoading && !isError && sorted.length >= 3 && (
          <div style={{
            background: cardBg, border: `1px solid ${cardBorder}`,
            borderRadius: 20, marginBottom: 16, overflow: 'hidden',
          }}>
            <p style={{
              textAlign: 'center', margin: '20px 0 0', fontSize: 11,
              fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: subtitleColor,
            }}>Top 3</p>
            <div style={{
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              gap: 24, padding: '16px 20px 28px',
            }}>
              {/* 2nd */}
              <PodiumCard person={podium[1]} rank={2} isDark={isDark} onNavigate={navigate} sortKey={sortKey} />
              {/* 1st */}
              <PodiumCard person={podium[0]} rank={1} isDark={isDark} onNavigate={navigate} sortKey={sortKey} />
              {/* 3rd */}
              <PodiumCard person={podium[2]} rank={3} isDark={isDark} onNavigate={navigate} sortKey={sortKey} />
            </div>
          </div>
        )}

        {/* ── Ranked list (4th+) ───────────────────────────────────────── */}
        {!isLoading && !isError && sorted.length > 0 && (
          <div style={{
            background: cardBg, border: `1px solid ${cardBorder}`,
            borderRadius: 20, overflow: 'hidden',
          }}>
            {/* Table header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '10px 20px',
              borderBottom: `1px solid ${cardBorder}`,
              background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
            }}>
              <span style={{ width: 28, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: subtitleColor }}>
                #
              </span>
              <span style={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: subtitleColor, marginLeft: 52 }}>
                Player
              </span>
              <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
                {['🔥 Streak','📊 Rate','✅ Done'].map((h) => (
                  <span key={h} style={{ minWidth: 44, textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: subtitleColor }}>
                    {h}
                  </span>
                ))}
                {/* spacer for view button column */}
                <span style={{ width: 60 }} />
              </div>
            </div>

            {/* If fewer than 4, show all. Otherwise only show from rank 4 */}
            {(sorted.length < 4 ? sorted : rest).map((person, i) => {
              const rankNum = sorted.length < 4 ? i + 1 : i + 4;
              return (
                <ListRow
                  key={person.shareCode || person.name + i}
                  person={person}
                  rank={rankNum}
                  isDark={isDark}
                  onNavigate={navigate}
                />
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
