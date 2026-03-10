'use client';

import { useEffect, useState } from 'react';

export function SplashScreen() {
  const [fadeOut, setFadeOut] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFadeOut(true), 2400);
    const t2 = setTimeout(() => setDone(true), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (done) return null;

  return (
    <>
      <style>{`
        @keyframes splash-icon-in {
          0%   { opacity: 0; transform: scale(0.72); }
          60%  { opacity: 1; transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes splash-glow-outer {
          0%, 100% { opacity: 0.10; transform: scale(1); }
          50%       { opacity: 0.22; transform: scale(1.14); }
        }
        @keyframes splash-glow-inner {
          0%, 100% { opacity: 0.14; transform: scale(1); }
          50%       { opacity: 0.28; transform: scale(1.09); }
        }
        @keyframes splash-text-in {
          from { opacity: 0; transform: translateY(8px); letter-spacing: 6px; }
          to   { opacity: 1; transform: translateY(0);  letter-spacing: 4px; }
        }
        @keyframes splash-bar-in {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
      `}</style>

      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#080c1a',
          opacity: fadeOut ? 0 : 1,
          transition: 'opacity 0.6s ease-in-out',
          pointerEvents: fadeOut ? 'none' : 'auto',
        }}
      >
        {/* Icon + glow container — same size as hero: h-36 = 144px icon */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 320,
            height: 320,
          }}
        >
          {/* Outer ambient glow */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(3,185,255,0.13) 0%, transparent 70%)',
              animation: 'splash-glow-outer 2.6s ease-in-out infinite',
            }}
          />
          {/* Mid glow */}
          <div
            style={{
              position: 'absolute',
              inset: '22%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(3,185,255,0.20) 0%, transparent 70%)',
              animation: 'splash-glow-inner 2.6s ease-in-out 0.5s infinite',
            }}
          />
          {/* Inner glow */}
          <div
            style={{
              position: 'absolute',
              inset: '38%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(3,185,255,0.28) 0%, transparent 70%)',
              animation: 'splash-glow-inner 2.6s ease-in-out 0.9s infinite',
            }}
          />

          {/* Icon — h-36 matches hero exactly */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="630 1050 760 505"
            style={{
              position: 'relative',
              height: 144,
              width: 'auto',
              filter:
                'drop-shadow(0 0 28px rgba(3,185,255,0.85)) drop-shadow(0 0 10px rgba(3,185,255,0.55)) drop-shadow(0 8px 16px rgba(0,0,0,0.55))',
              animation: 'splash-icon-in 0.85s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
            aria-hidden="true"
          >
            <path
              fill="#03b9ff"
              d="M1260.11,1059.79h-80.94a115.88,115.88,0,0,0-94.86,49.38l-10,14.23L1052,1155.31a52.2,52.2,0,0,1-85.53,0l-22.36-31.91-10-14.23a115.88,115.88,0,0,0-94.85-49.38h-81a116,116,0,0,0-115.83,115.83v248.76a116,116,0,0,0,115.83,115.83h81a115.88,115.88,0,0,0,94.85-49.38l10-14.23,22.36-31.91a52.2,52.2,0,0,1,85.53,0l22.37,31.91,10,14.23a115.88,115.88,0,0,0,94.86,49.38h80.94a116,116,0,0,0,115.83-115.83V1175.62A116,116,0,0,0,1260.11,1059.79Zm52.23,268.41v96.18a52.28,52.28,0,0,1-52.23,52.22h-80.94a52.21,52.21,0,0,1-42.77-22.27l-32.32-46.14a115.82,115.82,0,0,0-189.75,0L882,1454.35a52.29,52.29,0,0,1-42.76,22.25h-81a52.27,52.27,0,0,1-52.22-52.22V1175.62a52.27,52.27,0,0,1,52.22-52.22h81A52.29,52.29,0,0,1,882,1145.65l32.31,46.14a115.82,115.82,0,0,0,189.75,0l32.32-46.14a52.21,52.21,0,0,1,42.77-22.27h80.94a52.28,52.28,0,0,1,52.23,52.22Z"
            />
            <path
              fill="#03b9ff"
              d="M1009.21,1256.44a43.56,43.56,0,1,0,43.56,43.56A43.56,43.56,0,0,0,1009.21,1256.44Z"
            />
          </svg>
        </div>

        {/* Brand name */}
        <div
          style={{
            marginTop: 20,
            color: '#03b9ff',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            animation: 'splash-text-in 0.55s ease 0.55s both',
          }}
        >
          Hireverse AI
        </div>

        {/* Thin progress bar */}
        <div
          style={{
            marginTop: 36,
            width: 80,
            height: 1,
            backgroundColor: 'rgba(3,185,255,0.2)',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: 'rgba(3,185,255,0.7)',
              transformOrigin: 'left center',
              animation: 'splash-bar-in 2s ease-in-out 0.4s both',
            }}
          />
        </div>
      </div>
    </>
  );
}
