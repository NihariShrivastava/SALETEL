import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, IndianRupee, History, Users, FileText, UserCog, Building2, FileBarChart } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Sidebar() {
  const location = useLocation();
  const currentPath = location.pathname + location.search;

  const navItems = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard Overview' },
    { to: '/admin/submissions', icon: History, label: 'Submissions Log' },
    { to: '/admin/domains', icon: Users, label: 'Domain Management' },
    { to: '/admin/counters', icon: CheckSquare, label: 'Counter Management' },
    { to: '/admin/surveyors', icon: UserCog, label: 'Role Management' },
    { to: '/admin/reports', icon: FileBarChart, label: 'Master Reports' },
  ];

  return (
    <aside className="w-64 bg-bg-secondary border-r border-bg-border flex flex-col h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="p-4">
        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentPath === item.to || (item.to === '/admin/submissions' && currentPath === '/admin/submissions');
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
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
    </aside>
  );
}
