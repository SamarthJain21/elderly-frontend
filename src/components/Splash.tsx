/**
 * Shown while the app works out where to go and in which language — instead of flashing a screen (or English) and
 * then switching. No words, so it's right in every language.
 */
export function Splash({ framed = true }: { framed?: boolean }) {
  return (
    <div className={`shell ${framed ? 'framed' : ''}`} aria-busy="true" aria-label="Loading">
      <div className="splash"><span className="logo splash-logo">♥</span><div className="spinner" aria-hidden /></div>
    </div>
  )
}
