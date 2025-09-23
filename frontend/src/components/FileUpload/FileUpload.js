import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import axios from 'axios';
import { API_ENDPOINTS, API_URL } from '../../helpers/Constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// Import ToastContainer and use window.toast for notifications
import { ToastContainer } from '../../components/Toast/Toast';
import { useAuth } from '../../contexts/AuthContext';
import './FileUpload.css';

const FileUpload = forwardRef(({ taskId, disabled = false }, ref) => {
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const { user } = useAuth();

  // Método para iniciar o upload dos arquivos selecionados
  const uploadFiles = async () => {
    if (selectedFiles.length > 0) {
      // Verificar se temos um _taskId definido pelo componente pai
      if (ref.current && ref.current._taskId) {
        console.log('Usando _taskId definido pelo componente pai:', ref.current._taskId);
      }
      
      await handleUpload();
      return true;
    }
    return false;
  };

  // Expor a função handleUpload para o componente pai
  useImperativeHandle(ref, () => ({
    uploadFiles: handleUpload,
    _taskId: null, // Propriedade para armazenar o taskId definido pelo componente pai
    get taskId() { return this._taskId || taskId; },
    set taskId(value) { this._taskId = value; }
  }));

  // Buscar anexos existentes
  useEffect(() => {
    if (taskId) {
      console.log('TaskId atualizado:', taskId);
      fetchAttachments();
    }
  }, [taskId]);

  const fetchAttachments = async () => {
    // Verificar se temos um ID de tarefa válido
    if (!taskId) {
      console.log('Não foi possível buscar anexos: taskId não definido');
      return;
    }
    
    try {
      console.log('Buscando anexos para a tarefa ID:', taskId);
      // Usar a URL completa para evitar problemas com caminhos relativos
      const response = await axios.get(`${API_URL}/api/task-attachments/task/${taskId}`);
      setFiles(response.data);

      // Pré-carregar thumbnails de imagens
      response.data.forEach(attachment => {
        if (attachment.fileType.startsWith('image/')) {
          const img = new Image();
          img.src = `${API_URL}/api/task-attachments/file/${attachment.id}?cache=${Date.now()}`;
        }
      });
    } catch (error) {
      console.error('Erro ao buscar anexos:', error);
    }
  };

  const handleFileChange = (e) => {
    if (disabled) return;
    
    const newFiles = Array.from(e.target.files);
    if (newFiles.length > 0) {
      // Verificar se não excede o limite de 5 arquivos
      if (selectedFiles.length + newFiles.length > 5) {
        window.toast.error('Você pode selecionar no máximo 5 arquivos por vez');
        return;
      }
      
      // Verificar tamanho dos arquivos
      const oversizedFiles = newFiles.filter(file => file.size > 10 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        window.toast.error(`Alguns arquivos excedem o limite de 10MB: ${oversizedFiles.map(f => f.name).join(', ')}`);
        return;
      }
      
      setSelectedFiles([...selectedFiles, ...newFiles]);
    }
  };

  const removeSelectedFile = (index) => {
    if (disabled) return;
    
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  const handleUpload = async () => {
    if (disabled || selectedFiles.length === 0) return true;
    
    // Obter o ID da tarefa mais recente (pode ter sido atualizado pelo componente pai)
    // Usar a propriedade getter taskId que retorna o valor mais atualizado
    const currentTaskId = ref.current ? ref.current.taskId : taskId;
    
    // Verificar se temos um ID de tarefa válido
    if (!currentTaskId) {
      console.error('Erro: Não foi possível enviar anexos - ID da tarefa não disponível');
      window.toast.error('Não foi possível enviar anexos - ID da tarefa não disponível');
      return false;
    }
    
    console.log('Enviando anexos para a tarefa ID:', currentTaskId);
    
    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('attachments', file);
      
      // Verificar se é imagem para compressão
      const fileType = file.type.toLowerCase();
      const isImage = fileType.includes('image');
      if (isImage) {
        formData.append('compress', 'true');
      }
    });
    
    // Usar window.toast.loading se disponível, caso contrário usar info
    if (typeof window.toast.loading === 'function') {
      window.toast.loading('Enviando anexos...', { id: 'attachmentsProgress' });
    } else {
      window.toast.info('Enviando anexos...', { id: 'attachmentsProgress' });
    }
    
    try {
      // Usar a URL completa para evitar problemas com caminhos relativos
      await axios.post(`${API_URL}/api/task-attachments/${currentTaskId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000, // 30 segundos
      });
      
      window.toast.dismiss('attachmentsProgress');
      window.toast.success('Anexos enviados com sucesso!');
      
      // Limpar arquivos selecionados e atualizar lista
      setSelectedFiles([]);
      fetchAttachments();
    } catch (error) {
      window.toast.dismiss('attachmentsProgress');
      console.error('Erro ao enviar anexos:', error);
      
      let errorMessage = 'Erro ao enviar anexos';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Tempo limite excedido ao enviar anexos.';
      } else if (error.response?.data?.message) {
        errorMessage = `Erro nos anexos: ${error.response.data.message}`;
      } else if (error.message) {
        errorMessage = `Erro nos anexos: ${error.message}`;
      }
      
      window.toast.error(errorMessage);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (disabled) return;
    
    if (window.confirm('Tem certeza que deseja excluir este anexo?')) {
      try {
        // Usar window.toast.loading se disponível, caso contrário usar info
        if (typeof window.toast.loading === 'function') {
          window.toast.loading('Excluindo anexo...', { id: 'deleteAttachment' });
        } else {
          window.toast.info('Excluindo anexo...', { id: 'deleteAttachment' });
        }
        // Usar a URL completa para evitar problemas com caminhos relativos
        await axios.delete(`${API_URL}/api/task-attachments/${attachmentId}`);
        window.toast.dismiss('deleteAttachment');
        window.toast.success('Anexo excluído com sucesso!');
        fetchAttachments();
      } catch (error) {
        window.toast.dismiss('deleteAttachment');
        console.error('Erro ao excluir anexo:', error);
        window.toast.error('Erro ao excluir anexo');
      }
    }
  };

  const handlePreviewAttachment = (attachment) => {
    console.log('Abrindo visualizador para:', attachment);
    setPreviewAttachment(attachment);
    if (typeof window.toast.loading === 'function') {
      window.toast.loading('Carregando visualização...', { id: 'loadingPreview', autoClose: false });
    } else {
      window.toast.info('Carregando visualização...', { id: 'loadingPreview', autoClose: false });
    }
  };

  const closePreview = () => {
    setPreviewAttachment(null);
    window.toast.dismiss('loadingPreview');
    console.log('Visualizador fechado manualmente');
  };

  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return ['far', 'file-image'];
    if (fileType === 'application/pdf') return ['far', 'file-pdf'];
    if (fileType.includes('word') || fileType.includes('document')) return ['far', 'file-word'];
    if (fileType.includes('excel') || fileType.includes('sheet')) return ['far', 'file-excel'];
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return ['far', 'file-powerpoint'];
    if (fileType.includes('zip') || fileType.includes('compressed')) return ['far', 'file-archive'];
    return ['far', 'file'];
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="task-file-upload-container">
      {!disabled && (
        <div className="task-file-upload-header">
          <label htmlFor="task-attachments" className="task-file-upload-label">
            <FontAwesomeIcon icon="paperclip" style={{ marginRight: '5px' }} />
            Selecionar arquivos
          </label>
          <input
            type="file"
            id="task-attachments"
            name="task-attachments"
            multiple
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            className="task-file-input"
          />
          <div className="task-file-upload-info">
            <small>Máximo 5 arquivos (10MB cada). Formatos: imagens, PDF, Word, Excel</small>
          </div>
        </div>
      )}
      
      {selectedFiles.length > 0 && (
        <div className="task-selected-files">
          <div className="task-selected-files-header">
            <h4>Arquivos selecionados:</h4>
          </div>
          <ul>
            {selectedFiles.map((file, index) => (
              <li key={index}>
                <span className="task-file-name">
                  <FontAwesomeIcon 
                    icon={getFileIcon(file.type)} 
                    style={{ marginRight: '8px' }} 
                  />
                  {file.name}
                </span>
                <span className="task-file-size">{formatFileSize(file.size)}</span>
                <button 
                  type="button" 
                  className="task-remove-file" 
                  onClick={() => removeSelectedFile(index)}
                  disabled={disabled}
                >
                  <FontAwesomeIcon icon="times" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {files.length > 0 && (
        <div className="task-attachments-container">
          <h4>Anexos da tarefa:</h4>
          <div className="task-attachments-list">
            {files.map((attachment) => (
              <div key={attachment.id} className="task-attachment-item">
                <div className="task-attachment-info">
                  <span className="task-attachment-name">
                    <FontAwesomeIcon 
                      icon={getFileIcon(attachment.fileType)} 
                      style={{ marginRight: '8px' }} 
                    />
                    {attachment.originalFilename}
                  </span>
                  <span className="task-attachment-size">
                    {formatFileSize(attachment.fileSize)}
                  </span>
                </div>
                <div className="task-attachment-actions">
                  <div 
                    className="task-btn-action task-btn-view" 
                    onClick={() => handlePreviewAttachment(attachment)}
                    title="Visualizar Anexo"
                  >
                    <FontAwesomeIcon icon="eye" />
                  </div>
                  {(user.role === 'admin' || user.id === attachment.userId) && !disabled && (
                    <div 
                      className="task-btn-action task-btn-delete" 
                      onClick={() => handleDeleteAttachment(attachment.id)}
                      title="Excluir Anexo"
                    >
                      <FontAwesomeIcon icon="trash" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {previewAttachment && (
        <div className="task-attachment-preview-modal">
          <div className="task-attachment-preview-container">
            {previewAttachment.fileType.startsWith('image/') ? (
              <>
                <img 
                  src={`${API_URL}/api/task-attachments/file/${previewAttachment.id}?cache=${Date.now()}`} 
                  alt={previewAttachment.originalFilename}
                  loading="eager"
                  onLoad={() => {
                    window.toast.dismiss('loadingPreview');
                  }}
                  onError={() => {
                    window.toast.dismiss('loadingPreview');
                    window.toast.error('Erro ao carregar imagem');
                  }}
                />
                {previewAttachment.isCompressed && (
                  <div className="task-compressed-badge">
                    <FontAwesomeIcon icon="compress" /> Comprimido
                  </div>
                )}
              </>
            ) : previewAttachment.fileType === 'application/pdf' ? (
              <>
                <iframe 
                  src={`${API_URL}/api/task-attachments/file/${previewAttachment.id}?cache=${Date.now()}`} 
                  title={previewAttachment.originalFilename}
                  onLoad={() => {
                    window.toast.dismiss('loadingPreview');
                  }}
                ></iframe>
                {previewAttachment.isCompressed && (
                  <div className="task-compressed-badge">
                    <FontAwesomeIcon icon="compress" /> Comprimido
                  </div>
                )}
              </>
            ) : (
              <div className="task-download-prompt">
                <p>Este tipo de arquivo não pode ser visualizado diretamente.</p>
                <a 
                  href={`${API_URL}/api/task-attachments/file/${previewAttachment.id}?download=true&cache=${Date.now()}`} 
                  download={previewAttachment.originalFilename}
                  className="task-download-button"
                  onClick={() => {
                    window.toast.dismiss('loadingPreview');
                  }}
                >
                  <FontAwesomeIcon icon="download" /> Baixar Arquivo
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default FileUpload;