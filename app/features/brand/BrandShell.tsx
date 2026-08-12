import { Link } from "react-router";

export function BrandShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="brand-app-shell">
      <a className="skip-link" href="#main-content">
        Skip to the story
      </a>
      <BrandHeader />
      {children}
      <BrandFooter />
    </div>
  );
}

export function BrandHeader() {
  return (
    <header className="brand-header" aria-label="MemoriesMyStory">
      <div className="brand-header-inner">
        <BrandLink />
        <nav className="brand-desktop-nav" aria-label="Primary navigation">
          <a href="/#how-it-works">How It Works</a>
          <a href="/#memory-circle">Memory Circle</a>
          <a href="/#pricing">Pricing</a>
          <a href="/#faq">FAQ</a>
        </nav>
        <div className="brand-header-actions">
          <Link className="brand-sign-in" to="/auth/protect">
            Sign In
          </Link>
          <Link className="brand-primary-button" to="/auth/protect?intent=free&from=header">
            Create Your First Living Memory
          </Link>
          <details className="brand-mobile-menu">
            <summary aria-label="Open navigation">Menu</summary>
            <nav aria-label="Mobile navigation">
              <a href="/#how-it-works">How It Works</a>
              <a href="/#memory-circle">Memory Circle</a>
              <a href="/#pricing">Pricing</a>
              <a href="/#faq">FAQ</a>
              <Link to="/auth/protect">Sign In</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function BrandLink() {
  return (
    <Link className="new-brand-lockup" to="/" aria-label="MemoriesMyStory home">
      <BrandMark />
      <span className="new-brand-copy">
        <strong>MemoriesMyStory</strong>
        <small>Living memories. Lasting legacy.</small>
      </span>
    </Link>
  );
}

export function BrandMark() {
  return (
    <svg className="new-brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <path
        className="new-brand-heart"
        d="M32 54S9 41 9 23.5C9 15.5 14.7 10 22.2 10c4.4 0 7.8 2.1 9.8 5.2C34 12.1 37.4 10 41.8 10 49.3 10 55 15.5 55 23.5 55 41 32 54 32 54Z"
      />
      <path className="new-brand-wave" d="M18 31h5l2.5-7 4.3 14 4.1-11 3.2 8 2.2-4H46" />
    </svg>
  );
}

export function BrandFooter() {
  return (
    <footer className="brand-footer">
      <div className="brand-footer-inner">
        <BrandLink />
        <p>
          Keep the photograph, the real voice, and the story together for the people you love.
        </p>
        <nav aria-label="Footer navigation">
          <a href="/#privacy">Privacy</a>
          <a href="/#trust">Trust</a>
          <a href="/#faq">Accessibility</a>
          <Link to="/auth/protect">Sign In</Link>
        </nav>
      </div>
    </footer>
  );
}
