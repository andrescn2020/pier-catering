import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import Modal from './Modal';
import Spinner from './Spinner';
import './EditarUsuario.css';

const EditarUsuario = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const user = auth.currentUser;
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    // Validaciones
    if (!currentPassword || !newPassword || !confirmPassword) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Por favor, completa todos los campos.',
        type: 'error',
        canClose: true
      });
      return;
    }

    if (newPassword.length < 6) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'La nueva contraseña debe tener al menos 6 caracteres.',
        type: 'error',
        canClose: true
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Las contraseñas nuevas no coinciden.',
        type: 'error',
        canClose: true
      });
      return;
    }

    if (currentPassword === newPassword) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'La nueva contraseña debe ser diferente a la actual.',
        type: 'error',
        canClose: true
      });
      return;
    }

    setLoading(true);

    try {
      // Reautenticar al usuario con la contraseña actual
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Actualizar la contraseña
      await updatePassword(user, newPassword);

      setModal({
        isOpen: true,
        title: 'Éxito',
        message: 'Tu contraseña ha sido actualizada exitosamente.',
        type: 'success',
        canClose: true
      });

      // Limpiar formulario
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      
      let errorMessage = 'Error al cambiar la contraseña. ';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage += 'La contraseña actual es incorrecta.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage += 'La nueva contraseña es muy débil.';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage += 'Por seguridad, necesitas iniciar sesión nuevamente.';
      } else {
        errorMessage += error.message;
      }

      setModal({
        isOpen: true,
        title: 'Error',
        message: errorMessage,
        type: 'error',
        canClose: true
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVolver = () => {
    navigate('/menu');
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="editar-usuario-container">
      <div className="editar-usuario-card">
        <h1>Editar Usuario</h1>
        
        <form onSubmit={handleChangePassword} className="password-form">
          <div className="form-group">
            <label htmlFor="currentPassword">Contraseña Actual</label>
            <div className="password-input-wrapper">
              <input
                type={showCurrentPassword ? "text" : "password"}
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Ingresa tu contraseña actual"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">Nueva Contraseña</label>
            <div className="password-input-wrapper">
              <input
                type={showNewPassword ? "text" : "password"}
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ingresa tu nueva contraseña (mín. 6 caracteres)"
                required
                minLength={6}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar Nueva Contraseña</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirma tu nueva contraseña"
                required
                minLength={6}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Cambiar Contraseña
            </button>
            <button type="button" className="btn-secondary" onClick={handleVolver}>
              Volver
            </button>
          </div>
        </form>
      </div>

      <Modal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        canClose={modal.canClose}
        onClose={() => {
          if (modal.canClose) {
            setModal({ isOpen: false, title: '', message: '', type: 'info', canClose: true });
          }
        }}
      />
    </div>
  );
};

export default EditarUsuario;

