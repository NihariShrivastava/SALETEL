import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, IndianRupee, History, Users, FileText, UserCog, Building2, FileBarChart, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname + location.search;

  const navItems: Array<{ to: string, icon: any, label: string, badge?: string | number }> = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard Overview' },
    { to: '/admin/submissions', icon: History, label: 'Submissions Log' },
    { to: '/admin/domains', icon: Users, label: 'Domain Management' },
    { to: '/admin/counters', icon: CheckSquare, label: 'Counter Management' },
    { to: '/admin/surveyors', icon: UserCog, label: 'Role Management' },
    { to: '/admin/settings', icon: Settings, label: 'Telecaller Lead Setting' },
    { to: '/admin/lead-status', icon: FileBarChart, label: 'Lead Status Count' },
    { to: '/admin/reports', icon: FileBarChart, label: 'Master Reports' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <aside className={cn(
        "bg-bg-secondary border-r border-bg-border flex flex-col h-[calc(100vh-4rem)] overflow-y-auto transition-transform duration-300 z-50",
        "fixed md:static w-64 shadow-2xl md:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-4">
        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentPath === item.to || (item.to === '/admin/submissions' && currentPath === '/admin/submissions');
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => { if (window.innerWidth < 768 && onClose) onClose(); }}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors group",
                  isActive 
                    ? "bg-accent-blue text-white" 
                    : "text-text-secondary hover:bg-bg-hover hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn("w-5 h-5", "group-hover:text-white transition-colors")} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-accent-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
      
      {isOpen && (
        <div className="mt-auto p-4 md:hidden border-t border-bg-border text-center">
          <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">SALETEL v2.0</p>
        </div>
      )}
    </aside>
    </>
  );
}
