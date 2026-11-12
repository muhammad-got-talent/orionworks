import Logo from "./Logo.jsx";
import { Icon } from "./ui.jsx";

export function BrandName({ size = 30 }) {
  return <div className="brand"><Logo size={size} /><span>Orion Works</span></div>;
}

// Shared layout for setup and login: brand panel on the left (desktop) or a top band (phone).
export function AuthShell({ children }) {
  return (
    <main className="auth-shell">
      <aside className="brandpanel">
        <BrandName size={38} />
        <h2>Your AI employee that builds, tests and calls you.</h2>
        <ul>
          <li><Icon name="bolt" size={18} /><span>Plans, codes and tests real projects</span></li>
          <li><Icon name="phone" size={18} /><span>Rings your phone when it has news</span></li>
          <li><Icon name="key" size={18} /><span>Your keys and your data. Open source.</span></li>
        </ul>
      </aside>
      <div className="auth-main">{children}</div>
    </main>
  );
}
