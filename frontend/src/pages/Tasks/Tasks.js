import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ENDPOINTS, API_URL } from '../../helpers/Constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
// Usando o toast global definido em nosso componente personalizado
import './Tasks.css';
import './attachment-styles.css';

import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Tasks = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [backlogs, setBacklogs] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSprint, setCurrentSprint] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  // Estado do formulário
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHoursForm, setShowHoursForm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [taskToRegisterHours, setTaskToRegisterHours] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    backlogId: '',
    userId: '',
    estimatedHours: ''
  });
  const [hoursFormData, setHoursFormData] = useState({
    description: '',
    hours: '',
    attachments: []
  });
  const [hourHistory, setHourHistory] = useState([]);
  
  // Estados para anexos
  const [attachments, setAttachments] = useState([]);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [selectedHourRecord, setSelectedHourRecord] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  // Função para buscar tarefas
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const tasksRes = await axios.get(API_ENDPOINTS.TASKS);
      
      // Se o usuário for collaborator, filtra apenas as tarefas dele
      console.log('fetchTasks - user:', user);
      if (user.role === 'collaborator') {
        // Converter para string para garantir comparação correta
        const userId = String(user.id);
        const userTasks = tasksRes.data.filter(task => String(task.userId) === userId);
        console.log('fetchTasks - userId:', userId, 'tipo:', typeof userId);
        console.log('fetchTasks - primeiro task.userId:', tasksRes.data[0]?.userId, 'tipo:', typeof tasksRes.data[0]?.userId);
        console.log('fetchTasks - tarefas filtradas:', userTasks);
        console.log('fetchTasks - todas as tarefas:', tasksRes.data);
        setTasks(userTasks);
      } else {
        setTasks(tasksRes.data);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Erro ao buscar tarefas:', err);
      setLoading(false);
    }
  };
  
  // Buscar tarefas, backlogs, sprints e usuários (se for admin)
  useEffect(() => {
    console.log('useEffect executado, user role:', user.role);
    const fetchData = async () => {
      try {
        setLoading(true);
        
        let sprintsData = [];
        
        if (user.role === 'admin') {
          // Se for admin, busca todos os dados incluindo usuários
          const [tasksRes, backlogsRes, usersRes, sprintsRes] = await Promise.all([
            axios.get(API_ENDPOINTS.TASKS),
            axios.get(API_ENDPOINTS.BACKLOGS),
            axios.get(API_ENDPOINTS.USERS),
            axios.get(API_ENDPOINTS.SPRINTS)
          ]);
          
          setTasks(tasksRes.data);
          setBacklogs(backlogsRes.data);
          setUsers(usersRes.data);
          sprintsData = sprintsRes.data;
          setSprints(sprintsData);
        } else if (user.role === 'collaborator') {
          // Se for collaborator, busca apenas as tarefas do usuário
          const [tasksRes, backlogsRes, sprintsRes] = await Promise.all([
            axios.get(API_ENDPOINTS.TASKS),
            axios.get(API_ENDPOINTS.BACKLOGS),
            axios.get(API_ENDPOINTS.SPRINTS)
          ]);
          
          // Filtra apenas as tarefas atribuídas ao usuário logado
          // Converter para string para garantir comparação correta
          const userId = String(user.id);
          const userTasks = tasksRes.data.filter(task => String(task.userId) === userId);
          console.log('useEffect - userId:', userId, 'tipo:', typeof userId);
          console.log('useEffect - primeiro task.userId:', tasksRes.data[0]?.userId, 'tipo:', typeof tasksRes.data[0]?.userId);
          console.log('useEffect - tarefas filtradas:', userTasks);
          console.log('useEffect - todas as tarefas:', tasksRes.data);
          setTasks(userTasks);
          setBacklogs(backlogsRes.data);
          sprintsData = sprintsRes.data;
          setSprints(sprintsData);
          setUsers([]); // Define uma lista vazia para usuários
        } else {
          // Para outros roles, não busca usuários
          const [tasksRes, backlogsRes, sprintsRes] = await Promise.all([
            axios.get(API_ENDPOINTS.TASKS),
            axios.get(API_ENDPOINTS.BACKLOGS),
            axios.get(API_ENDPOINTS.SPRINTS)
          ]);
          
          setTasks(tasksRes.data);
          setBacklogs(backlogsRes.data);
          sprintsData = sprintsRes.data;
          setSprints(sprintsData);
          setUsers([]); // Define uma lista vazia para usuários
        }
        
        // Encontrar a sprint atual (in_progress)
        const currentActiveSprint = sprintsData.find(sprint => sprint.status === 'in_progress');
        setCurrentSprint(currentActiveSprint || null);
        
        setLoading(false);
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
        setLoading(false);
      }
    };

    fetchData();
  }, [user]); // Adiciona user como dependência para recarregar quando o usuário mudar

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
      
      // Preparar dados da tarefa
      const taskData = {...formData};
      
      // Se não for admin, atribui a tarefa ao próprio usuário
      if (user.role !== 'admin') {
        taskData.userId = user.id;
      } 
      // Se for admin e selecionou "Eu mesmo" (valor vazio), atribui ao próprio admin
      else if (taskData.userId === '') {
        taskData.userId = user.id;
      }
      
      if (formData.id) {
        // Atualizar tarefa existente
        const response = await axios.put(`${API_ENDPOINTS.TASKS}/${formData.id}`, taskData);
        
        // Se o usuário for collaborator, verificar se a tarefa atualizada pertence a ele
        if (user.role === 'collaborator') {
          // Converter para string para garantir comparação correta
          if (String(response.data.userId) === String(user.id)) {
            setTasks(prev => prev.map(item => item.id === formData.id ? response.data : item));
          } else {
            // Se a tarefa não pertence mais ao usuário, remover da lista
            setTasks(prev => prev.filter(item => item.id !== formData.id));
          }
        } else {
          setTasks(prev => prev.map(item => item.id === formData.id ? response.data : item));
        }
      } else {
        // Criar nova tarefa
        const response = await axios.post(API_ENDPOINTS.TASKS, taskData);
        
        // Se o usuário for collaborator, adicionar apenas se a tarefa pertencer a ele
        if (user.role === 'collaborator') {
          // Converter para string para garantir comparação correta
          if (String(response.data.userId) === String(user.id)) {
            setTasks(prev => [response.data, ...prev]);
          }
        } else {
          setTasks(prev => [response.data, ...prev]);
        }
      }
      
      setShowForm(false);
      setFormData({
        title: '',
        description: '',
        backlogId: '',
        userId: ''
      });
      setLoading(false);
    } catch (err) {
      console.error('Erro ao salvar tarefa:', err);
      setError('Erro ao salvar tarefa. Por favor, tente novamente.');
      setLoading(false);
    }
  };

  // Excluir tarefa
  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    
    try {
      setLoading(true);
      await axios.delete(`${API_ENDPOINTS.TASKS}/${taskToDelete.id}`);
      
      // Remover a tarefa da lista local
      setTasks(prev => prev.filter(item => item.id !== taskToDelete.id));
      setShowDeleteConfirm(false);
      setTaskToDelete(null);
      setLoading(false);
    } catch (err) {
      console.error('Erro ao excluir tarefa:', err);
      setError('Erro ao excluir tarefa. Por favor, tente novamente.');
      setLoading(false);
    }
  };

  // Atualizar status da tarefa
  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const response = await axios.put(`${API_ENDPOINTS.TASKS}/${taskId}`, { status: newStatus });
      
      // Atualizar estado local
      // Se o usuário for collaborator, verificar se a tarefa ainda pertence a ele
      if (user.role === 'collaborator') {
        // Converter para string para garantir comparação correta
        if (String(response.data.userId) === String(user.id)) {
          setTasks(prev => prev.map(task => 
            task.id === taskId ? { ...task, status: newStatus } : task
          ));
        }
      } else {
        setTasks(prev => prev.map(task => 
          task.id === taskId ? { ...task, status: newStatus } : task
        ));
      }
    } catch (err) {
      console.error('Erro ao atualizar status da tarefa:', err);
      setError('Erro ao atualizar status. Por favor, tente novamente.');
    }
  };
  
  // Manipular mudanças no formulário de horas
  const handleHoursFormChange = (e) => {
    const { name, value, type, files } = e.target;
    
    if (type === 'file') {
      setHoursFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...Array.from(files)]
      }));
    } else {
      setHoursFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  // Enviar formulário de registro de horas
  const handleHoursSubmit = async (e) => {
    e.preventDefault();
    if (!taskToRegisterHours) return;
    
    // Validar dados
    if (!hoursFormData.hours || !hoursFormData.description) {
      setError('Preencha todos os campos');
      return;
    }
    
    try {
      setLoading(true);
      toast.info('Salvando registro de horas...', { autoClose: false, toastId: 'hoursSaveProgress' });
      
      const hourData = {
        taskId: taskToRegisterHours.id,
        description: hoursFormData.description,
        hours: parseFloat(hoursFormData.hours)
      };
      
      // Enviar para a API
      const response = await axios.post(`${API_ENDPOINTS.HOUR_HISTORY}`, {
        taskId: taskToRegisterHours.id,
        description: hoursFormData.description,
        hours: parseFloat(hoursFormData.hours)
      });
      
      // Se houver anexos, fazer upload
      if (hoursFormData.attachments.length > 0) {
        toast.info(`Enviando ${hoursFormData.attachments.length} anexo(s)...`, { autoClose: false, toastId: 'attachmentsProgress' });
        
        const formData = new FormData();
        hoursFormData.attachments.forEach(file => {
          formData.append('attachments', file);
          
          // Adicionar flag para compressão se for imagem
          const fileType = file.type.toLowerCase();
          const isImage = fileType.includes('image');
          if (isImage) {
            formData.append('compress', 'true');
          }
        });
        
        try {
          await axios.post(`${API_ENDPOINTS.ATTACHMENTS}/${response.data.id}`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            },
            timeout: 30000, // Aumentar timeout para 30 segundos
          });
          toast.dismiss('attachmentsProgress');
          toast.success('Anexos enviados com sucesso!');
        } catch (uploadError) {
          toast.dismiss('attachmentsProgress');
          console.error('Erro ao enviar anexos:', uploadError);
          
          // Mensagem de erro mais detalhada
          let errorMessage = 'Erro ao enviar anexos';
          if (uploadError.code === 'ECONNABORTED') {
            errorMessage = 'Tempo limite excedido ao enviar anexos. O registro de horas foi salvo, mas os anexos não foram enviados.';
          } else if (uploadError.response?.data?.message) {
            errorMessage = `Erro nos anexos: ${uploadError.response.data.message}`;
          } else if (uploadError.message) {
            errorMessage = `Erro nos anexos: ${uploadError.message}`;
          }
          
          toast.error(errorMessage);
        }
      }
      
      toast.dismiss('hoursSaveProgress');
      toast.success('Registro de horas salvo com sucesso!');
      
      // Atualizar a lista de tarefas para refletir as novas horas
      const updatedTasks = await axios.get(API_ENDPOINTS.TASKS);
      
      // Se o usuário for collaborator, filtra apenas as tarefas dele
      if (user.role === 'collaborator') {
        const userTasks = updatedTasks.data.filter(task => task.userId === user.id);
        setTasks(userTasks);
      } else {
        setTasks(updatedTasks.data);
      }
      
      // Limpar formulário e fechar modal
      setHoursFormData({
        description: '',
        hours: '',
        attachments: []
      });
      setShowHoursForm(false);
      setTaskToRegisterHours(null);
      setLoading(false);
    } catch (err) {
      console.error('Erro ao registrar horas:', err);
      setError('Erro ao registrar horas. Por favor, tente novamente.');
      setLoading(false);
    }
  };
  
  // Buscar histórico de horas de uma tarefa
  const fetchTaskHourHistory = async (taskId) => {
    try {
      const response = await axios.get(`${API_ENDPOINTS.HOUR_HISTORY}/task/${taskId}`);
      return response.data;
    } catch (err) {
      console.error('Erro ao buscar histórico de horas:', err);
      return [];
    }
  };
  
  // Buscar anexos de um registro de horas
  const fetchAttachments = async (hourRecordId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_ENDPOINTS.ATTACHMENTS}/hour-record/${hourRecordId}`);
      setAttachments(response.data);
      setSelectedHourRecord(hourRecordId);
      setShowAttachmentsModal(true);
      setPreviewAttachment(null); // Resetar preview ao abrir o modal
      
      // Pré-carregar miniaturas para melhorar a experiência do usuário
      response.data.forEach(attachment => {
        if (attachment.fileType.startsWith('image/')) {
          const img = new Image();
          img.src = `${API_URL}/api/attachments/file/${attachment.id}`;
        }
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Erro ao buscar anexos:', err);
      setError('Erro ao buscar anexos. Por favor, tente novamente.');
      setLoading(false);
    }
  };
  
  // Visualizar preview de um anexo
  const handlePreviewAttachment = (attachment) => {
    // Mostrar indicador de carregamento
    toast.info('Carregando visualização...', { autoClose: false, toastId: 'loadingPreview' });
    setPreviewAttachment(attachment);
  };
  
  // Fechar preview
  const closePreview = () => {
    setPreviewAttachment(null);
  };
  
  // Excluir um anexo
  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Tem certeza que deseja excluir este anexo?')) {
      return;
    }
    
    try {
      setLoading(true);
      toast.info('Excluindo anexo...', { autoClose: false, toastId: 'deleteProgress' });
      
      await axios.delete(`${API_ENDPOINTS.ATTACHMENTS}/${attachmentId}`);
      
      toast.dismiss('deleteProgress');
      toast.success('Anexo excluído com sucesso!');
      
      // Atualizar lista de anexos
      if (selectedHourRecord) {
        const response = await axios.get(`${API_ENDPOINTS.ATTACHMENTS}/hour-record/${selectedHourRecord}`);
        setAttachments(response.data);
      }
      
      // Fechar preview se o anexo excluído for o que está sendo visualizado
      if (previewAttachment && previewAttachment.id === attachmentId) {
        setPreviewAttachment(null);
      }
      
      setLoading(false);
    } catch (err) {
      toast.dismiss('deleteProgress');
      console.error('Erro ao excluir anexo:', err);
      toast.error('Erro ao excluir anexo. Por favor, tente novamente.');
      setLoading(false);
    }
  };
  
  // Excluir registro de horas
  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) {
      return;
    }
    
    try {
      setLoading(true);
      await axios.delete(`${API_ENDPOINTS.HOUR_HISTORY}/${recordId}`);
      
      // Atualizar histórico de horas
      if (taskToRegisterHours) {
        const updatedHistory = await fetchTaskHourHistory(taskToRegisterHours.id);
        setHourHistory(updatedHistory);
      }
      
      // Atualizar lista de tarefas
      fetchTasks();
      setLoading(false);
    } catch (err) {
      console.error('Erro ao excluir registro:', err);
      setError('Erro ao excluir registro. Por favor, tente novamente.');
      setLoading(false);
    }
  };

  // Obter classe de status
  const getStatusClass = (status) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'in_progress': return 'status-in-progress';
      case 'completed': return 'status-completed';
      default: return '';
    }
  };
  
  // Formatar data
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Formatar tamanho do arquivo
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  // Obter ícone com base no tipo de arquivo
  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return 'image';
    else if (fileType === 'application/pdf') return 'file-pdf';
    else if (fileType.includes('word')) return 'file-word';
    else if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'file-excel';
    else return 'file';
  };
  
  // Verificar se o usuário pode excluir um registro de horas
  const canDeleteRecord = (record) => {
    // Administradores podem excluir qualquer registro
    if (user.role === 'admin') return true;
    
    // Usuários só podem excluir seus próprios registros
    // Converter para string para garantir comparação correta
    return String(record.userId) === String(user.id);
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

  // Filtrar tarefas por status
  const filterTasksByStatus = (status) => {
    // As tarefas já devem estar filtradas por usuário no useEffect e fetchTasks
    // Aqui apenas filtramos por status
    if (status === 'all') {
      return tasks;
    }
    return tasks.filter(task => task.status === status);
  };

  if (loading && tasks.length === 0) {
    return <div className="tasks-loading">Carregando...</div>;
  }

  // Definição das colunas da tabela
  const pendingColumns = [
    { key: 'title', header: 'Título' },
    { key: 'backlog', header: 'Backlog' },
    { key: 'assignee', header: 'Responsável' },
    { key: 'estimate', header: 'Estimativa' },
    { key: 'actions', header: 'Ações' }
  ];

  const inProgressColumns = [
    { key: 'title', header: 'Título' },
    { key: 'backlog', header: 'Backlog' },
    { key: 'assignee', header: 'Responsável' },
    { key: 'estimate', header: 'Estimativa' },
    { key: 'actions', header: 'Ações' }
  ];

  const completedColumns = [
    { key: 'title', header: 'Título' },
    { key: 'backlog', header: 'Backlog' },
    { key: 'assignee', header: 'Responsável' },
    { key: 'estimate', header: 'Estimativa' },
    { key: 'hours', header: 'Horas' },
    { key: 'actions', header: 'Ações' }
  ];

  // Preparar dados para as tabelas
  const prepareTasksData = (tasks, status) => {
    return filterTasksByStatus(status).map(task => ({
      id: task.id,
      title: task.title,
      backlog: task.Backlog?.title || 'Sem backlog',
      assignee: task.User?.name || 'Não atribuído',
      hours: task.hoursSpent || 0,
      estimate: task.estimatedHours ? `${task.estimatedHours} horas` : 'Não definida',
      description: task.description,
      status: task.status,
      raw: task
    }));
  };

  // Renderizar células de ação
  // Abrir modal de registro de horas
  const openHoursModal = async (task) => {
    setTaskToRegisterHours(task);
    // Buscar histórico de horas da tarefa
    const history = await fetchTaskHourHistory(task.id);
    setHourHistory(history);
    setShowHoursForm(true);
  };

  const renderPendingActions = (row) => (
    <div className="table-actions">
      <button 
        className="btn-start-task"
        onClick={() => updateTaskStatus(row.id, 'in_progress')}
      >
        <FontAwesomeIcon icon="play" /> Iniciar
      </button>
      <button 
        className="action-btn register-hours"
        title="Registrar Horas"
        onClick={(e) => {
          e.stopPropagation();
          openHoursModal(row.raw);
        }}
      >
        <FontAwesomeIcon icon="clock" />
      </button>

      <button 
        className="action-btn edit"
        title="Editar"
        onClick={(e) => {
          e.stopPropagation();
          setFormData(row.raw);
          setShowForm(true);
        }}
      >
        <FontAwesomeIcon icon="edit" />
      </button>
      <button 
        className="action-btn delete"
        title="Excluir"
        onClick={(e) => {
          e.stopPropagation();
          setTaskToDelete(row.raw);
          setShowDeleteConfirm(true);
        }}
      >
        <FontAwesomeIcon icon="trash" />
      </button>
    </div>
  );

  const renderInProgressActions = (row) => (
    <div className="table-actions">
      <button 
        className="btn-complete-task"
        onClick={() => updateTaskStatus(row.id, 'completed')}
      >
        <FontAwesomeIcon icon="check" /> Concluir
      </button>
      <button 
        className="action-btn register-hours"
        title="Registrar Horas"
        onClick={(e) => {
          e.stopPropagation();
          openHoursModal(row.raw);
        }}
      >
        <FontAwesomeIcon icon="fa-solid fa-clock" />
      </button>

      <button 
        className="action-btn edit"
        title="Editar"
        onClick={(e) => {
          e.stopPropagation();
          setFormData(row.raw);
          setShowForm(true);
        }}
      >
        <FontAwesomeIcon icon="fa-solid fa-edit" />
      </button>
      <button 
        className="action-btn delete"
        title="Excluir"
        onClick={(e) => {
          e.stopPropagation();
          setTaskToDelete(row.raw);
          setShowDeleteConfirm(true);
        }}
      >
        <FontAwesomeIcon icon="fa-solid fa-trash" />
      </button>
    </div>
  );
  
  const renderCompletedActions = (row) => (
    <div className="table-actions">
      <button 
        className="action-btn register-hours"
        title="Registrar Horas"
        onClick={(e) => {
          e.stopPropagation();
          openHoursModal(row.raw);
        }}
      >
        <FontAwesomeIcon icon="fa-solid fa-clock" />
      </button>

      <button 
        className="action-btn edit"
        title="Editar"
        onClick={(e) => {
          e.stopPropagation();
          setFormData(row.raw);
          setShowForm(true);
        }}
      >
        <FontAwesomeIcon icon="fa-solid fa-edit" />
      </button>
      <button 
        className="action-btn delete"
        title="Excluir"
        onClick={(e) => {
          e.stopPropagation();
          setTaskToDelete(row.raw);
          setShowDeleteConfirm(true);
        }}
      >
        <FontAwesomeIcon icon="fa-solid fa-trash" />
      </button>
    </div>
  );
  
  // Renderizar ações com base no status da tarefa
  const renderTaskActions = (row) => {
    switch (row.status) {
      case 'pending':
        return renderPendingActions(row);
      case 'in_progress':
        return renderInProgressActions(row);
      case 'completed':
        return renderCompletedActions(row);
      default:
        return null;
    }
  };

  return (
    <div className="tasks-container">
      <div className="tasks-header">
        <h1>Tarefas</h1>
        <button 
          className="btn-add-task" 
          onClick={() => setShowForm(true)}
          title={'Adicionar nova tarefa'}
        >
          <FontAwesomeIcon icon="plus" /> Nova Tarefa
        </button>
      </div>

      {error && <div className="tasks-error">{error}</div>}

      <Modal 
        isOpen={showForm} 
        onClose={() => setShowForm(false)} 
        title={formData.id ? "Editar Tarefa" : "Nova Tarefa"}
      >
        <form onSubmit={handleSubmit} className="task-form">
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
              <label htmlFor="sprintId">Sprint Atual</label>
              <select
                id="sprintId"
                name="sprintId"
                value={currentSprint?.id || ''}
                disabled
                className="readonly-select"
              >
                <option value={currentSprint?.id || ''}>
                  {currentSprint ? `${currentSprint.name} (atual)` : 'Nenhuma sprint em progresso'}
                </option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="backlogId">Backlog</label>
              <select
                id="backlogId"
                name="backlogId"
                value={formData.backlogId}
                onChange={handleChange}
                required
              >
                <option value="">Selecione um backlog</option>
                {currentSprint ? (
                  backlogs.map(backlog => (
                    <option key={backlog.id} value={backlog.id}>
                      {backlog.title}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>Não há sprint em progresso</option>
                )}
                {currentSprint && backlogs.length === 0 && (
                  <option value="" disabled>Não há backlogs disponíveis</option>
                )}
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="estimatedHours">Estimativa de Horas</label>
            <input
              type="number"
              id="estimatedHours"
              name="estimatedHours"
              value={formData.estimatedHours}
              onChange={handleChange}
              min="0"
              step="0.5"
              placeholder="Estimativa em horas"
            />
          </div>

          {/* Campo de seleção de usuário responsável (apenas para administradores) */}
          {user && user.role === 'admin' && (
            <div className="form-group">
              <label htmlFor="userId">Responsável</label>
              <select
                id="userId"
                name="userId"
                value={formData.userId}
                onChange={handleChange}
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn-submit" 
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Salvar Tarefa'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirmar Exclusão">
        <div className="delete-confirm">
          <p>Tem certeza que deseja excluir a tarefa <strong>{taskToDelete?.title}</strong>?</p>
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
              onClick={() => handleDeleteTask()}
              disabled={loading}
            >
              {loading ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de registro de horas */}
      <Modal isOpen={showHoursForm} onClose={() => setShowHoursForm(false)} title="Registrar Horas">
        <form onSubmit={handleHoursSubmit} className="hours-form">
          <div className="form-group">
            <label>Tarefa</label>
            <div className="task-info">
              <FontAwesomeIcon icon="fa-solid fa-tasks" style={{ marginRight: '8px' }} />
              {taskToRegisterHours?.title}
            </div>
          </div>
          
          <div className="task-hours-info">
            <div className="hours-info-item">
              <span className="info-label">
                <FontAwesomeIcon icon="fa-solid fa-hourglass" style={{ marginRight: '5px' }} />
                Estimativa
              </span>
              <span>{taskToRegisterHours?.estimatedHours ? `${taskToRegisterHours.estimatedHours}h` : 'Não definida'}</span>
            </div>
            <div className="hours-info-item">
              <span className="info-label">
                <FontAwesomeIcon icon="fa-solid fa-clock" style={{ marginRight: '5px' }} />
                Horas Registradas
              </span>
              <span className="hours-spent">{hourHistory.reduce((total, record) => total + parseFloat(record.hours), 0).toFixed(1)}h</span>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="hours">
              <FontAwesomeIcon icon="fa-solid fa-stopwatch" style={{ marginRight: '5px' }} />
              Horas Trabalhadas
            </label>
            <div className="input-with-icon">
              <input
                type="number"
                id="hours"
                name="hours"
                value={hoursFormData.hours}
                onChange={handleHoursFormChange}
                min="0.1"
                step="0.1"
                required
                placeholder="Horas trabalhadas"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="description">
              <FontAwesomeIcon icon="fa-solid fa-file-alt" style={{ marginRight: '5px' }} />
              Descrição da Atividade
            </label>
            <textarea
              id="description"
              name="description"
              value={hoursFormData.description}
              onChange={handleHoursFormChange}
              rows="3"
              required
              placeholder="Descreva o que foi realizado"
            ></textarea>
          </div>
          
          <div className="form-group">
            <label>
              <FontAwesomeIcon icon="paperclip" style={{ marginRight: '5px' }} />
              Anexos (Fotos, PDFs, Documentos)
            </label>
            <div className="file-upload-container">
              <input
                type="file"
                id="attachments"
                name="attachments"
                multiple
                onChange={(e) => {
                  setHoursFormData({
                    ...hoursFormData,
                    attachments: [...hoursFormData.attachments, ...Array.from(e.target.files)]
                  });
                }}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              />
              <div className="file-upload-info">
                <small>Máximo 5 arquivos (10MB cada). Formatos: imagens, PDF, Word, Excel</small>
              </div>
              {hoursFormData.attachments.length > 0 && (
                <div className="selected-files">
                  <p>Arquivos selecionados:</p>
                  <ul>
                    {hoursFormData.attachments.map((file, index) => (
                      <li key={index}>
                        {file.name}
                        <button 
                          type="button" 
                          className="remove-file" 
                          onClick={() => {
                            const newAttachments = [...hoursFormData.attachments];
                            newAttachments.splice(index, 1);
                            setHoursFormData({
                              ...hoursFormData,
                              attachments: newAttachments
                            });
                          }}
                        >
                          <FontAwesomeIcon icon="times" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          
          <div className="form-actions">
            <button 
              type="button" 
              className="btn-cancel" 
              onClick={() => setShowHoursForm(false)}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn-submit" 
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Registrar Horas'}
            </button>
          </div>
        </form>
        
        {/* Histórico de Horas */}
        <div className="hour-history-section">
          <h3>Histórico de Horas</h3>
          {hourHistory.length === 0 ? (
            <p>Nenhum registro de horas encontrado.</p>
          ) : (
            <table className="hour-history-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Horas</th>
                  <th>Descrição</th>
                  <th>Usuário</th>
                  <th>Anexos</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {hourHistory.map(record => (
                  <tr key={record.id}>
                    <td>{formatDate(record.createdAt)}</td>
                    <td>{record.hours}</td>
                    <td>{record.description}</td>
                    <td>{record.User?.name || 'N/A'}</td>
                    <td>
                      <button 
                        className="btn-action btn-view-attachments" 
                        onClick={() => fetchAttachments(record.id)}
                        title="Ver Anexos"
                      >
                        <FontAwesomeIcon icon="paperclip" />
                      </button>
                    </td>
                    <td>
                      {canDeleteRecord(record) && (
                        <button 
                          className="btn-action btn-delete" 
                          onClick={() => handleDeleteRecord(record.id)}
                          title="Excluir Registro"
                        >
                          <FontAwesomeIcon icon="trash" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
      
      {/* Modal de visualização de anexos */}
      <Modal isOpen={showAttachmentsModal} onClose={() => setShowAttachmentsModal(false)} title="Anexos do Registro">
        <div className="attachments-container">
          {attachments.length === 0 ? (
            <p>Nenhum anexo encontrado para este registro.</p>
          ) : (
            <div className="attachments-list">
              {attachments.map(attachment => (
                <div key={attachment.id} className="attachment-item">
                  <div className="attachment-info">
                    <span className="attachment-name">
                      <FontAwesomeIcon 
                        icon={getFileIcon(attachment.fileType)} 
                        style={{ marginRight: '8px' }} 
                      />
                      {attachment.originalFilename}
                    </span>
                    <span className="attachment-size">
                      {formatFileSize(attachment.fileSize)}
                    </span>
                  </div>
                  <div className="attachment-actions">
                    <button 
                      className="btn-action btn-view" 
                      onClick={() => handlePreviewAttachment(attachment)}
                      title="Visualizar Anexo"
                    >
                      <FontAwesomeIcon icon="eye" />
                    </button>
                    {(user.role === 'admin' || user.id === attachment.userId) && (
                      <button 
                        className="btn-action btn-delete" 
                        onClick={() => handleDeleteAttachment(attachment.id)}
                        title="Excluir Anexo"
                      >
                        <FontAwesomeIcon icon="trash" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {previewAttachment && (
            <div className="attachment-preview">
              <div className="preview-title">
                <span>Visualizando: {previewAttachment.originalFilename}</span>
                <button className="close-preview" onClick={closePreview}>
                  <FontAwesomeIcon icon="times" />
                </button>
              </div>
              <div className="attachment-preview-container">
                {previewAttachment.fileType.startsWith('image/') ? (
                  <>
                    <img 
                      src={`${API_URL}/api/attachments/file/${previewAttachment.id}?cache=${Date.now()}`} 
                      alt={previewAttachment.originalFilename}
                      loading="eager"
                      onLoad={() => toast.dismiss('loadingPreview')}
                      onError={() => {
                        toast.dismiss('loadingPreview');
                        toast.error('Erro ao carregar imagem');
                      }}
                    />
                    {previewAttachment.isCompressed && (
                      <div className="compressed-badge">
                        <FontAwesomeIcon icon="compress" /> Comprimido
                      </div>
                    )}
                  </>
                ) : previewAttachment.fileType === 'application/pdf' ? (
                  <>
                    <iframe 
                      src={`${API_URL}/api/attachments/file/${previewAttachment.id}?cache=${Date.now()}`} 
                      title={previewAttachment.originalFilename}
                      onLoad={() => toast.dismiss('loadingPreview')}
                    ></iframe>
                    {previewAttachment.isCompressed && (
                      <div className="compressed-badge">
                        <FontAwesomeIcon icon="compress" /> Comprimido
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <p>Este tipo de arquivo não pode ser visualizado diretamente.</p>
                    <a 
                      href={`${API_URL}/api/attachments/file/${previewAttachment.id}?cache=${Date.now()}`} 
                      download={previewAttachment.originalFilename}
                      className="btn btn-primary"
                    >
                      Baixar arquivo
                    </a>
                    {previewAttachment.isCompressed && (
                      <div className="compressed-badge">
                        <FontAwesomeIcon icon="compress" /> Comprimido
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <div className="tasks-unified">
        <div className="status-filter">
          <label htmlFor="status-select">Filtrar por status:</label>
          <select 
            id="status-select" 
            value={selectedStatus} 
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="status-select"
          >
            <option value="all">Todas as tarefas</option>
            <option value="pending">Pendentes</option>
            <option value="in_progress">Em Progresso</option>
            <option value="completed">Concluídas</option>
          </select>
          <div className="task-count-info">
            {selectedStatus === 'all' ? (
              <span>Total: {tasks.length} tarefas</span>
            ) : (
              <span>{getStatusLabel(selectedStatus)}: {filterTasksByStatus(selectedStatus).length} tarefas</span>
            )}
          </div>
        </div>
        
        <div className="tasks-table">
          <Table 
            columns={[
              { key: 'title', header: 'Título' },
              { key: 'backlog', header: 'Backlog' },
              { key: 'assignee', header: 'Responsável' },
              { key: 'estimate', header: 'Estimativa' },
              { 
                key: 'status', 
                header: 'Status', 
                render: (row) => (
                  <div className={`status-tag status-${row.status}`}>
                    {getStatusLabel(row.status)}
                  </div>
                ) 
              },
              ...(selectedStatus === 'all' || selectedStatus === 'completed' ? [
                { 
                  key: 'hours', 
                  header: 'Horas',
                  render: (row) => row.status === 'completed' ? (
                    <div className="hours-cell">
                      <FontAwesomeIcon icon="fa-solid fa-clock" />&nbsp;
                      <span>{row.hours} horas</span>
                    </div>
                  ) : null
                }
              ] : [])
            ]}
            data={prepareTasksData(tasks, selectedStatus)}
            actions={renderTaskActions}
            emptyMessage={`Nenhuma tarefa ${selectedStatus === 'all' ? '' : getStatusLabel(selectedStatus).toLowerCase()}`}
          />
        </div>
      </div>
    </div>
  );
};

export default Tasks;