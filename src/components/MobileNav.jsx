import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, CalendarCheck, Umbrella, Wallet, User } from 'lucide-react';
import './MobileNav.css';

const MobileNav = () => {
  return (
    <nav className="mobile-bottom-nav">
      <NavLink to="/dashboard" className={({ isActive }) => `m-nav-item ${isActive ? 'active' : ''}`}>
        <Home size={22} className="m-nav-icon" />
        <span>Home</span>
      </NavLink>
      <NavLink to="/attendance" className={({ isActive }) => `m-nav-item ${isActive ? 'active' : ''}`}>
        <CalendarCheck size={22} className="m-nav-icon" />
        <span>Attendance</span>
      </NavLink>
      <NavLink to="/leave" className={({ isActive }) => `m-nav-item ${isActive ? 'active' : ''}`}>
        <Umbrella size={22} className="m-nav-icon" />
        <span>Leave</span>
      </NavLink>
      <NavLink to="/allowance" className={({ isActive }) => `m-nav-item ${isActive ? 'active' : ''}`}>
        <Wallet size={22} className="m-nav-icon" />
        <span>Allowance</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => `m-nav-item ${isActive ? 'active' : ''}`}>
        <User size={22} className="m-nav-icon" />
        <span>Profile</span>
      </NavLink>
    </nav>
  );
};

export default MobileNav;
