import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login/Login';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import Sprints from './pages/Sprints/Sprints';
import Backlogs from './pages/Backlogs/Backlogs';
import Tasks from './pages/Tasks/Tasks';
import { ToastContainer } from './components/Toast/Toast';

import Users from './pages/Users/Users';
import './styles/global.css';

// Importar Font Awesome
import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';

// Adicionar ícones ao library
library.add(fas, far);

// Componente de proteção de rotas
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Carregando...</div>;
  }
  
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Componente de rota apenas para administradores
const AdminRoute = ({ children }) => {
  const { isAdmin, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Carregando...</div>;
  }
  
  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// Componente de rota para não-colaboradores (admin ou outros roles futuros)
const NonCollaboratorRoute = ({ children }) => {
  const { isCollaborator, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Carregando...</div>;
  }
  
  if (isCollaborator()) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <ToastContainer />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="sprints" element={
              <NonCollaboratorRoute>
                <Sprints />
              </NonCollaboratorRoute>
            } />
            <Route path="backlogs" element={
              <NonCollaboratorRoute>
                <Backlogs />
              </NonCollaboratorRoute>
            } />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="users" element={
              <AdminRoute>
                <Users />
              </AdminRoute>
            } />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
