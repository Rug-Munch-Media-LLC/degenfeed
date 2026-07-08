import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'DegenFeed — The social feed of web3';
export const size = { width: 1200, height: 630 };

export const contentType = 'image/png';

export default function Image() {
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
          background: 'linear-gradient(135deg, #000000 0%, #0a0f0a 50%, #000000 100%)',
          fontFamily: 'Inter',
        }}
      >
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.03,
            backgroundImage:
              'radial-gradient(circle at 30% 50%, #00ff41 0%, transparent 60%), radial-gradient(circle at 70% 50%, #00ff41 0%, transparent 60%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 96,
            fontWeight: 900,
            color: '#00ff41',
            letterSpacing: '-0.03em',
            textShadow: '0 0 80px rgba(0, 255, 65, 0.3), 0 0 160px rgba(0, 255, 65, 0.15)',
            marginBottom: 24,
          }}
        >
          DegenFeed
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 32,
            fontWeight: 500,
            color: '#9ca3af',
            marginBottom: 80,
          }}
        >
          The social feed of web3
        </div>
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: 60,
            left: 0,
            right: 0,
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 400,
            color: '#4b5563',
          }}
        >
          degenfeed.xyz &middot; Open source, zero sign-ups
        </div>
      </div>
    ),
    { ...size },
  );
}
