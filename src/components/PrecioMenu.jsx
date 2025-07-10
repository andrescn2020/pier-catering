import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Modal from './Modal';
import './PrecioMenu.css';

const PrecioMenu = () => {
  const [precios, setPrecios] = useState({
    precio: '',
    bonificacionEmpleadoNormal: ''
  });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    cargarPrecios();
  }, []);

  const cargarPrecios = async () => {
    try {
      const precioRef = doc(db, 'config', 'precioMenu');
      const precioSnap = await getDoc(precioRef);
      
      if (precioSnap.exists()) {
        const data = precioSnap.data();
        setPrecios({
          precio: data.precio?.toString() || '2000',
          bonificacionEmpleadoNormal: data.bonificacionEmpleadoNormal?.toString() || '1500'
        });
      } else {
        setPrecios({
          precio: '2000',
          bonificacionEmpleadoNormal: '1500'
        });
      }
    } catch (error) {
      console.error('Error al cargar los precios:', error);
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'No se pudieron cargar los precios actuales.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPrecios(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGuardarPrecios = async () => {
    try {
      const nuevosPrecios = {
        precio: parseInt(precios.precio),
        bonificacionEmpleadoNormal: parseInt(precios.bonificacionEmpleadoNormal)
      };

      // Validar que todos los precios sean números válidos y mayores a 0
      if (Object.values(nuevosPrecios).some(precio => isNaN(precio) || precio <= 0)) {
        setModal({
          isOpen: true,
          title: 'Error',
          message: 'Por favor, ingrese precios válidos mayores a 0.',
          type: 'error'
        });
        return;
      }

      const precioRef = doc(db, 'config', 'precioMenu');
      await setDoc(precioRef, nuevosPrecios);
      
      setModal({
        isOpen: true,
        title: 'Éxito',
        message: 'Precios actualizados correctamente.',
        type: 'success'
      });
    } catch (error) {
      console.error('Error al guardar los precios:', error);
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'No se pudieron guardar los precios.',
        type: 'error'
      });
    }
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <div className="precio-menu-container">
      <h2>Configuración de Precios</h2>
      <div className="precio-form">
        <div className="precio-input-group">
          <label htmlFor="precio">Costo Menu ($):</label>
          <input
            type="number"
            id="precio"
            name="precio"
            value={precios.precio}
            onChange={handleChange}
            min="0"
            step="100"
          />
        </div>
        <div className="precio-input-group">
          <label htmlFor="bonificacionEmpleadoNormal">Bonificacion Normal ($):</label>
          <input
            type="number"
            id="bonificacionEmpleadoNormal"
            name="bonificacionEmpleadoNormal"
            value={precios.bonificacionEmpleadoNormal}
            onChange={handleChange}
            min="0"
            step="100"
          />
        </div>
        <button 
          className="guardar-precio-btn"
          onClick={handleGuardarPrecios}
        >
          Guardar Precios
        </button>
      </div>
      <div className="precio-info" style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #dee2e6',
        color: '#666'
      }}>
        <p><strong>Importante:</strong> La actualización de los precios del menú debe realizarse luego del cierre semanal (viernes) para asegurar la correcta aplicación en los pedidos de la próxima semana.</p>
        <div style={{marginTop: '10px'}}>
          <p><strong>Tipos de precios:</strong></p>
          <ul style={{marginTop: '5px'}}>
            <li><strong>Costo Menu:</strong> Para usuarios sin bonificación</li>
            <li><strong>Bonificacion Normal:</strong> Para empleados con bonificación normal</li>
          </ul>
        </div>
      </div>

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ isOpen: false, title: '', message: '', type: 'info' })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
};

export default PrecioMenu; 