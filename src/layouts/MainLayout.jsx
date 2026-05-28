import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import MobileNav from '../components/MobileNav';
import { useLocation } from 'react-router-dom';
import './MainLayout.css';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const isDashboard = location.pathname === '/dashboard';

  return (
    <div className="app-container">
      <div className="desktop-sidebar-wrapper">
        <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      </div>
      <main className={`main-content ${sidebarOpen ? '' : 'sidebar-closed'} ${isDashboard ? 'on-dashboard' : ''}`}>
        <div className="desktop-navbar-wrapper">
          <Navbar toggleSidebar={toggleSidebar} />
        </div>
        <div className={`page-content ${isDashboard ? 'no-padding-mobile' : ''}`}>
          <Outlet />
        </div>
      </main>
      <MobileNav />
    </div>
  );
};

export default MainLayout;
