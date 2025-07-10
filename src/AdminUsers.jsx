import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query, where } from "firebase/firestore";
import { db, secondaryAuth } from "./firebase";
import { getAuth, createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword } from "firebase/auth";
import Modal from './components/Modal';
import Spinner from './components/Spinner';
import "./AdminUsers.css";

// Flag global para pausar listeners durante creación de usuarios
window.isCreatingUser = false;

const AdminUsers = ({ mode = "view" }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    usuario: '',
    bonificacion: false
  });
  const [error, setError] = useState('');
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const auth = getAuth();
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, "users");
      const userSnapshot = await getDocs(usersRef);
      const userList = userSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      // Filtrar para mostrar solo usuarios no administradores
      .filter(user => user.rol !== 'admin');
      setUsers(userList);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
      setMessage("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createUserWithSecondaryAuth(formData);
  };

  const createUserWithSecondaryAuth = async (dataToUse) => {
    setIsCreatingUser(true);
    setMessage("");
    setError("");

    try {
      // Activar flag para pausar listeners
      window.isCreatingUser = true;
      
      // Validar que los campos únicos no existan
      await validateUniqueFields(dataToUse);

      // Crear usuario con la instancia secundaria de Auth
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        dataToUse.email,
        dataToUse.password
      );

      // Crear documento en Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: dataToUse.email,
        nombre: dataToUse.nombre,
        apellido: dataToUse.apellido,
        rol: 'usuario', // Siempre crear como usuario
        usuario: dataToUse.usuario || dataToUse.email.split('@')[0],
        beneficio: "estandar",
        bonificacion: dataToUse.bonificacion,
        fechaCreacion: serverTimestamp()
      });

      // Cerrar la sesión del usuario recién creado en la instancia secundaria
      await secondaryAuth.signOut();

      // Usuario creado exitosamente
      setModal({
        isOpen: true,
        title: 'Éxito',
        message: 'Usuario creado exitosamente',
        type: 'success'
      });
      
      setFormData({
        email: '',
        password: '',
        nombre: '',
        apellido: '',
        usuario: '',
        bonificacion: false
      });
      setShowCreateForm(false);
      setShowCreatePassword(false); // Reset password visibility
      fetchUsers(); // Actualizar la lista de usuarios

      // Desactivar flag después de un breve delay
      setTimeout(() => {
        window.isCreatingUser = false;
      }, 500);

    } catch (error) {
      console.error('Error al crear usuario:', error);
      window.isCreatingUser = false;
      
      setModal({
        isOpen: true,
        title: 'Error',
        message: error.message,
        type: 'error'
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Removemos las funciones del modal de contraseña ya que no las necesitamos
  
  const validateUniqueFields = async (formData) => {
    const usersRef = collection(db, "users");
    
    // Validar email único
    const emailQuery = query(usersRef, where("email", "==", formData.email));
    const emailSnapshot = await getDocs(emailQuery);
    if (!emailSnapshot.empty) {
      throw new Error("El email ya existe. Por favor, usa un email diferente.");
    }
    
    // Validar usuario único (si se proporciona)
    const usuario = formData.usuario || formData.email.split('@')[0];
    const usuarioQuery = query(usersRef, where("usuario", "==", usuario));
    const usuarioSnapshot = await getDocs(usuarioQuery);
    if (!usuarioSnapshot.empty) {
      throw new Error("El nombre de usuario ya existe. Por favor, usa un usuario diferente.");
    }
  };

  const handleDeleteUser = async (userId, userEmail, userRol) => {
    // No permitir eliminar administradores
    if (userRol === 'admin') {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'No se pueden eliminar usuarios administradores',
        type: 'error'
      });
      return;
    }

    setModal({
      isOpen: true,
      title: 'Confirmar eliminación',
      message: `¿Estás seguro de que deseas eliminar al usuario ${userEmail}?\n\nNota: Esto eliminará al usuario de la base de datos. El usuario seguirá existiendo en Firebase Auth pero no podrá acceder al sistema.`,
      type: 'warning',
      actions: [
        {
          label: 'Cancelar',
          type: 'secondary',
          onClick: () => setModal({ isOpen: false, title: '', message: '', type: 'info' })
        },
        {
          label: 'Eliminar',
          type: 'danger',
          onClick: () => confirmarEliminacion(userId)
        }
      ]
    });
  };

  const confirmarEliminacion = async (userId) => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
    setIsDeletingUser(true);
    
    try {
      // Eliminar documento de Firestore
      await deleteDoc(doc(db, "users", userId));
      
      setModal({
        isOpen: true,
        title: 'Éxito',
        message: 'Usuario eliminado exitosamente.',
        type: 'success'
      });
      
      fetchUsers(); // Actualizar la lista de usuarios
      
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al eliminar usuario: ' + error.message,
        type: 'error'
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleEditUser = async (userId, currentBonificacion) => {
    setIsEditingUser(true);
    setEditingUserId(userId);
    try {
      await setDoc(doc(db, "users", userId), {
        bonificacion: !currentBonificacion
      }, { merge: true });

      setModal({
        isOpen: true,
        title: 'Éxito',
        message: 'Estado de bonificación actualizado exitosamente',
        type: 'success'
      });

      fetchUsers(); // Actualizar la lista de usuarios
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al actualizar el estado de bonificación: ' + error.message,
        type: 'error'
      });
    } finally {
      setIsEditingUser(false);
      setEditingUserId(null);
    }
  };

  const renderUsersList = () => (
    <div className="users-list">
      <div className="users-header">
        <h3>Lista de Usuarios</h3>
        <button 
          className="create-user-button"
          onClick={() => setShowCreateForm(true)}
        >
          Crear Nuevo Usuario
        </button>
      </div>
      
      {loading ? (
        <Spinner />
      ) : (
        <div className="users-grid">
          {users.map(user => (
            <div key={user.id} className="user-card">
              <div className="user-info">
                {/*<p><strong>ID:</strong> {user.id}</p>*/}
                <p><strong>Usuario:</strong> {user.usuario || "No definido"}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Nombre:</strong> {user.nombre || "Sin nombre"}</p>
                <p><strong>Apellido:</strong> {user.apellido || "Sin apellido"}</p>
                <p><strong>Rol:</strong> {user.rol || "usuario"}</p>
                <p><strong>Bonificación:</strong> {user.bonificacion ? "Sí" : "No"}</p>
                {/*<p><strong>Beneficio:</strong> {user.beneficio || "estandar"}</p>*/}
              </div>
              <div className="user-actions">
                <button 
                  className="edit-user-button"
                  onClick={() => handleEditUser(user.id, user.bonificacion)}
                  disabled={isEditingUser || user.rol === 'admin'}
                >
                  {isEditingUser && editingUserId === user.id ? 'Actualizando...' : 'Cambiar Bonificación'}
                </button>
                <button 
                  className="delete-user-button"
                  onClick={() => handleDeleteUser(user.id, user.email, user.rol)}
                  disabled={isDeletingUser || user.rol === 'admin'}
                >
                  {isDeletingUser ? 'Eliminando...' : 'Eliminar Usuario'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCreateUserForm = () => (
    <div className="create-user-form">
      <div className="form-header">
        <h3>Crear Nuevo Usuario</h3>
        <button 
          className="close-form-button"
          onClick={() => {
            setShowCreateForm(false);
            setShowCreatePassword(false); // Reset password visibility
          }}
        >
          ×
        </button>
      </div>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email *</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={isCreatingUser}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Contraseña *</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={showCreatePassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={isCreatingUser}
              style={{
                paddingRight: '50px' // Solo espacio para el botón
              }}
            />
            <button
              type="button"
              onClick={() => setShowCreatePassword(!showCreatePassword)}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#666',
                padding: '5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={showCreatePassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              disabled={isCreatingUser}
            >
              {showCreatePassword ? '🔒' : '👁️'}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="usuario">Usuario</label>
          <input
            type="text"
            id="usuario"
            name="usuario"
            value={formData.usuario}
            onChange={handleChange}
            placeholder="Si se deja vacío, se generará del email"
            disabled={isCreatingUser}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="nombre">Nombre</label>
          <input
            type="text"
            id="nombre"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            disabled={isCreatingUser}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="apellido">Apellido</label>
          <input
            type="text"
            id="apellido"
            name="apellido"
            value={formData.apellido}
            onChange={handleChange}
            disabled={isCreatingUser}
          />
        </div>
        
        <div className="form-group checkbox-group">
          <label htmlFor="bonificacion">
            <input
              type="checkbox"
              id="bonificacion"
              name="bonificacion"
              checked={formData.bonificacion}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                bonificacion: e.target.checked
              }))}
              disabled={isCreatingUser}
            />
            Usuario Bonificado
          </label>
        </div>
        
        <button type="submit" className="submit-button" disabled={isCreatingUser}>
          {isCreatingUser ? (
            <>
              <span>Creando usuario...</span>
              <div className="button-spinner" />
            </>
          ) : (
            <span>Crear Usuario</span>
          )}
        </button>
      </form>
    </div>
  );

  return (
    <div className="admin-container">
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ isOpen: false, title: '', message: '', type: 'info' })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        actions={modal.actions}
      />
      
      {showCreateForm ? renderCreateUserForm() : renderUsersList()}
    </div>
  );
};

export default AdminUsers; 