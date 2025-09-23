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

// Estilos para as tags de prioridade e tipo
const priorityStyles = `
  .priority-tag {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
    text-align: center;
  }
  
  .priority-baixa {
    background-color: #e0f7fa;
    color: #006064;
  }
  
  .priority-media {
    background-color: #e8f5e9;
    color: #1b5e20;
  }
  
  .priority-alta {
    background-color: #fff3e0;
    color: #e65100;
  }
  
  .priority-critica {
    background-color: #ffebee;
    color: #b71c1c;
  }
  
  .type-tag {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
  }
  
  /* Estilos para o modal de detalhes da tarefa */
  .task-details {
    background-color: #ffffff;
    border-radius: 12px;
    max-width: 100%;
  }
  
  .task-details-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    padding-bottom: 15px;
    border-bottom: 1px solid #eaeaea;
    position: relative;
  }
  
  .task-details-header h2 {
    margin: 0;
    font-size: 1.6rem;
    color: #2c3e50;
    display: flex;
    align-items: center;
    font-weight: 600;
  }
  
  .task-details-header .task-icon {
    margin-right: 12px;
    color: #5d6d7e;
    font-size: 1.2rem;
  }
  
  .task-details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    margin-bottom: 25px;
  }
  
  .info-card {
    background: linear-gradient(145deg, #ffffff, #f8f9fa);
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    overflow: hidden;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  
  .info-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.08);
  }
  
  .info-card-header {
    background: linear-gradient(145deg, #f0f0f0, #e0e0e0);
    color: #333;
    padding: 12px 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    letter-spacing: 0.5px;
  }
  
  .info-card-header svg {
    margin-right: 10px;
    font-size: 1.1rem;
  }
  
  .info-card-content {
    padding: 18px;
  }
  
  .info-row {
    display: flex;
    margin-bottom: 14px;
    align-items: center;
    transition: transform 0.2s ease;
  }
  
  .info-row:hover {
    transform: translateX(5px);
  }
  
  .info-row:last-child {
    margin-bottom: 0;
  }
  
  .info-label {
    font-weight: 600;
    width: 140px;
    color: #5d6d7e;
    display: flex;
    align-items: center;
  }
  
  .info-label svg {
    margin-right: 8px;
    color: #5d6d7e;
  }
  
  .info-value {
    flex: 1;
    color: #2c3e50;
    font-weight: 500;
  }
  
  .task-description-card {
    background: linear-gradient(145deg, #ffffff, #f8f9fa);
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    overflow: hidden;
    margin-bottom: 25px;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  
  .task-description-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.08);
  }
  

  
  @media (max-width: 768px) {
    .task-details-grid {
      grid-template-columns: 1fr;
    }
    
    .task-details-header {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .task-details-header .task-status {
      margin-top: 10px;
    }
    
    .info-row {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .info-label {
      width: 100%;
      margin-bottom: 5px;
    }
  }
  
  .description-content {
    padding: 15px;
    min-height: 100px;
  }
  
  .description-text {
    white-space: pre-wrap;
    line-height: 1.5;
  }
  
  .no-description {
    color: #999;
    font-style: italic;
    display: flex;
    align-items: center;
  }
  
  .no-description svg {
    margin-right: 5px;
  }
  
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }
  
  .btn-close {
    background-color: #f44336;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    font-weight: bold;
    transition: background-color 0.3s;
  }
  
  .btn-close:hover {
    background-color: #d32f2f;
  }
  
  .btn-close svg {
    margin-right: 5px;
  }
  
  .type-tag {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
    text-align: center;
  }
  
  .type-feature {
    background-color: #e3f2fd;
    color: #0d47a1;
  }
  
  .type-bug {
    background-color: #fce4ec;
    color: #880e4f;
  }
  
  .type-chamado {
    background-color: #f3e5f5;
    color: #4a148c;
  }
`;

