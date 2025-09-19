import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../helpers/Constants';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Verificar se há um token no localStorage
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(API_ENDPOINTS.LOGIN, {
        email,
        password
      });
      
      const { user, token } = response.data;
      
      // Salvar no localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Configurar o axios para enviar o token em todas as requisições
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      return user;
    } catch (error) {
      setError(error.response?.data?.message || 'Erro ao fazer login');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const isAuthenticated = () => !!user;

  const isAdmin = () => user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        isAuthenticated,
        isAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);