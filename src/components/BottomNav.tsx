import { NavLink, useLocation } from 'react-router-dom';
import { ScanLine, Clock, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function BottomNav() {
  const location = useLocation();
  const { signOut } = useAuth();

  const navItems = [
    { path: '/scan', label: 'Scan', icon: ScanLine },
    { path: '/history', label: 'History', icon: Clock },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
        <button
          onClick={signOut}
          className="flex flex-col items-center justify-center flex-1 h-full text-muted-foreground hover:text-destructive transition-colors"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-xs mt-1 font-medium">Logout</span>
        </button>
      </div>
    </nav>
  );
}
