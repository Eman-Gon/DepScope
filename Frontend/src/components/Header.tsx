import { Shield } from 'lucide-react';

const Header = () => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 glow-blue">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-foreground">Dep</span>
            <span className="text-primary">Scope</span>
          </h1>
        </div>
      </div>
    </header>
  );
};

export default Header;