// Adicionar estilos ao documento
const styleElement = document.createElement('style');
styleElement.type = 'text/css';
styleElement.appendChild(document.createTextNode(priorityStyles));
document.head.appendChild(styleElement);

const Tasks = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [backlogs, setBacklogs] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados para filtros
  const [filters, setFilters] = useState({
    backlog: '',
    sprint: '',
    type: '',
    priority: '',
    user: ''
  });
  const [currentSprint, setCurrentSprint] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  // Estado do formulário
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHoursForm, setShowHoursForm] = useState(false);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [taskToRegisterHours, setTaskToRegisterHours] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    backlogId: '',
    userId: '',
    estimatedHours: '',
    priority: 'media',
    type: 'feature'
  });
  const [hoursFormData, setHoursFormData] = useState({
    description: '',
    hours: '',
    startTime: '',
    endTime: '',
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
  
  // Opções de prioridade
  const priorityOptions = [
    { value: 'baixa', label: 'Baixa' },
    { value: 'media', label: 'Média' },
    { value: 'alta', label: 'Alta' },
    { value: 'critica', label: 'Crítica' }
  ];
  
  // Opções de tipo
  const typeOptions = [
    { value: 'feature', label: 'Inovação' },
    { value: 'bug', label: 'Correção' },
    { value: 'chamado', label: 'Otimização' }
  ];

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
      
      // Converter estimatedHours para número se não estiver vazio
      if (taskData.estimatedHours) {
        taskData.estimatedHours = parseFloat(taskData.estimatedHours);
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
        
        // Recarregar todas as tarefas para garantir que a tabela seja atualizada corretamente
        await fetchTasks();
      }
      
      setShowForm(false);
      setFormData({
        title: '',
        description: '',
        backlogId: '',
        userId: '',
        estimatedHours: '',
        priority: 'media',
        type: 'feature'
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
      // Verificar se o usuário é o responsável pela tarefa quando estiver iniciando
      if (newStatus === 'in_progress') {
        const taskToUpdate = tasks.find(task => task.id === taskId);
        if (taskToUpdate && String(taskToUpdate.userId) !== String(user.id)) {
          toast.error('Você não pode iniciar uma tarefa que não é de sua autoria!');
          return;
        }
      }
      
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
    if (!hoursFormData.startTime || !hoursFormData.endTime || !hoursFormData.description) {
      setError('Preencha todos os campos');
      return;
    }
    
    // Calcular horas trabalhadas
    const calculatedHours = calculateHours(hoursFormData.startTime, hoursFormData.endTime);
    
    try {
      setLoading(true);
      toast.info('Salvando registro de horas...', { autoClose: false, toastId: 'hoursSaveProgress' });
      
      const hourData = {
        taskId: taskToRegisterHours.id,
        description: hoursFormData.description,
        hours: calculatedHours
      };
      
      // Enviar para a API
      const response = await axios.post(`${API_ENDPOINTS.HOUR_HISTORY}`, {
        taskId: taskToRegisterHours.id,
        description: hoursFormData.description,
        hours: calculatedHours
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
      
      // Atualizar o histórico de horas para a tarefa atual
      if (taskToRegisterHours) {
        const updatedHistory = await fetchTaskHourHistory(taskToRegisterHours.id);
        console.log('Histórico atualizado após registro:', updatedHistory);
        setHourHistory(updatedHistory);
      }
      
      // Atualizar a lista de tarefas para refletir as novas horas
      const updatedTasks = await axios.get(API_ENDPOINTS.TASKS);
      
      // Se o usuário for collaborator, filtra apenas as tarefas dele
      if (user.role === 'collaborator') {
        const userTasks = updatedTasks.data.filter(task => task.userId === user.id);
        setTasks(userTasks);
      } else {
        setTasks(updatedTasks.data);
      }
      
      // Limpar formulário e manter o modal aberto para mostrar o histórico atualizado
      setHoursFormData({
        description: '',
        startTime: '',
        endTime: '',
        attachments: []
      });
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
      // Usando o endpoint correto conforme definido no backend
      const response = await axios.get(`${API_ENDPOINTS.HOUR_HISTORY}/task/${taskId}`);
      console.log('Histórico de horas recebido:', response.data);
      // Verificar se os dados estão vindo corretamente
      if (response.data && Array.isArray(response.data)) {
        console.log('Número de registros:', response.data.length);
        response.data.forEach((record, index) => {
          console.log(`Registro ${index}:`, record);
          console.log(`Horas do registro ${index}:`, record.hours);
        });
      }
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
  
  // Calcular horas trabalhadas a partir dos horários de início e fim
  const calculateHours = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    
    // Converter strings de hora para objetos Date
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    // Criar objetos Date com a data atual
    const start = new Date();
    start.setHours(startHour, startMinute, 0, 0);
    
    const end = new Date();
    end.setHours(endHour, endMinute, 0, 0);
    
    // Se o horário de fim for menor que o de início, assumimos que passou para o dia seguinte
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    // Calcular a diferença em milissegundos e converter para horas
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return diffHours;
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

  // Filtrar tarefas por status e outros filtros
  const filterTasksByStatus = (status) => {
    // As tarefas já devem estar filtradas por usuário no useEffect e fetchTasks
    // Aqui filtramos por status e outros filtros
    let filteredTasks = tasks;
    
    if (status !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.status === status);
    }
    
    // Aplicar filtros adicionais
    if (filters.backlog) {
      filteredTasks = filteredTasks.filter(task => task.backlogId === parseInt(filters.backlog));
    }
    
    if (filters.sprint) {
      filteredTasks = filteredTasks.filter(task => task.sprintId === parseInt(filters.sprint));
    }
    
    if (filters.type) {
      filteredTasks = filteredTasks.filter(task => task.type === filters.type);
    }
    
    if (filters.priority) {
      filteredTasks = filteredTasks.filter(task => task.priority === filters.priority);
    }
    
    if (filters.user && user.role === 'admin') {
      filteredTasks = filteredTasks.filter(task => String(task.userId) === String(filters.user));
    }
    
    return filteredTasks;
  };
  
  // Limpar filtros
  const clearFilters = () => {
    setFilters({
      backlog: '',
      sprint: '',
      type: '',
      priority: '',
      user: ''
    });
  };
  
  // Atualizar filtros
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
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
    { 
      key: 'priority', 
      header: 'Prioridade',
      render: (row) => (
        <div className={`priority-tag ${getPriorityClass(row.priority)}`}>
          {getPriorityLabel(row.priority)}
        </div>
      ) 
    },
    { 
      key: 'type', 
      header: 'Tipo',
      render: (row) => (
        <div className={`type-tag type-${row.type}`}>
          {getTypeLabel(row.type)}
        </div>
      ) 
    },
    { key: 'actions', header: 'Ações' }
  ];

  const inProgressColumns = [
    { key: 'title', header: 'Título' },
    { key: 'backlog', header: 'Backlog' },
    { key: 'assignee', header: 'Responsável' },
    { key: 'estimate', header: 'Estimativa' },
    { 
      key: 'priority', 
      header: 'Prioridade',
      render: (row) => (
        <div className={`priority-tag ${getPriorityClass(row.priority)}`}>
          {getPriorityLabel(row.priority)}
        </div>
      ) 
    },
    { 
      key: 'type', 
      header: 'Tipo',
      render: (row) => (
        <div className={`type-tag type-${row.type}`}>
          {getTypeLabel(row.type)}
        </div>
      ) 
    },
    { key: 'actions', header: 'Ações' }
  ];

  const completedColumns = [
    { key: 'title', header: 'Título' },
    { key: 'backlog', header: 'Backlog' },
    { key: 'assignee', header: 'Responsável' },
    { key: 'estimate', header: 'Estimativa' },
    { 
      key: 'priority', 
      header: 'Prioridade',
      render: (row) => (
        <div className={`priority-tag ${getPriorityClass(row.priority)}`}>
          {getPriorityLabel(row.priority)}
        </div>
      ) 
    },
    { 
      key: 'type', 
      header: 'Tipo',
      render: (row) => (
        <div className={`type-tag type-${row.type}`}>
          {getTypeLabel(row.type)}
        </div>
      ) 
    },
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
      priority: task.priority || 'media',
      type: task.type || 'feature',
      raw: task
    }));
  };
  
  // Obter label para prioridade
  const getPriorityLabel = (priority) => {
    const priorityMap = {
      'baixa': 'Baixa',
      'media': 'Média',
      'alta': 'Alta',
      'critica': 'Crítica'
    };
    return priorityMap[priority] || 'Média';
  };
  
  // Obter label para tipo
  const getTypeLabel = (type) => {
    const typeMap = {
      'feature': 'Inovação',
      'bug': 'Correção',
      'chamado': 'Otimização'
    };
    return typeMap[type] || 'Inovação';
  };
  
  // Obter classe CSS para prioridade
  const getPriorityClass = (priority) => {
    return `priority-${priority}`;
  };

  // Renderizar células de ação
  // Abrir modal de registro de horas
  const openHoursModal = async (task) => {
    setTaskToRegisterHours(task);
    // Buscar histórico de horas da tarefa
    const history = await fetchTaskHourHistory(task.id);
    console.log('Histórico obtido para o modal:', history);
    
    // Garantir que o histórico seja um array válido
    if (Array.isArray(history)) {
      setHourHistory(history);
    } else {
      console.error('Histórico de horas não é um array:', history);
      setHourHistory([]);
    }
    
    // Resetar formulário de horas
    setHoursFormData({
      description: '',
      hours: '',
      startTime: '',
      endTime: '',
      attachments: []
    });
    
    setShowHoursForm(true);
  };

  const renderPendingActions = (row) => {
    // Verificar se o usuário atual é o responsável pela tarefa
    const isResponsible = String(row.raw.userId) === String(user.id);
    const startButtonTitle = isResponsible ? "Iniciar" : "Apenas o responsável pode iniciar esta tarefa";
    
    return (
    <div className="table-actions">
      <button 
        className={`btn-start-task ${!isResponsible ? 'disabled' : ''}`}
        onClick={() => updateTaskStatus(row.id, 'in_progress')}
        title={startButtonTitle}
        disabled={!isResponsible}
      >
        <FontAwesomeIcon icon="play" /> Iniciar
      </button>
      <button 
        className="action-btn view"
        title="Detalhar"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTask(row.raw);
          setShowTaskDetails(true);
        }}
      >
        <FontAwesomeIcon icon="eye" />
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
};

  const renderInProgressActions = (row) => (
    <div className="table-actions">
      <button 
        className="btn-complete-task"
        onClick={() => updateTaskStatus(row.id, 'completed')}
      >
        <FontAwesomeIcon icon="check" /> Concluir
      </button>
      <button 
        className="action-btn view"
        title="Detalhar"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTask(row.raw);
          setShowTaskDetails(true);
        }}
      >
        <FontAwesomeIcon icon="eye" />
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
        className="action-btn view"
        title="Detalhar"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTask(row.raw);
          setShowTaskDetails(true);
        }}
      >
        <FontAwesomeIcon icon="eye" />
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
    <>
    <div className="tasks-container">
      <div className="tasks-header">
        <h1>Tarefas</h1>
        <button 
          className="btn-add-task" 
          onClick={() => {
            setFormData({
              title: '',
              description: '',
              backlogId: '',
              userId: '',
              estimatedHours: '',
              priority: 'media',
              type: 'feature'
            });
            setShowForm(true);
          }}
          title={'Adicionar nova tarefa'}
        >
          <FontAwesomeIcon icon="plus" /> Nova Tarefa
        </button>
      </div>

      {/* Filtros */}
      <div className="tasks-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Backlog:</label>
            <select 
              name="backlog" 
              value={filters.backlog} 
              onChange={handleFilterChange}
            >
              <option value="">Todos</option>
              {backlogs.map(backlog => (
                <option key={backlog.id} value={backlog.id}>{backlog.title}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Status:</label>
            <select 
              value={selectedStatus} 
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">Todas as tarefas</option>
              <option value="pending">Pendentes</option>
              <option value="in_progress">Em Progresso</option>
              <option value="completed">Concluídas</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Tipo:</label>
            <select 
              name="type" 
              value={filters.type} 
              onChange={handleFilterChange}
            >
              <option value="">Todos</option>
              {typeOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Prioridade:</label>
            <select 
              name="priority" 
              value={filters.priority} 
              onChange={handleFilterChange}
            >
              <option value="">Todas</option>
              {priorityOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          
          {user.role === 'admin' && (
            <div className="filter-group">
              <label>Usuário:</label>
              <select 
                name="user" 
                value={filters.user} 
                onChange={handleFilterChange}
              >
                <option value="">Todos</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="task-count-info">
            {selectedStatus === 'all' ? (
              <span>Total: {tasks.length} tarefas</span>
            ) : (
              <span>{getStatusLabel(selectedStatus)}: {filterTasksByStatus(selectedStatus).length} tarefas</span>
            )}
          </div>
          
          <button className="btn-clear-filters" onClick={clearFilters}>
            <FontAwesomeIcon icon="times" /> Limpar
          </button>
        </div>
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
          
          <div className="form-row">
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
            
            <div className="form-group">
              <label htmlFor="priority">Prioridade</label>
              <select
                id="priority"
                name="priority"
                value={formData.priority || 'media'}
                onChange={handleChange}
                required
              >
                {priorityOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="type">Tipo</label>
            <select
              id="type"
              name="type"
              value={formData.type || 'feature'}
              onChange={handleChange}
              required
            >
              {typeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
                <option value="">Eu mesmo</option>
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
              <span className="hours-spent">
                {(() => {
                  console.log('hourHistory para cálculo:', hourHistory);
                  if (!hourHistory || hourHistory.length === 0) {
                    console.log('Nenhum registro de horas encontrado');
                    return '0.0';
                  }
                  const total = hourHistory.reduce((total, record) => {
                    // Garantir que o valor de horas seja um número válido
                    const hours = record && record.hours ? parseFloat(record.hours) : 0;
                    console.log('Registro:', record, 'Horas:', record.hours, 'Parsed:', hours);
                    return total + hours;
                  }, 0);
                  console.log('Total calculado:', total);
                  return total.toFixed(1);
                })()}h
              </span>
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startTime">
                <FontAwesomeIcon icon="fa-solid fa-hourglass-start" style={{ marginRight: '5px' }} />
                Hora Início
              </label>
              <div className="input-with-icon">
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  value={hoursFormData.startTime}
                  onChange={handleHoursFormChange}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="endTime">
                <FontAwesomeIcon icon="fa-solid fa-hourglass-end" style={{ marginRight: '5px' }} />
                Hora Fim
              </label>
              <div className="input-with-icon">
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  value={hoursFormData.endTime}
                  onChange={handleHoursFormChange}
                  required
                />
              </div>
            </div>
          </div>
          
          <div className="form-group">
            <label>
              <FontAwesomeIcon icon="fa-solid fa-stopwatch" style={{ marginRight: '5px' }} />
              Horas Calculadas
            </label>
            <div className="calculated-hours">
              {hoursFormData.startTime && hoursFormData.endTime ? 
                calculateHours(hoursFormData.startTime, hoursFormData.endTime).toFixed(1) + ' horas' : 
                'Preencha os horários acima'}
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

      {/* Modal de detalhes da tarefa */}
      <Modal isOpen={showTaskDetails} onClose={() => setShowTaskDetails(false)} title="Detalhes da Tarefa">
        {selectedTask && (
          <div className="task-details">
            <div className="task-details-header">
              <h2>
                <FontAwesomeIcon icon="tasks" className="task-icon" />
                {selectedTask.title}
              </h2>
              <div className="task-status">
                <div className={`status-tag status-${selectedTask.status}`}>
                  <FontAwesomeIcon icon={selectedTask.status === 'pending' ? 'clock' : selectedTask.status === 'in_progress' ? 'spinner' : 'check-circle'} />
                  {getStatusLabel(selectedTask.status)}
                </div>
              </div>
            </div>
            
            <div className="task-details-grid">
              <div className="info-card">
                <div className="info-card-header">
                  <FontAwesomeIcon icon="info-circle" />
                  <span>Informações Básicas</span>
                </div>
                <div className="info-card-content">
                  <div className="info-row">
                    <div className="info-label"><FontAwesomeIcon icon="list" /> Backlog:</div>
                    <div className="info-value">{backlogs.find(b => b.id === selectedTask.backlogId)?.title || 'Não definido'}</div>
                  </div>
                  
                  <div className="info-row">
                    <div className="info-label"><FontAwesomeIcon icon="user" /> Responsável:</div>
                    <div className="info-value">{users.find(u => u.id === selectedTask.userId)?.name || 'Não atribuído'}</div>
                  </div>
                  
                  <div className="info-row">
                    <div className="info-label"><FontAwesomeIcon icon="clock" /> Estimativa:</div>
                    <div className="info-value">{selectedTask.estimatedHours} horas</div>
                  </div>
                </div>
              </div>
              
              <div className="info-card">
                <div className="info-card-header">
                  <FontAwesomeIcon icon="tag" />
                  <span>Classificação</span>
                </div>
                <div className="info-card-content">
                  <div className="info-row">
                    <div className="info-label"><FontAwesomeIcon icon="flag" /> Prioridade:</div>
                    <div className="info-value">
                      <div className={`priority-tag ${getPriorityClass(selectedTask.priority)}`}>
                        {getPriorityLabel(selectedTask.priority)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="info-row">
                    <div className="info-label"><FontAwesomeIcon icon="code-branch" /> Tipo:</div>
                    <div className="info-value">
                      <div className={`type-tag type-${selectedTask.type}`}>
                        {getTypeLabel(selectedTask.type)}
                      </div>
                    </div>
                  </div>
                
                </div>
              </div>
            </div>
            
            <div className="task-description-card">
              <div className="info-card-header">
                <FontAwesomeIcon icon="file-alt" />
                <span>Descrição</span>
              </div>
              <div className="description-content">
                {selectedTask.description ? (
                  <div className="description-text">{selectedTask.description}</div>
                ) : (
                  <div className="no-description"><FontAwesomeIcon icon="exclamation-circle" /> Sem descrição</div>
                )}
              </div>
            </div>
            

          </div>
        )}
      </Modal>

      <div className="tasks-unified">
        
        <div className="tasks-table">
          <Table 
            columns={[
              { key: 'title', header: 'Título' },
              { key: 'backlog', header: 'Backlog' },
              { key: 'assignee', header: 'Responsável' },
              { key: 'estimate', header: 'Estimativa' },
              { 
                key: 'priority', 
                header: 'Prioridade',
                render: (row) => (
                  <div className={`priority-tag ${getPriorityClass(row.priority)}`}>
                    {getPriorityLabel(row.priority)}
                  </div>
                ) 
              },
              { 
                key: 'type', 
                header: 'Tipo',
                render: (row) => (
                  <div className={`type-tag type-${row.type}`}>
                    {getTypeLabel(row.type)}
                  </div>
                ) 
              },
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
                      <span>{row.hours.toFixed(2)} horas</span>
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
    <ToastContainer position="top-right" autoClose={5000} />
    </>
  );
};

export default Tasks;