import React, { useState, useEffect } from 'react';
import './Toast.css';

const Toast = ({ message, type, onClose, options = {} }) => {
  const [visible, setVisible] = useState(true);
  const { autoClose = 5000 } = options;

  useEffect(() => {
    // Se autoClose for false, não configuramos o timer
    if (autoClose === false) return;
    
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        onClose();
      }, 300); // Tempo para a animação de saída
    }, autoClose); // Tempo configurável para exibição

    return () => clearTimeout(timer);
  }, [onClose, autoClose]);

  return (
    <div className={`toast toast-${type} ${visible ? 'visible' : 'hidden'}`}>
      <div className="toast-content">
        <span>{message}</span>
      </div>
      <button className="toast-close" onClick={() => setVisible(false)}>×</button>
    </div>
  );
};

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  // Função para adicionar um novo toast
  const addToast = (message, type = 'info', options = {}) => {
    // Se toastId for fornecido, verificamos se já existe um toast com esse ID
    if (options.toastId) {
      const existingToastIndex = toasts.findIndex(t => t.id === options.toastId);
      if (existingToastIndex !== -1) {
        // Atualiza o toast existente
        const updatedToasts = [...toasts];
        updatedToasts[existingToastIndex] = {
          ...updatedToasts[existingToastIndex],
          message,
          type,
          options
        };
        setToasts(updatedToasts);
        return options.toastId;
      }
    }

    // Cria um novo ID ou usa o fornecido
    const id = options.toastId || Math.random().toString(36).substr(2, 9);
    setToasts((prevToasts) => [...prevToasts, { id, message, type, options }]);
    return id;
  };

  // Função para remover um toast
  const removeToast = (id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  };

  // Função para remover um toast específico pelo ID
  const dismiss = (id) => {
    if (id) {
      removeToast(id);
    } else {
      // Se nenhum ID for fornecido, remove todos os toasts
      setToasts([]);
    }
  };

  // Funções de conveniência para diferentes tipos de toast
  const success = (message, options) => addToast(message, 'success', options);
  const error = (message, options) => addToast(message, 'error', options);
  const info = (message, options) => addToast(message, 'info', options);
  const warning = (message, options) => addToast(message, 'warning', options);

  // Expor as funções para uso global
  React.useEffect(() => {
    window.toast = {
      success,
      error,
      info,
      warning,
      dismiss
    };

    return () => {
      delete window.toast;
    };
  }, []);

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          options={toast.options}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export { ToastContainer };
export default Toast;