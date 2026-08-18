import React from 'react';
import { Outlet } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar';
import Sidebar from '../../components/layout/Sidebar';
import FilterBar from '../../components/layout/FilterBar';

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col font-sans">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <FilterBar />
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
