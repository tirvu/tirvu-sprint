import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './BottomNavigation.css';

const BottomNavigation = () => {
  const { isAdmin } = useAuth();

  return (
    <div className="bottom-navigation">
      <NavLink to="/dashboard" className="nav-item">
        <FontAwesomeIcon icon="fa-solid fa-home" />
        <span>Dashboard</span>
      </NavLink>
      
      <NavLink to="/sprints" className="nav-item">
        <FontAwesomeIcon icon="fa-solid fa-tasks" />
        <span>Sprints</span>
      </NavLink>
      
      <NavLink to="/backlogs" className="nav-item">
        <FontAwesomeIcon icon="fa-solid fa-list" />
        <span>Backlogs</span>
      </NavLink>
      
      <NavLink to="/tasks" className="nav-item">
        <FontAwesomeIcon icon="fa-solid fa-clipboard-check" />
        <span>Tarefas</span>
      </NavLink>
      
      {isAdmin() && (
        <NavLink to="/users" className="nav-item">
          <FontAwesomeIcon icon="fa-solid fa-users" />
          <span>Usuários</span>
        </NavLink>
      )}
    </div>
  );
};

export default BottomNavigation;