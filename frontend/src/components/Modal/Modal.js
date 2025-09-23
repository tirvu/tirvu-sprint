import React from 'react';
import './Modal.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    // Fechar o modal apenas se o clique for no overlay e não no conteúdo
    if (e.target.className === 'modal-overlay') {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <FontAwesomeIcon icon="times" />
          </button>
        </div>
        <div className="modal-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;