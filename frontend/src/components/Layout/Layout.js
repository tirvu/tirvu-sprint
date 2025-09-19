import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import BottomNavigation from '../BottomNavigation/BottomNavigation';
import './Layout.css';

const Layout = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-wrapper">
        <Header />
        <main className="main-content">
          <Outlet />
        </main>
        <BottomNavigation />
      </div>
    </div>
  );
};

export default Layout;