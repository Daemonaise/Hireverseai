import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Hireverse AI | Expert Freelance Work, Delivered Faster';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0a1628 0%, #121c30 40%, #0d1a2e 100%)',
          color: 'white',
          fontFamily: 'Inter, sans-serif',
          padding: '60px 80px',
        }}
      >
        {/* Logo circle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(3, 185, 255, 0.15)',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: '#03b9ff',
              transform: 'rotate(45deg)',
            }}
          />
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '56px',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              marginBottom: '16px',
            }}
          >
            Expert work done,{' '}
            <span style={{ color: '#03b9ff' }}>faster than ever</span>
          </div>

          <div
            style={{
              fontSize: '24px',
              color: 'rgba(255, 255, 255, 0.6)',
              maxWidth: '700px',
              lineHeight: 1.4,
            }}
          >
            Describe your project. AI handles the rest: matching,
            decomposition, quality assurance, delivery.
          </div>
        </div>

        {/* Beta badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '40px',
            padding: '8px 20px',
            borderRadius: '999px',
            border: '1px solid rgba(3, 185, 255, 0.3)',
            background: 'rgba(3, 185, 255, 0.1)',
          }}
        >
          <div
            style={{
              padding: '2px 10px',
              borderRadius: '999px',
              background: '#03b9ff',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            BETA
          </div>
          <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
            Now accepting freelancers and clients
          </span>
        </div>

        {/* Domain */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.3)',
          }}
        >
          hireverse.ai
        </div>
      </div>
    ),
    { ...size }
  );
}
