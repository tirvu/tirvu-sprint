import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../../helpers/Constants';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './Dashboard.css';

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    sprints: 0,
    backlogs: 0,
    tasks: 0,
    completedTasks: 0
  });
  const [myTasks, setMyTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados para o dashboard de administrador
  const [collaborators, setCollaborators] = useState([]);
  const [currentSprint, setCurrentSprint] = useState(null);
  const [dateFilter, setDateFilter] = useState('today');
  const [isAdminView, setIsAdminView] = useState(false);

  useEffect(() => {
    // Verificar se o usuário é admin para definir a visualização
    setIsAdminView(isAdmin());
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Buscar estatísticas básicas para todos os usuários
        const sprintsRes = await axios.get(API_ENDPOINTS.SPRINTS);
        const backlogsRes = await axios.get(API_ENDPOINTS.BACKLOGS);
        const tasksRes = await axios.get(API_ENDPOINTS.TASKS);
        const myTasksRes = await axios.get(API_ENDPOINTS.MY_TASKS);
        
        // Calcular estatísticas
        const completedTasks = tasksRes.data.filter(task => task.status === 'completed').length;
        
        setStats({
          sprints: sprintsRes.data.length,
          backlogs: backlogsRes.data.length,
          tasks: tasksRes.data.length,
          completedTasks
        });
        
        // Filtrar apenas as tarefas pendentes e em progresso
        const activeTasks = myTasksRes.data.filter(
          task => task.status === 'pending' || task.status === 'in_progress'
        );
        
        setMyTasks(activeTasks);
        
        // Se for administrador, buscar dados dos colaboradores
        if (isAdmin()) {
          fetchCollaboratorsData();
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro ao buscar dados do dashboard:', err);
        setError('Erro ao carregar dados. Por favor, tente novamente.');
        setLoading(false);
      }
    };
    
    // Função para buscar dados dos colaboradores
    const fetchCollaboratorsData = async () => {
      try {
        const response = await axios.get(`${API_ENDPOINTS.DASHBOARD_COLLABORATORS}?date=${dateFilter}`);
        setCollaborators(response.data.collaborators);
        setCurrentSprint(response.data.currentSprint);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao buscar dados dos colaboradores:', err);
        setError('Erro ao carregar dados dos colaboradores. Por favor, tente novamente.');
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin, dateFilter]);

  const getStatusClass = (status) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'in_progress': return 'status-progress';
      case 'completed': return 'status-completed';
      default: return '';
    }
  };
  
  // Função para lidar com a mudança de filtro de data
  const handleDateFilterChange = (filter) => {
    setDateFilter(filter);
  };
  
  // Componente de filtro para o dashboard de administrador
  const DateFilter = () => {
    return (
      <div className="date-filter">
        <button 
          className={`filter-btn ${dateFilter === 'today' ? 'active' : ''}`}
          onClick={() => handleDateFilterChange('today')}
        >
          Hoje
        </button>
        <button 
          className={`filter-btn ${dateFilter === 'yesterday' ? 'active' : ''}`}
          onClick={() => handleDateFilterChange('yesterday')}
        >
          Ontem
        </button>
        <button 
          className={`filter-btn ${dateFilter === 'week' ? 'active' : ''}`}
          onClick={() => handleDateFilterChange('week')}
        >
          Esta Semana
        </button>
        <button 
          className={`filter-btn ${dateFilter === 'month' ? 'active' : ''}`}
          onClick={() => handleDateFilterChange('month')}
        >
          Este Mês
        </button>
      </div>
    );
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'in_progress': return 'Em Progresso';
      case 'completed': return 'Concluído';
      default: return status;
    }
  };
  
  // Componente de card para exibir os indicadores de cada colaborador
  const CollaboratorCard = ({ collaborator }) => {
    return (
      <div className="collaborator-card">
        <div className="collaborator-header">
          <h3>{collaborator.name}</h3>
          <span className="capacity">{collaborator.capacity}h/dia</span>
        </div>
        
        <div className="indicators">
          <div className="indicator">
            <div className="indicator-label">Horas Trabalhadas:</div>
            <div className="indicator-value">{collaborator.hoursWorked}h</div>
          </div>
          
          <div className="indicator">
            <div className="indicator-label">Horas Restantes (Dia):</div>
            <div className={`indicator-value ${collaborator.hoursRemainingToday < 0 ? 'negative' : ''}`}>
              {collaborator.hoursRemainingToday}h
            </div>
          </div>
          
          <div className="indicator">
            <div className="indicator-label">Horas Restantes (Mês):</div>
            <div className={`indicator-value ${collaborator.hoursRemainingMonth < 0 ? 'negative' : ''}`}>
              {collaborator.hoursRemainingMonth}h
            </div>
          </div>
        </div>
        
        {collaborator.currentTasks && collaborator.currentTasks.length > 0 ? (
          <div className="current-task">
            <div className="task-info">
              <div className="task-label">Tarefa Atual:</div>
              <div className="task-name">{collaborator.currentTasks[0].title}</div>
              <div className={`task-status ${getStatusClass(collaborator.currentTasks[0].status)}`}>
                {getStatusLabel(collaborator.currentTasks[0].status)}
              </div>
            </div>
            
            <div className="backlog-info">
              <div className="backlog-label">Backlog:</div>
              <div className="backlog-name">
                {collaborator.currentTasks[0].backlog ? collaborator.currentTasks[0].backlog.title : 'Sem backlog'}
              </div>
            </div>
          </div>
        ) : (
          <div className="no-task">Sem tarefa atribuída</div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="dashboard-loading">Carregando...</div>;
  }

  if (error) {
    return <div className="dashboard-error">{error}</div>;
  }
  
  // Dashboard para administradores
  const AdminDashboard = () => {
    return (
      <div className="admin-dashboard">
        <div className="admin-header">
          <h1>Dashboard</h1>&nbsp;
          {currentSprint && (
            <div className="current-sprint">
              <span>Sprint Atual: </span>
              <strong>{currentSprint.name}</strong>
            </div>
          )}
        </div>
        
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon="fa-solid fa-flag" />
            </div>
            <div className="stat-content">
              <h3>{stats.sprints}</h3>
              <p>Sprints</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon="fa-solid fa-list-check" />
            </div>
            <div className="stat-content">
              <h3>{stats.backlogs}</h3>
              <p>Backlogs</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon="fa-solid fa-tasks" />
            </div>
            <div className="stat-content">
              <h3>{stats.tasks}</h3>
              <p>Tarefas</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon="fa-solid fa-check-circle" />
            </div>
            <div className="stat-content">
              <h3>{stats.completedTasks}</h3>
              <p>Concluídas</p>
            </div>
          </div>
        </div>
        
        <DateFilter />
        
        <div className="collaborators-container">
          {collaborators.length === 0 ? (
            <p className="no-collaborators">Nenhum colaborador encontrado para o período selecionado.</p>
          ) : (
            <div className="collaborators-grid">
              {collaborators.map(collaborator => (
                <CollaboratorCard key={collaborator.id} collaborator={collaborator} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Dashboard para colaboradores
  const CollaboratorDashboard = () => {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Dashboard</h1>&nbsp;
          <p className="welcome-message">Bem-vindo, {user.name}!</p>
        </div>
        
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon="fa-solid fa-flag" />
            </div>
            <div className="stat-content">
              <h3>{stats.sprints}</h3>
              <p>Sprints</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon="fa-solid fa-list-check" />
            </div>
            <div className="stat-content">
              <h3>{stats.backlogs}</h3>
              <p>Backlogs</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon="fa-solid fa-tasks" />
            </div>
            <div className="stat-content">
              <h3>{stats.tasks}</h3>
              <p>Tarefas</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon="fa-solid fa-check-circle" />
            </div>
            <div className="stat-content">
              <h3>{stats.completedTasks}</h3>
              <p>Concluídas</p>
            </div>
          </div>
        </div>
        
        <div className="my-tasks-section">
          <h2>Minhas Tarefas</h2>
          
          {myTasks.length === 0 ? (
            <div className="no-tasks-message">
              <p>Você não tem tarefas pendentes.</p>
            </div>
          ) : (
            <div className="tasks-list">
              {myTasks.map(task => (
                <div key={task.id} className="task-card">
                  <div className="task-header">
                    <h3>{task.title}</h3>
                    <span className={`task-status ${getStatusClass(task.status)}`}>
                      {getStatusLabel(task.status)}
                    </span>
                  </div>
                  
                  <p className="task-description">
                    {task.description || 'Sem descrição'}
                  </p>
                  
                  <div className="task-footer">
                    <span className="task-backlog">
                      <FontAwesomeIcon icon="fa-solid fa-list" />
                      {task.Backlog?.title || 'Sem backlog'}
                    </span>
                    
                    <span className="task-hours">
                      <FontAwesomeIcon icon="fa-solid fa-clock" />
                      {task.hoursSpent || 0}h
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return isAdminView ? <AdminDashboard /> : <CollaboratorDashboard />;
};

export default Dashboard;