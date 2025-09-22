import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../../helpers/Constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import './Backlogs.css';

const Backlogs = () => {
  const [backlogs, setBacklogs] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [backlogToDelete, setBacklogToDelete] = useState(null);
  const [backlogDetails, setBacklogDetails] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    sprintId: ''
  });

  // Buscar backlogs e sprints
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [backlogsRes, sprintsRes] = await Promise.all([
          axios.get(API_ENDPOINTS.BACKLOGS),
          axios.get(API_ENDPOINTS.SPRINTS)
        ]);
        
        setBacklogs(backlogsRes.data);
        setSprints(sprintsRes.data);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
        setError('Erro ao carregar dados. Por favor, tente novamente.');
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  
  // Buscar detalhes do backlog com tarefas
  const fetchBacklogDetails = async (backlogId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_ENDPOINTS.BACKLOGS}/${backlogId}`);
      setBacklogDetails(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Erro ao buscar detalhes do backlog:', err);
      setError('Erro ao carregar detalhes do backlog. Por favor, tente novamente.');
      setLoading(false);
    }
  };
  
  // Encontrar a sprint atual (em progresso)
  const getCurrentSprint = () => {
    return sprints.find(sprint => sprint.status === 'in_progress')?.id || '';
  };

  // Manipular mudanças no formulário
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Enviar formulário
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Preparar dados para envio
      const dataToSend = {
        ...formData,
        sprintId: formData.sprintId === '' ? null : formData.sprintId
      };
      
      if (formData.id) {
        // Atualizar backlog existente
        const response = await axios.put(`${API_ENDPOINTS.BACKLOGS}/${formData.id}`, dataToSend);
        setBacklogs(prev => prev.map(item => item.id === formData.id ? response.data : item));
      } else {
        // Criar novo backlog
        const response = await axios.post(API_ENDPOINTS.BACKLOGS, dataToSend);
        setBacklogs(prev => [response.data, ...prev]);
      }
      
      setShowForm(false);
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        sprintId: ''
      });
      setLoading(false);
    } catch (err) {
      console.error('Erro ao salvar backlog:', err);
      setError('Erro ao salvar backlog. Por favor, tente novamente.');
      setLoading(false);
    }
  };

  // Excluir backlog
  const handleDeleteBacklog = async () => {
    if (!backlogToDelete) return;
    
    try {
      setLoading(true);
      await axios.delete(`${API_ENDPOINTS.BACKLOGS}/${backlogToDelete.id}`);
      setBacklogs(prev => prev.filter(item => item.id !== backlogToDelete.id));
      setShowDeleteConfirm(false);
      setBacklogToDelete(null);
      setLoading(false);
    } catch (err) {
      console.error('Erro ao excluir backlog:', err);
      setError('Erro ao excluir backlog. Por favor, tente novamente.');
      setLoading(false);
    }
  };

  // Obter classe de prioridade
  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'low': return 'priority-low';
      case 'medium': return 'priority-medium';
      case 'high': return 'priority-high';
      default: return '';
    }
  };

  // Obter label de prioridade
  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'low': return 'Baixa';
      case 'medium': return 'Média';
      case 'high': return 'Alta';
      default: return priority;
    }
  };

  // Obter classe de status
  const getStatusClass = (status) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'in_progress': return 'status-progress';
      case 'completed': return 'status-completed';
      default: return '';
    }
  };

  // Obter label de status
  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'in_progress': return 'Em Progresso';
      case 'completed': return 'Concluído';
      default: return status;
    }
  };

  // Obter nome da sprint
  const getSprintName = (sprintId) => {
    if (!sprintId) return 'Sem Sprint';
    const sprint = sprints.find(s => s.id === sprintId);
    return sprint ? sprint.name : 'Sprint não encontrada';
  };

  if (loading && backlogs.length === 0) {
    return <div className="backlogs-loading">Carregando...</div>;
  }

  // Definição das colunas da tabela
  const columns = [
    {
      key: 'title',
      header: 'Título',
      render: (backlog) => <span className="table-title">{backlog.title}</span>
    },
    {
      key: 'priority',
      header: 'Prioridade',
      render: (backlog) => (
        <span className={`priority-badge ${getPriorityClass(backlog.priority)}`}>
          {getPriorityLabel(backlog.priority)}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (backlog) => (
        <span className={`status-badge ${getStatusClass(backlog.status)}`}>
          {getStatusLabel(backlog.status)}
        </span>
      )
    },
    {
      key: 'sprintId',
      header: 'Sprint',
      render: (backlog) => <span>{getSprintName(backlog.sprintId)}</span>
    }
  ];

  // Ações da tabela
  const tableActions = (backlog) => (
    <div>
      <button className="action-btn view" title="Ver Detalhes" onClick={(e) => {
        e.stopPropagation();
        fetchBacklogDetails(backlog.id);
        setShowDetails(true);
      }}>
        <FontAwesomeIcon icon="fa-solid fa-eye" />
      </button>
      <button className="action-btn edit" title="Editar" onClick={(e) => {
        e.stopPropagation();
        setFormData(backlog);
        setShowForm(true);
      }}>
        <FontAwesomeIcon icon="fa-solid fa-edit" />
      </button>
      <button className="action-btn delete" title="Excluir" onClick={(e) => {
        e.stopPropagation();
        setBacklogToDelete(backlog);
        setShowDeleteConfirm(true);
      }}>
        <FontAwesomeIcon icon="fa-solid fa-trash" />
      </button>
    </div>
  );

  return (
    <div className="backlogs-container">
      <div className="backlogs-header">
        <h1>Backlogs</h1>
        <button 
          className="btn-add-backlog" 
          onClick={() => {
            setFormData({
              title: '',
              description: '',
              priority: 'medium',
              sprintId: getCurrentSprint()
            });
            setShowForm(true);
          }}
        >
          <FontAwesomeIcon icon="fa-solid fa-plus" /> Novo Backlog
        </button>
      </div>

      {error && <div className="backlogs-error">{error}</div>}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Backlog">
        <form onSubmit={handleSubmit} className="backlog-form">
          <div className="form-group">
            <label htmlFor="title">Título</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Descrição</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
            ></textarea>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="priority">Prioridade</label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="sprintId">Sprint</label>
              <select
                id="sprintId"
                name="sprintId"
                value={formData.sprintId}
                onChange={handleChange}
              >
                <option value="">Sem Sprint</option>
                {sprints.map(sprint => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}{sprint.status === 'in_progress' ? ' (atual)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Backlog'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="backlogs-table">
        <Table 
          columns={columns} 
          data={backlogs} 
          onRowClick={(backlog) => {
            // Implementar visualização detalhada
            console.log('Visualizar backlog:', backlog);
          }}
          actions={tableActions}
        />
      </div>

      {/* Modal de confirmação de exclusão */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirmar Exclusão">
        <div className="delete-confirm">
          <p>Tem certeza que deseja excluir o backlog <strong>{backlogToDelete?.title}</strong>?</p>
          <p>Esta ação não pode ser desfeita.</p>
          
          <div className="form-actions">
            <button 
              className="btn-cancel" 
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancelar
            </button>
            <button 
              className="btn-delete" 
              onClick={() => handleDeleteBacklog()}
              disabled={loading}
            >
              {loading ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de detalhes do backlog */}
      <Modal isOpen={showDetails} onClose={() => setShowDetails(false)} title="Detalhes do Backlog">
        {backlogDetails && (
          <div className="backlog-details">
            <div className="detail-card">
              <div className="detail-header">
                <h2>{backlogDetails.title}</h2>
                <span className={`status-badge ${getStatusClass(backlogDetails.status)}`}>
                  {getStatusLabel(backlogDetails.status)}
                </span>
              </div>
              
              <div className="detail-section">
                <h3>Descrição</h3>
                <p className="detail-description">{backlogDetails.description || 'Sem descrição'}</p>
              </div>
              
              <div className="detail-row">
                <div className="detail-col">
                  <div className="detail-item">
                    <h3>Prioridade</h3>
                    <p className={`priority-badge ${getPriorityClass(backlogDetails.priority)}`}>
                      {getPriorityLabel(backlogDetails.priority)}
                    </p>
                  </div>
                  
                  <div className="detail-item">
                    <h3>Sprint</h3>
                    <p>{getSprintName(backlogDetails.sprintId)}</p>
                  </div>
                </div>
                
                <div className="detail-col">
                  <div className="detail-item">
                    <h3>Data de Criação</h3>
                    <p>{new Date(backlogDetails.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  
                  <div className="detail-item">
                    <h3>Última Atualização</h3>
                    <p>{new Date(backlogDetails.updatedAt || backlogDetails.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="detail-section tasks-section">
              <h3>Tarefas Vinculadas</h3>
              {backlogDetails.Tasks && backlogDetails.Tasks.length > 0 ? (
                <div className="tasks-list">
                  {backlogDetails.Tasks.map(task => (
                    <div key={task.id} className="task-card">
                      <div className="task-header">
                        <h4>{task.title}</h4>
                        <span className={`status-badge ${getStatusClass(task.status)}`}>
                          {getStatusLabel(task.status)}
                        </span>
                      </div>
                      <p className="task-description">{task.description || 'Sem descrição'}</p>
                      <div className="task-footer">
                        <div className="task-assignee">
                          <FontAwesomeIcon icon="fa-solid fa-user" />
                          <span>{task.User?.name || 'Não atribuído'}</span>
                        </div>
                        <div className="task-date">
                          <FontAwesomeIcon icon="fa-solid fa-calendar" />
                          <span>{new Date(task.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-tasks">Nenhuma tarefa vinculada a este backlog.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Backlogs;