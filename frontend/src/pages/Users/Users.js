import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../../helpers/Constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import './Users.css';

const Users = () => {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'collaborator',
    capacity: 8
  });
  const [editingUserId, setEditingUserId] = useState(null);

  // Verificar se o usuário é admin
  useEffect(() => {
    if (!isAdmin()) {
      setError('Acesso negado. Apenas administradores podem acessar esta página.');
      return;
    }
    
    // Buscar usuários
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await axios.get(API_ENDPOINTS.USERS);
        setUsers(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
        setError('Erro ao carregar usuários. Por favor, tente novamente.');
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isAdmin]);

  // Manipular mudanças no formulário
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Abrir modal de edição
  const handleOpenEditModal = (user) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      capacity: user.capacity || 8
    });
    setEditingUserId(user.id);
    setShowEditModal(true);
  };

  // Abrir modal de criação
  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'collaborator'
    });
    setShowCreateModal(true);
  };

  // Enviar formulário de criação
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const response = await axios.post(API_ENDPOINTS.USERS, formData);
      setUsers(prev => [response.data, ...prev]);
      setShowCreateModal(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'collaborator'
      });
      setLoading(false);
    } catch (err) {
      console.error('Erro ao criar usuário:', err);
      setError('Erro ao criar usuário. Por favor, tente novamente.');
      setLoading(false);
    }
  };

  // Enviar formulário de edição
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Se a senha estiver vazia, remova-a do objeto para não atualizar a senha
      const userData = {...formData};
      if (!userData.password) {
        delete userData.password;
      }
      
      const response = await axios.put(`${API_ENDPOINTS.USERS}/${editingUserId}`, userData);
      setUsers(prev => prev.map(u => u.id === editingUserId ? response.data : u));
      setShowEditModal(false);
      setEditingUserId(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'collaborator'
      });
      setLoading(false);
    } catch (err) {
      console.error('Erro ao atualizar usuário:', err);
      setError('Erro ao atualizar usuário. Por favor, tente novamente.');
      setLoading(false);
    }
  };

  // Abrir modal de confirmação de exclusão
  const handleOpenDeleteModal = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  // Excluir usuário
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      await axios.delete(`${API_ENDPOINTS.USERS}/${userToDelete.id}`);
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (err) {
      console.error('Erro ao excluir usuário:', err);
      setError('Erro ao excluir usuário. Por favor, tente novamente.');
    }
  };

  // Obter label de função
  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'collaborator': return 'Usuário';
      default: return role;
    }
  };

  // Obter classe de função
  const getRoleClass = (role) => {
    switch (role) {
      case 'admin': return 'role-admin';
      case 'collaborator': return 'role-user';
      default: return '';
    }
  };

  if (loading && users.length === 0) {
    return <div className="users-loading">Carregando...</div>;
  }

  if (error && !isAdmin()) {
    return <div className="users-error">{error}</div>;
  }

  return (
    <>
      <div className="users-container">
        <div className="users-header">
          <h1>Usuários</h1>
          <button 
            className="btn-add-user" 
            onClick={handleOpenCreateModal}
          >
            Novo Usuário
          </button>
        </div>

        {error && <div className="users-error">{error}</div>}

        <div className="users-list">
          {users.length === 0 ? (
            <div className="no-users-message">
              <p>Nenhum usuário encontrado.</p>
            </div>
          ) : (
            <Table
              columns={[
                {
                  key: 'name',
                  header: 'Nome',
                  sortable: true
                },
                {
                  key: 'email',
                  header: 'Email',
                  sortable: true
                },
                {
                  key: 'role',
                  header: 'Função',
                  sortable: true,
                  render: (user) => (
                    <span className={`user-role ${getRoleClass(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  )
                }
              ]}
              data={users}
              actions={(userData) => (
                <div className="user-actions">
                  <button 
                    className="btn-edit-user"
                    title="Editar"
                    onClick={() => handleOpenEditModal(userData)}
                  >
                    <FontAwesomeIcon icon="fa-solid fa-edit" />
                  </button>
                  
                  {userData.id !== user.id && (
                    <button 
                      className="btn-delete-user"
                      title="Excluir"
                      onClick={() => handleOpenDeleteModal(userData)}
                    >
                      <FontAwesomeIcon icon="fa-solid fa-trash" />
                    </button>
                  )}
                </div>
              )}
            />
          )}
        </div>
      </div>

      {/* Modal de Criação de Usuário */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Novo Usuário"
      >
        <form onSubmit={handleCreateSubmit} className="user-form">
          <div className="form-group">
            <label htmlFor="name">Nome</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Função</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="user">Usuário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="capacity">Capacidade (horas de trabalho diárias)</label>
            <input
              type="number"
              id="capacity"
              name="capacity"
              value={formData.capacity}
              onChange={handleChange}
              min="1"
              max="24"
              step="0.5"
              required
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Usuário'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Edição de Usuário */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Usuário"
      >
        <form onSubmit={handleEditSubmit} className="user-form">
          <div className="form-group">
            <label htmlFor="edit-name">Nome</label>
            <input
              type="text"
              id="edit-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-email">Email</label>
            <input
              type="email"
              id="edit-email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-role">Função</label>
              <select
                id="edit-role"
                name="role"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="collaborator">Usuário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="edit-capacity">Capacidade (horas de trabalho diárias)</label>
            <input
              type="number"
              id="edit-capacity"
              name="capacity"
              value={formData.capacity}
              onChange={handleChange}
              min="1"
              max="24"
              step="0.5"
              required
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Atualizar Usuário'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirmar Exclusão"
      >
        <div className="delete-confirmation">
          <p>Tem certeza que deseja excluir o usuário <strong>{userToDelete?.name}</strong>?</p>
          <p>Esta ação não pode ser desfeita.</p>
          
          <div className="form-actions">
            <button 
              className="btn-cancel" 
              onClick={() => setShowDeleteModal(false)}
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              className="btn-delete" 
              onClick={handleDeleteUser}
              disabled={loading}
            >
              {loading ? 'Excluindo...' : 'Excluir Usuário'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default Users;