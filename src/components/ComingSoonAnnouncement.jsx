// TO REMOVE THIS FEATURE:
// 1. Delete this file
// 2. Remove import from App.jsx
// 3. Remove <ComingSoonAnnouncement /> from App.jsx
// That's it — no other files affected

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

const POPUP_LS_KEY = 'comingSoonLastShown';
const BANNER_SESSION_KEY = 'comingSoonBannerHidden';
const ONE_DAY_MS = 86_400_000;

const FEATURES = [
  {
    emoji: '🖼️',
    name: 'Profile Pictures',
    desc: 'Upload your avatar',
    badge: 'In Progress',
    badgeColor: '#22c55e',
    badgeBg: 'rgba(34,197,94,0.15)',
  },
  {
    emoji: '💬',
    name: 'Personal Chat',
    desc: 'Chat with friends',
    badge: 'Soon',
    badgeColor: '#60a5fa',
    badgeBg: 'rgba(96,165,250,0.15)',
  },
  {
    emoji: '🏆',
    name: '100-Day Rewards',
    desc: 'Complete streaks, earn badges',
    badge: 'Soon',
    badgeColor: '#a78bfa',
    badgeBg: 'rgba(167,139,250,0.15)',
  },
  {
    emoji: '📱',
    name: 'Mobile App',
    desc: 'iOS & Android app',
    badge: 'Planning',
    badgeColor: '#fb923c',
    badgeBg: 'rgba(251,146,60,0.15)',
  },
  {
    emoji: '🔔',
    name: 'Smart Notifications',
    desc: 'Tap to mark from notification',
    badge: 'In Progress',
    badgeColor: '#22c55e',
    badgeBg: 'rgba(34,197,94,0.15)',
  },
  {
    emoji: '🌐',
    name: 'Browser Extension',
    desc: 'Quick habit tracking',
    badge: 'Planning',
    badgeColor: '#fb923c',
    badgeBg: 'rgba(251,146,60,0.15)',
  },
];

const MARQUEE_TEXT =
  '🚀 Coming Soon: Profile Pictures  •  💬 Personal Chat  •  🏆 100-Day Streak Rewards  •  📱 Mobile App  •  🔔 Tap-to-Mark Notifications  •  🌐 Browser Extension  •  👥 Friend Activity Alerts  •  ';

// ─── CSS injected once ───────────────────────────────────────────────────────
const CSS = `
@keyframes csaMarquee {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes csaBlink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
@keyframes csaFadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes csaModalIn {
  from { opacity: 0; transform: scale(0.92) translateY(16px); }
  to   { opacity: 1; transform: scale(1)   translateY(0); }
}
`;

let cssInjected = false;
function ensureCss() {
  if (cssInjected) return;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
  cssInjected = true;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ComingSoonAnnouncement() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Banner: hidden per session via sessionStorage
  const [bannerVisible, setBannerVisible] = useState(
    () => !sessionStorage.getItem(BANNER_SESSION_KEY)
  );

  // Popup
  const [popupVisible, setPopupVisible] = useState(false);
  const popupShownRef = useRef(false);

  useEffect(() => {
    ensureCss();

    // Popup: show once per 24 h
    if (popupShownRef.current) return;
    const timer = setTimeout(() => {
      const last = parseInt(localStorage.getItem(POPUP_LS_KEY) || '0', 10);
      if (Date.now() - last >= ONE_DAY_MS) {
        setPopupVisible(true);
        localStorage.setItem(POPUP_LS_KEY, String(Date.now()));
      }
      popupShownRef.current = true;
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const dismissBanner = () => {
    sessionStorage.setItem(BANNER_SESSION_KEY, '1');
    setBannerVisible(false);
  };

  const closePopup = () => setPopupVisible(false);

  // Shift app body down when banner is visible
  useEffect(() => {
    document.body.style.paddingTop = bannerVisible ? '36px' : '0px';
    return () => { document.body.style.paddingTop = '0px'; };
  }, [bannerVisible]);

  return (
    <>
      {/* ── PART 1: Scrolling Banner ────────────────────────────────── */}
      {bannerVisible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '36px',
            zIndex: 9998,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            animation: 'csaFadeIn 0.4s ease',
          }}
        >
          {/* NEW badge */}
          <div
            style={{
              flexShrink: 0,
              marginLeft: '10px',
              background: 'rgba(255,255,255,0.25)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              padding: '2px 7px',
              borderRadius: '4px',
              animation: 'csaBlink 1.4s ease-in-out infinite',
              userSelect: 'none',
            }}
          >
            NEW
          </div>

          {/* Marquee container */}
          <div
            style={{
              flex: 1,
              overflow: 'hidden',
              position: 'relative',
              marginLeft: '8px',
              marginRight: '4px',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                whiteSpace: 'nowrap',
                animation: 'csaMarquee 28s linear infinite',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'Inter, system-ui, sans-serif',
                lineHeight: '36px',
              }}
            >
              {/* Duplicate text for seamless loop */}
              {MARQUEE_TEXT}
              {MARQUEE_TEXT}
            </div>
          </div>

          {/* Dismiss button */}
          <button
            onClick={dismissBanner}
            aria-label="Close announcement banner"
            style={{
              flexShrink: 0,
              marginRight: '10px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.35)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
          >
            ×
          </button>
        </div>
      )}

      {/* ── PART 2: Popup Modal ─────────────────────────────────────── */}
      {popupVisible && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closePopup(); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: isDark ? '#0f172a' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(99,102,241,0.3)' : '#e5e7eb'}`,
              borderRadius: '20px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
              padding: '32px 28px 24px',
              animation: 'csaModalIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2
                style={{
                  margin: '0 0 8px',
                  fontSize: '22px',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                🚀 What's Coming to StreakBoard
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  color: isDark ? '#94a3b8' : '#6b7280',
                }}
              >
                We're working hard on these features!
              </p>
            </div>

            {/* Feature cards grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '24px',
              }}
            >
              {FEATURES.map((f) => (
                <div
                  key={f.name}
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
                    borderRadius: '14px',
                    padding: '14px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = isDark
                      ? '0 8px 24px rgba(99,102,241,0.15)'
                      : '0 8px 20px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span style={{ fontSize: '24px', lineHeight: 1 }}>{f.emoji}</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: isDark ? '#e2e8f0' : '#111827',
                    }}
                  >
                    {f.name}
                  </span>
                  <span
                    style={{
                      fontSize: '11.5px',
                      color: isDark ? '#64748b' : '#6b7280',
                      lineHeight: 1.4,
                    }}
                  >
                    {f.desc}
                  </span>
                  <span
                    style={{
                      marginTop: '4px',
                      alignSelf: 'flex-start',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      color: f.badgeColor,
                      background: f.badgeBg,
                      border: `1px solid ${f.badgeColor}40`,
                      padding: '2px 8px',
                      borderRadius: '20px',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {f.badge}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <button
              onClick={closePopup}
              style={{
                width: '100%',
                padding: '13px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.2s, transform 0.15s',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '0.92';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Got it, can't wait! →
            </button>
            <p
              style={{
                margin: '10px 0 0',
                textAlign: 'center',
                fontSize: '12px',
                color: isDark ? '#475569' : '#9ca3af',
              }}
            >
              New features drop every week
            </p>
          </div>
        </div>
      )}
    </>
  );
}
