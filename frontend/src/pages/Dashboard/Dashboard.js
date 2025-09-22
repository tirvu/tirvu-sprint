import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../../helpers/Constants';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import './Dashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    sprints: 0,
    backlogs: 0,
    tasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0
  });
  const [myTasks, setMyTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados para o dashboard de administrador
  const [collaborators, setCollaborators] = useState([]);
  const [currentSprint, setCurrentSprint] = useState(null);
  const [dateFilter, setDateFilter] = useState('today');
  const [isAdminView, setIsAdminView] = useState(false);
  const [hoursFilter, setHoursFilter] = useState('day');
  const [tasksByStatus, setTasksByStatus] = useState([]);
  const [tasksByBacklog, setTasksByBacklog] = useState([]);
  const [activityData, setActivityData] = useState([]);

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
        const pendingTasks = tasksRes.data.filter(task => task.status === 'pending').length;
        const inProgressTasks = tasksRes.data.filter(task => task.status === 'in_progress').length;
        
        setStats({
          sprints: sprintsRes.data.length,
          backlogs: backlogsRes.data.length,
          tasks: tasksRes.data.length,
          completedTasks,
          pendingTasks,
          inProgressTasks
        });
        
        // Dados para gráficos
        const statusData = [
          { status: 'Concluídas', count: completedTasks },
          { status: 'Pendentes', count: pendingTasks },
          { status: 'Em Progresso', count: inProgressTasks }
        ];
        setTasksByStatus(statusData);
        
        // Agrupar tarefas por backlog, priorizando backlogs com tarefas em progresso
        const backlogMap = new Map();
        const backlogsWithInProgress = new Set();
        
        tasksRes.data.forEach(task => {
          if (task.Backlog) {
            const backlogTitle = task.Backlog.title;
            backlogMap.set(backlogTitle, (backlogMap.get(backlogTitle) || 0) + 1);
            
            // Marcar backlogs que têm tarefas em progresso
            if (task.status === 'in_progress') {
              backlogsWithInProgress.add(backlogTitle);
            }
          }
        });
        
        // Criar array de dados de backlog
        let backlogData = Array.from(backlogMap, ([title, count]) => ({ 
          title, 
          count, 
          hasInProgress: backlogsWithInProgress.has(title)
        }));
        
        // Priorizar backlogs com tarefas em progresso
        backlogData.sort((a, b) => {
          // Primeiro ordenar por ter tarefas em progresso
          if (a.hasInProgress && !b.hasInProgress) return -1;
          if (!a.hasInProgress && b.hasInProgress) return 1;
          // Depois ordenar por contagem de tarefas
          return b.count - a.count;
        });
        
        setTasksByBacklog(backlogData.slice(0, 5)); // Limitar aos 5 principais backlogs
        
        // Filtrar apenas as tarefas pendentes e em progresso
        const activeTasks = myTasksRes.data.filter(
          task => task.status === 'pending' || task.status === 'in_progress'
        );
        
        setMyTasks(activeTasks);
        
        // Se for administrador, buscar dados dos colaboradores
        if (isAdmin()) {
          fetchCollaboratorsData();
          fetchActivityData();
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
        const response = await axios.get(`${API_ENDPOINTS.DASHBOARD_COLLABORATORS}?date=${dateFilter}&hoursFilter=${hoursFilter}`);
        
        // Verificar se os dados foram recebidos corretamente
        console.log('Dados dos colaboradores recebidos:', response.data);
        
        // Garantir que todos os colaboradores tenham contadores de tarefas inicializados
        const collaboratorsWithTaskCounts = response.data.collaborators.map(collaborator => {
          // Garantir que os contadores de tarefas existam, mesmo que sejam zero
          const completedTasks = collaborator.completedTasks !== undefined ? collaborator.completedTasks : 0;
          const inProgressTasks = collaborator.inProgressTasks !== undefined ? collaborator.inProgressTasks : 0;
          const pendingTasks = collaborator.pendingTasks !== undefined ? collaborator.pendingTasks : 0;
          const taskCompletionRate = collaborator.taskCompletionRate !== undefined ? collaborator.taskCompletionRate : 0;
          
          return {
            ...collaborator,
            completedTasks,
            inProgressTasks,
            pendingTasks,
            taskCompletionRate
          };
        });
        
        setCollaborators(collaboratorsWithTaskCounts);
        setCurrentSprint(response.data.currentSprint);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao buscar dados dos colaboradores:', err);
        setError('Erro ao carregar dados dos colaboradores. Por favor, tente novamente.');
        setLoading(false);
      }
    };
    
    // Função para buscar dados de atividades
    const fetchActivityData = async () => {
      try {
        // Simulando dados de atividades por dia da semana
        // Em um ambiente real, isso viria da API
        const activityByDay = [
          { day: 'Segunda', hours: 32 },
          { day: 'Terça', hours: 38 },
          { day: 'Quarta', hours: 30 },
          { day: 'Quinta', hours: 25 },
          { day: 'Sexta', hours: 20 }
        ];
        setActivityData(activityByDay);
      } catch (err) {
        console.error('Erro ao buscar dados de atividades:', err);
      }
    };

    fetchData();
  }, [isAdmin, dateFilter, hoursFilter]);

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
  
  // Função para lidar com a mudança de filtro de horas
  const handleHoursFilterChange = (filter) => {
    setHoursFilter(filter);
  };
  
  // Componente de filtro para o dashboard de administrador
  const DateFilter = () => {
    return (
      <div className="filters-container">
        <div className="filter-section">
          <h3 className="filter-title">Período</h3>
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
        </div>
      </div>
    );
  };
  
  // Componentes de gráficos
  const TaskStatusChart = () => {
    const data = {
      labels: tasksByStatus.map(item => item.status),
      datasets: [
        {
          data: tasksByStatus.map(item => item.count),
          backgroundColor: [
            '#4CAF50', // Verde para concluídas
            '#FFC107', // Amarelo para pendentes
            '#2196F3'  // Azul para em progresso
          ],
          borderWidth: 1,
        },
      ],
    };
    
    return (
      <div className="chart-container">
        <h3>Tarefas por Status</h3>
        <div className="chart-wrapper">
          <Pie data={data} options={{ responsive: true, maintainAspectRatio: false }} />
        </div>
      </div>
    );
  };
  
  const BacklogTasksChart = () => {
    const data = {
      labels: tasksByBacklog.map(item => item.title),
      datasets: [
        {
          label: 'Tarefas por Backlog',
          data: tasksByBacklog.map(item => item.count),
          backgroundColor: tasksByBacklog.map(item => item.hasInProgress ? 'rgba(255, 87, 34, 0.8)' : 'rgba(74, 108, 247, 0.8)'), // Cor diferente para backlogs com tarefas em progresso
          borderRadius: 8,
          borderWidth: 0,
          maxBarThickness: 35,
        },
      ],
    };
    
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 11
            },
            color: '#666'
          }
        },
        y: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 12
            },
            color: '#333'
          }
        }
      },
      color: '#333',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 12
            },
            generateLabels: () => [
              {
                text: 'Com tarefas em progresso',
                fillStyle: 'rgba(255, 87, 34, 0.8)',
                strokeStyle: 'rgba(255, 87, 34, 0.8)',
                pointStyle: 'circle',
                lineWidth: 0,
                hidden: false
              },
              {
                text: 'Sem tarefas em progresso',
                fillStyle: 'rgba(74, 108, 247, 0.8)',
                strokeStyle: 'rgba(74, 108, 247, 0.8)',
                pointStyle: 'circle',
                lineWidth: 0,
                hidden: false
              }
            ]
          }
        },
        title: {
          display: false,
        },
      },
    };
    
    return (
      <div className="chart-container backlogs-recentes">
        <div className="chart-header">
          <h3>Backlogs Recentes</h3>
          <div className="chart-subtitle">Backlogs com maior número de tarefas ativas</div>
        </div>
        <div className="chart-wrapper">
          <Bar data={data} options={options} />
        </div>
      </div>
    );
  };
  
  const ActivityChart = () => {
    const data = {
      labels: activityData.map(item => item.day),
      datasets: [
        {
          label: 'Horas Trabalhadas',
          data: activityData.map(item => item.hours),
          backgroundColor: '#4a6cf7',
          borderRadius: 6,
        },
      ],
    };
    
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: false,
        },
      },
    };
    
    return (
      <div className="chart-container">
        <h3>Atividade Semanal</h3>
        <div className="chart-wrapper">
          <Bar data={data} options={options} />
        </div>
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
    // Determinar o título do filtro de horas com base no filtro atual
    const hoursFilterTitle = {
      'day': 'Dia',
      'week': 'Semana',
      'month': 'Mês'
    }[hoursFilter];
    
    // Garantir que os valores de tarefas existam
    const completedTasks = collaborator.completedTasks || 0;
    const inProgressTasks = collaborator.inProgressTasks || 0;
    const pendingTasks = collaborator.pendingTasks || 0;
    
    // Calcular a porcentagem de conclusão das tarefas
    const completionRate = collaborator.taskCompletionRate || 0;
    
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
            <div className="indicator-label">Horas Restantes ({hoursFilterTitle}):</div>
            <div className={`indicator-value ${collaborator.hoursRemainingToday < 0 ? 'negative' : ''}`}>
              {collaborator.hoursRemainingToday}h
            </div>
          </div>
          
          <div className="indicator">
            <div className="indicator-label">Produtividade:</div>
            <div className="indicator-value progress-bar">
              <div 
                className="progress" 
                style={{ width: `${completionRate}%`, backgroundColor: completionRate > 70 ? '#4CAF50' : '#FFC107' }}
              ></div>
              <span>{completionRate}%</span>
            </div>
          </div>
        </div>
        
        <div className="activity-indicators">
          <div className="activity-indicator">
            <FontAwesomeIcon icon="fa-solid fa-check" className="activity-icon completed" />
            <span className="activity-count">{completedTasks}</span>
            <span className="activity-label">Concluídas</span>
          </div>
          
          <div className="activity-indicator">
            <FontAwesomeIcon icon="fa-solid fa-spinner" className="activity-icon in-progress" />
            <span className="activity-count">{inProgressTasks}</span>
            <span className="activity-label">Em Progresso</span>
          </div>
          
          <div className="activity-indicator">
            <FontAwesomeIcon icon="fa-solid fa-hourglass-half" className="activity-icon pending" />
            <span className="activity-count">{pendingTasks}</span>
            <span className="activity-label">Pendentes</span>
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
  
  // Componente para listar usuários com barra de progresso de horas
  const UserProgressCard = () => {
    return (
      <div className="user-progress-card">
        <div className="user-progress-header">
          <h2>Progresso de Usuários</h2>
          <div className="user-progress-legend">
            <div className="legend-item">
              <span className="legend-color" style={{backgroundColor: '#4CAF50'}}></span>
              <span className="legend-text">Alto</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{backgroundColor: '#FFC107'}}></span>
              <span className="legend-text">Médio</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{backgroundColor: '#FF5722'}}></span>
              <span className="legend-text">Baixo</span>
            </div>
          </div>
        </div>
        <div className="user-progress-list">
          {collaborators.map((user, index) => {
            // Calcular a porcentagem de horas trabalhadas em relação à capacidade total
            const totalCapacity = user.capacity * (hoursFilter === 'day' ? 1 : hoursFilter === 'week' ? 5 : 20);
            const hoursWorked = user.hoursWorked || 0;
            const progressPercentage = Math.min(Math.round((hoursWorked / totalCapacity) * 100), 100);
            
            // Determinar o status baseado na porcentagem
            let statusClass = '';
            if (progressPercentage > 90) statusClass = 'status-high';
            else if (progressPercentage > 50) statusClass = 'status-medium';
            else statusClass = 'status-low';
            
            return (
              <div key={index} className="user-progress-item">
                <div className="user-info">
                  <div className="user-name">{user.name}</div>
                  <div className="user-capacity">{user.capacity}h/dia</div>
                </div>
                <div className="user-hours-progress">
                  <div className="progress-bar">
                    <div 
                      className={`progress ${statusClass}`}
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                    <span className="progress-text">
                      <span className="hours-worked">{hoursWorked}h</span>
                      <span className="hours-separator">/</span>
                      <span className="hours-total">{totalCapacity}h</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
          
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon="fa-solid fa-hourglass-half" />
            </div>
            <div className="stat-content">
              <h3>{stats.pendingTasks}</h3>
              <p>Pendentes</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <FontAwesomeIcon icon="fa-solid fa-spinner" />
            </div>
            <div className="stat-content">
              <h3>{stats.inProgressTasks}</h3>
              <p>Em Progresso</p>
            </div>
          </div>
        </div>
        
        <DateFilter />
        
        <div className="cards-row">
          <UserProgressCard />
          <div className="charts-container">
            <BacklogTasksChart />
          </div>
        </div>
        
        <div className="section-header">
          <h2>Colaboradores</h2>
          <div className="section-description">
            Visão geral das horas trabalhadas pelos colaboradores no período selecionado
          </div>
        </div>
        
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