import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
function AuthCard({ title, subtitle, children }) {
  return <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md rounded-3xl p-8">
        <div className="flex items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <h1 className="mt-8 text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>;
}
export {
  AuthCard
};
