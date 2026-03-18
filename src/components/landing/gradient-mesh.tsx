'use client';

export function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Cyan blob */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-25 blur-[120px]"
        style={{
          background: '#03b9ff',
          top: '-10%',
          left: '20%',
          animation: 'meshFloat1 20s ease-in-out infinite',
        }}
      />
      {/* Navy blob */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-30 blur-[100px]"
        style={{
          background: '#1a1a3e',
          top: '30%',
          right: '10%',
          animation: 'meshFloat2 25s ease-in-out infinite',
        }}
      />
      {/* Deep blue blob */}
      <div
        className="absolute w-[700px] h-[700px] rounded-full opacity-20 blur-[140px]"
        style={{
          background: '#0a2540',
          bottom: '-20%',
          left: '-10%',
          animation: 'meshFloat3 22s ease-in-out infinite',
        }}
      />
      {/* Purple accent blob */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]"
        style={{
          background: '#2d1b69',
          top: '50%',
          left: '50%',
          animation: 'meshFloat4 18s ease-in-out infinite',
        }}
      />

      <style jsx>{`
        @keyframes meshFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(60px, -40px) scale(1.1); }
          66% { transform: translate(-30px, 50px) scale(0.95); }
        }
        @keyframes meshFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-50px, 30px) scale(1.05); }
          66% { transform: translate(40px, -60px) scale(0.9); }
        }
        @keyframes meshFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, 40px) scale(1.08); }
          66% { transform: translate(-60px, -20px) scale(0.92); }
        }
        @keyframes meshFloat4 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-40px, -30px) scale(1.15); }
        }
      `}</style>
    </div>
  );
}
