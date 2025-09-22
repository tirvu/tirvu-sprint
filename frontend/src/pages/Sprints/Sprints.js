import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../../helpers/Constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import './Sprints.css';

const Sprints = () => {
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sprintToDelete, setSprintToDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    status: 'planned'
  });

  // Buscar sprints com backlogs e tarefas
  useEffect(() => {
    const fetchSprints = async () => {
      try {
        setLoading(true);
        const response = await axios.get(API_ENDPOINTS.SPRINTS);
        
        // Para cada sprint, buscar detalhes incluindo backlogs
        const sprintsWithDetails = await Promise.all(
          response.data.map(async (sprint) => {
            const detailsResponse = await axios.get(`${API_ENDPOINTS.SPRINTS}/${sprint.id}`);
            return detailsResponse.data;
          })
        );
        
        setSprints(sprintsWithDetails);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao buscar sprints:', err);
        setError('Erro ao carregar sprints. Por favor, tente novamente.');
        setLoading(false);
      }
    };

    fetchSprints();
  }, []);

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
      
      // Verificar se já existe uma sprint em progresso quando tentamos definir uma nova como em progresso
      if (formData.status === 'in_progress') {
        const sprintInProgress = sprints.find(s => s.status === 'in_progress' && s.id !== formData.id);
        if (sprintInProgress) {
          setError('Já existe uma sprint em progresso. Apenas uma sprint pode estar em progresso por vez.');
          setLoading(false);
          return;
        }
      }
      
      if (formData.id) {
        // Atualizar sprint existente
        const response = await axios.put(`${API_ENDPOINTS.SPRINTS}/${formData.id}`, formData);
        setSprints(prev => prev.map(item => item.id === formData.id ? response.data : item));
      } else {
        // Criar nova sprint
        const response = await axios.post(API_ENDPOINTS.SPRINTS, formData);
        setSprints(prev => [response.data, ...prev]);
      }
      
      setShowForm(false);
      setError(null); // Limpar mensagens de erro
      
      // Reinicializar o formulário com datas padrão
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0];
      
      // Calcular data de término padrão (hoje + 14 dias)
      const endDate = new Date();
      endDate.setDate(today.getDate() + 14);
      const formattedEndDate = endDate.toISOString().split('T')[0];
      
      setFormData({
        name: '',
        startDate: formattedDate,
        endDate: formattedEndDate,
        status: 'planned'
      });
      setLoading(false);
    } catch (err) {
      console.error('Erro ao salvar sprint:', err);
      setError('Erro ao salvar sprint. Por favor, tente novamente.');
      setLoading(false);
    }
  };

  // Excluir sprint
  const handleDeleteSprint = async () => {
    if (!sprintToDelete) return;
    
    try {
      setLoading(true);
      await axios.delete(`${API_ENDPOINTS.SPRINTS}/${sprintToDelete.id}`);
      setSprints(prev => prev.filter(item => item.id !== sprintToDelete.id));
      setShowDeleteConfirm(false);
      setSprintToDelete(null);
      setLoading(false);
    } catch (err) {
      console.error('Erro ao excluir sprint:', err);
      setError('Erro ao excluir sprint. Por favor, tente novamente.');
      setLoading(false);
    }
  };

  // Formatar data
  const formatDate = (dateString) => {
    // Garantir que a data seja tratada como UTC para evitar problemas de fuso horário
    const [datePart] = dateString.split('T');
    const [year, month, day] = datePart.split('-');
    // Criar a data no formato brasileiro (dia/mês/ano)
    return `${day}/${month}/${year}`;
  };

  // Obter classe de status
  const getStatusClass = (status) => {
    switch (status) {
      case 'planned': return 'status-planning';
      case 'in_progress': return 'status-progress';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      default: return '';
    }
  };

  // Obter label de status
  const getStatusLabel = (status) => {
    switch (status) {
      case 'planned': return 'Planejamento';
      case 'in_progress': return 'Em Progresso';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  // Calcular progresso
  const calculateProgress = (sprint) => {
    // Se não houver backlogs, retorna 0
    if (!sprint.Backlogs || sprint.Backlogs.length === 0) return 0;
    
    // Calcula o progresso com base nos backlogs completados
    const completedBacklogs = sprint.Backlogs.filter(backlog => backlog.status === 'completed').length;
    return Math.round((completedBacklogs / sprint.Backlogs.length) * 100);
  };
  
  // Estado para o modal de detalhes
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState(null);

  if (loading && sprints.length === 0) {
    return <div className="sprints-loading">Carregando...</div>;
  }

  // Definição das colunas da tabela
  const columns = [
    {
      key: 'name',
      header: 'Nome',
      render: (sprint) => <span className="table-title">{sprint.name}</span>,
      sortable: true
    },
    {
      key: 'status',
      header: 'Status',
      render: (sprint) => (
        <span className={`status-badge ${getStatusClass(sprint.status)}`}>
          {getStatusLabel(sprint.status)}
        </span>
      ),
      sortable: true
    },
    {
      key: 'dates',
      header: 'Período',
      render: (sprint) => (
        <div className="sprint-dates-cell">
          <div>{formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}</div>
        </div>
      ),
      sortable: true,
      sortValue: (sprint) => new Date(sprint.startDate).getTime() // Ordenar pelo startDate
    },
    {
      key: 'progress',
      header: 'Progresso',
      render: (sprint) => (
        <div className="sprint-progress-cell">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${calculateProgress(sprint)}%` }}
            ></div>
          </div>
          <span className="progress-text">{calculateProgress(sprint)}%</span>
        </div>
      ),
      sortable: true,
      sortValue: (sprint) => calculateProgress(sprint)
    },
    {
      key: 'backlogs',
      header: 'Backlogs',
      render: (sprint) => <span>{sprint.Backlogs?.length || 0}</span>,
      sortable: true,
      sortValue: (sprint) => sprint.Backlogs?.length || 0
    }
  ];

  // Ações da tabela
  const tableActions = (sprint) => {
    // Verificar se já existe uma sprint em progresso (diferente da atual)
    const hasSprintInProgress = sprints.find(s => s.status === 'in_progress' && s.id !== sprint.id);
    
    return (
      <div>
        <button 
          className="action-btn view" 
          title="Ver Detalhes"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSprint(sprint);
            setShowDetailsModal(true);
          }}
        >
          <FontAwesomeIcon icon="fa-solid fa-eye" />
        </button>
        <button className="action-btn edit" title="Editar" onClick={(e) => {
          e.stopPropagation();
          // Formatar as datas para o formato esperado pelo input type="date"
          const formattedSprint = {
            ...sprint,
            startDate: sprint.startDate.split('T')[0],
            endDate: sprint.endDate.split('T')[0]
          };
          setFormData(formattedSprint);
          setShowForm(true);
        }}>
          <FontAwesomeIcon icon="fa-solid fa-edit" />
        </button>
        {sprint.status === 'planned' && (
          <button 
            className="action-btn start" 
            title="Iniciar Sprint" 
            disabled={hasSprintInProgress}
            onClick={async (e) => {
              e.stopPropagation();
              if (hasSprintInProgress) {
                setError('Já existe uma sprint em progresso. Apenas uma sprint pode estar em progresso por vez.');
                return;
              }
              try {
                setLoading(true);
                const updatedSprint = {...sprint, status: 'in_progress'};
                const response = await axios.put(`${API_ENDPOINTS.SPRINTS}/${sprint.id}`, updatedSprint);
                setSprints(prev => prev.map(item => item.id === sprint.id ? response.data : item));
                setLoading(false);
                setError(null); // Limpar mensagens de erro
              } catch (err) {
                console.error('Erro ao iniciar sprint:', err);
                setError('Erro ao iniciar sprint. Por favor, tente novamente.');
                setLoading(false);
              }
            }}
          >
            <FontAwesomeIcon icon="fa-solid fa-play" />
          </button>
        )}
        {sprint.status === 'in_progress' && (
          <button 
            className="action-btn complete" 
            title="Concluir Sprint" 
            onClick={async (e) => {
              e.stopPropagation();
              try {
                setLoading(true);
                const updatedSprint = {...sprint, status: 'completed'};
                const response = await axios.put(`${API_ENDPOINTS.SPRINTS}/${sprint.id}`, updatedSprint);
                setSprints(prev => prev.map(item => item.id === sprint.id ? response.data : item));
                setLoading(false);
                setError(null); // Limpar mensagens de erro
              } catch (err) {
                console.error('Erro ao concluir sprint:', err);
                setError('Erro ao concluir sprint. Por favor, tente novamente.');
                setLoading(false);
              }
            }}
          >
            <FontAwesomeIcon icon="fa-solid fa-check" />
          </button>
        )}
        {(sprint.status === 'planned' || sprint.status === 'in_progress') && (
          <button 
            className="action-btn cancel" 
            title="Cancelar Sprint" 
            onClick={async (e) => {
              e.stopPropagation();
              try {
                setLoading(true);
                const updatedSprint = {...sprint, status: 'cancelled'};
                const response = await axios.put(`${API_ENDPOINTS.SPRINTS}/${sprint.id}`, updatedSprint);
                setSprints(prev => prev.map(item => item.id === sprint.id ? response.data : item));
                setLoading(false);
                setError(null); // Limpar mensagens de erro
              } catch (err) {
                console.error('Erro ao cancelar sprint:', err);
                setError('Erro ao cancelar sprint. Por favor, tente novamente.');
                setLoading(false);
              }
            }}
          >
            <FontAwesomeIcon icon="fa-solid fa-ban" />
          </button>
        )}
        <button className="action-btn delete" title="Excluir" onClick={(e) => {
          e.stopPropagation();
          setSprintToDelete(sprint);
          setShowDeleteConfirm(true);
        }}>
          <FontAwesomeIcon icon="fa-solid fa-trash" />
        </button>
      </div>
    );
  };

  return (
    <div className="sprints-container">
      <div className="sprints-header">
        <h1>Sprints</h1>
        <button 
          className="btn-add-sprint" 
          onClick={() => {
            // Inicializar com a data atual formatada para o input type="date"
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0];
            
            // Calcular data de término padrão (hoje + 14 dias)
            const endDate = new Date();
            endDate.setDate(today.getDate() + 14);
            const formattedEndDate = endDate.toISOString().split('T')[0];
            
            setFormData({
              name: '',
              startDate: formattedDate,
              endDate: formattedEndDate,
              status: 'planned'
            });
            setShowForm(true);
          }}
        >
          <FontAwesomeIcon icon="fa-solid fa-plus" /> Nova Sprint
        </button>
      </div>

      {error && <div className="sprints-error">{error}</div>}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Sprint">
        <form onSubmit={handleSubmit} className="sprint-form">
          <div className="form-group">
            <label htmlFor="name">Nome da Sprint</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startDate">Data de Início</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="endDate">Data de Término</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="planned">Planejamento</option>
              <option value="in_progress">Em Progresso</option>
              <option value="completed">Concluído</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          {formData.status === 'in_progress' && (
            <div className="form-info">
              <p className="info-text">Atenção: Apenas uma sprint pode estar em progresso por vez.</p>
              {sprints.find(s => s.status === 'in_progress' && s.id !== formData.id) && (
                <p className="warning-text">Já existe uma sprint em progresso. Ao salvar, a sprint atual em progresso será alterada.</p>
              )}
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Sprint'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="sprints-table">
        <Table 
          columns={columns} 
          data={sprints} 
          onRowClick={(sprint) => {
            // Implementar visualização detalhada
            console.log('Visualizar sprint:', sprint);
          }}
          actions={tableActions}
        />
      </div>

      {/* Modal de confirmação de exclusão */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirmar Exclusão">
        <div className="delete-confirm">
          <p>Tem certeza que deseja excluir a sprint <strong>{sprintToDelete?.name}</strong>?</p>
          <p>Esta ação não pode ser desfeita e removerá todos os backlogs associados a esta sprint.</p>
          
          <div className="form-actions">
            <button 
              className="btn-cancel" 
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancelar
            </button>
            <button 
              className="btn-delete" 
              onClick={() => handleDeleteSprint()}
              disabled={loading}
            >
              {loading ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de detalhes da sprint */}
      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title={`Detalhes da Sprint: ${selectedSprint?.name}`}>
        {selectedSprint && (
          <div className="sprint-details-modal">
            <div className="sprint-info">
              <div className="sprint-info-header">
                <h3>Informações da Sprint</h3>
                <div className="sprint-dates">
                  <span>Período: {formatDate(selectedSprint.startDate)} - {formatDate(selectedSprint.endDate)}</span>
                </div>
                <div className="sprint-status">
                  <span className={`status-badge ${getStatusClass(selectedSprint.status)}`}>
                    {getStatusLabel(selectedSprint.status)}
                  </span>
                </div>
                <div className="sprint-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${calculateProgress(selectedSprint)}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">{calculateProgress(selectedSprint)}%</span>
                </div>
              </div>
            </div>

            <div className="backlogs-section">
              <h3>Backlogs ({selectedSprint.Backlogs?.length || 0})</h3>
              {selectedSprint.Backlogs && selectedSprint.Backlogs.length > 0 ? (
                <div className="backlogs-list">
                  {selectedSprint.Backlogs.map(backlog => (
                    <div key={backlog.id} className="backlog-item">
                      <div className="backlog-header">
                        <h4>{backlog.title}</h4>
                        <span className={`status-badge ${getStatusClass(backlog.status)}`}>
                          {getStatusLabel(backlog.status)}
                        </span>
                      </div>
                      <p className="backlog-description">{backlog.description || 'Sem descrição'}</p>
                      <div className="backlog-priority">
                        <span className={`priority-badge priority-${backlog.priority}`}>
                          {backlog.priority === 'high' ? 'Alta' : backlog.priority === 'medium' ? 'Média' : 'Baixa'}
                        </span>
                      </div>
                      
                      {backlog.Tasks && backlog.Tasks.length > 0 ? (
                        <div className="tasks-list">
                          <h5>Tarefas ({backlog.Tasks.length})</h5>
                          <table className="tasks-table">
                            <thead>
                              <tr>
                                <th>Título</th>
                                <th>Status</th>
                                <th>Responsável</th>
                                <th>Horas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {backlog.Tasks.map(task => (
                                <tr key={task.id}>
                                  <td>{task.title}</td>
                                  <td>
                                    <span className={`status-badge ${getStatusClass(task.status)}`}>
                                      {getStatusLabel(task.status)}
                                    </span>
                                  </td>
                                  <td>{task.User?.name || 'N/A'}</td>
                                  <td>{task.hoursSpent} / {task.estimatedHours}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="no-tasks">Nenhuma tarefa cadastrada para este backlog.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-backlogs">Nenhum backlog cadastrado para esta sprint.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Sprints;