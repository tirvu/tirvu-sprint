import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Sidebar.css';

const Sidebar = () => {
  const { user, logout, isAdmin, isCollaborator } = useAuth();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <img src="/favicon.png" alt="Tirvu Sprint" className="sidebar-logo" />
        <h3>Tirvu Sprint</h3>
      </div>
      
      <nav className="sidebar-nav">
        <ul>
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
              <FontAwesomeIcon icon="fa-solid fa-home" />&nbsp;
              <span>Dashboard</span>
            </NavLink>
          </li>
          {!isCollaborator() && (
            <>
              <li>
                <NavLink to="/sprints" className={({ isActive }) => isActive ? 'active' : ''}>
                  <FontAwesomeIcon icon="fa-solid fa-tasks" />&nbsp;
                  <span>Sprints</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/backlogs" className={({ isActive }) => isActive ? 'active' : ''}>
                  <FontAwesomeIcon icon="fa-solid fa-list" />&nbsp;
                  <span>Backlogs</span>
                </NavLink>
              </li>
            </>
          )}
          <li>
            <NavLink to="/tasks" className={({ isActive }) => isActive ? 'active' : ''}>
              <FontAwesomeIcon icon="fa-solid fa-clipboard-check" />&nbsp;
              <span>Tarefas</span>
            </NavLink>
          </li>
          {isAdmin() && (
            <li>
              <NavLink to="/users" className={({ isActive }) => isActive ? 'active' : ''}>
                <FontAwesomeIcon icon="fa-solid fa-users" />&nbsp;
                <span>Usuários</span>
              </NavLink>
            </li>
          )}
        </ul>
      </nav>
      
      <div className="sidebar-footer">
        <button onClick={logout} className="logout-btn" style={{color: 'white'}}>
          <FontAwesomeIcon icon="fa-solid fa-sign-out-alt" />&nbsp;
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;