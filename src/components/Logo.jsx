import logo from "@/assets/origami99-logo.png";
import logoWhite from "@/assets/origami99-logo-white.png";
function Logo({ className = "" }) {
  return <div className={`flex items-center ${className}`}>
      <img src={logo} alt="Origami99" className="h-9 w-auto dark:hidden" />
      <img src={logoWhite} alt="Origami99" className="hidden h-9 w-auto dark:block" />
    </div>;
}
export {
  Logo
};
