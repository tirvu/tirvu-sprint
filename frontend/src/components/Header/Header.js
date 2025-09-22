import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Header.css';

const Header = () => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-logo">
          <Link to="/dashboard">
            <img src="/favicon.png" alt="T-Flow" />
            <span className="header-title">T-Flow</span>
          </Link>
        </div>

        <div className="header-user">
          <div className="user-avatar">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <p className="user-name">{user?.name}</p>
            <p className="user-role">{user?.role === 'admin' ? 'Administrador' : 'Colaborador'}</p>
          </div>
          <div className="user-dropdown">
            <button className="logout-btn" onClick={logout}>
              <FontAwesomeIcon icon="fa-solid fa-sign-out-alt" /> Sair
            </button>
          </div>
        </div>

        <div className="header-mobile-toggle" onClick={toggleMobileMenu}>
          <FontAwesomeIcon icon={mobileMenuOpen ? 'fa-solid fa-times' : 'fa-solid fa-bars'} />
        </div>

      </div>

      {/* Menu móvel */}
      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <nav className="mobile-nav">
          <ul>
            <li>
              <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <FontAwesomeIcon icon="fa-solid fa-home" />&nbsp;
                <span>Dashboard</span>
              </Link>
            </li>
            <li>
              <Link to="/sprints" onClick={() => setMobileMenuOpen(false)}>
                <FontAwesomeIcon icon="fa-solid fa-tasks" />&nbsp;
                <span>Sprints</span>
              </Link>
            </li>
            <li>
              <Link to="/backlogs" onClick={() => setMobileMenuOpen(false)}>
                <FontAwesomeIcon icon="fa-solid fa-list" />&nbsp;
                <span>Backlogs</span>
              </Link>
            </li>
            <li>
              <Link to="/tasks" onClick={() => setMobileMenuOpen(false)}>
                <FontAwesomeIcon icon="fa-solid fa-clipboard-check" />&nbsp;
                <span>Tarefas</span>
              </Link>
            </li>
            {user?.role === 'admin' && (
              <li>
                <Link to="/users" onClick={() => setMobileMenuOpen(false)}>
                  <FontAwesomeIcon icon="fa-solid fa-users" />&nbsp;
                <span>Usuários</span>
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;