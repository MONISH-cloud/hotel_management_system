'use client';

// Last-resort boundary: replaces the root layout when even that fails, so it must be self-contained
// (own <html>/<body>, inline styles, no providers, no CSS file, no database).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#07080a', color: '#f6f1e7', fontFamily: 'Georgia, serif', textAlign: 'center', padding: 24 }}>
        <div>
          <p style={{ letterSpacing: '0.3em', textTransform: 'uppercase', fontSize: 12, color: '#cbab6a', margin: 0, fontFamily: 'system-ui, sans-serif' }}>Service interruption</p>
          <h1 style={{ fontSize: 48, fontWeight: 500, margin: '16px 0' }}>We&apos;ll be right back.</h1>
          <p style={{ color: '#cfc8ba', fontFamily: 'system-ui, sans-serif', maxWidth: 420, margin: '0 auto 28px' }}>The site hit a serious problem. Please try again in a moment.</p>
          <button onClick={reset} style={{ background: '#cbab6a', color: '#1b1405', border: 0, borderRadius: 999, padding: '14px 28px', fontWeight: 700, cursor: 'pointer', fontFamily: 'system-ui, sans-serif' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
