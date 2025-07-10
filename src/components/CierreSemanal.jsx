import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, setDoc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import Modal from './Modal';
import './CierreSemanal.css';

const CierreSemanal = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [puedeCerrar, setPuedeCerrar] = useState(false);

  useEffect(() => {
    verificarHorarioCierre();
  }, []);

  const verificarHorarioCierre = () => {
    const hoy = new Date();
    const hora = hoy.getHours();
    
    // Permitir cierre cualquier día después de las 14:00
    const puedeCerrarAhora = hora >= 14;
    setPuedeCerrar(puedeCerrarAhora);
    return puedeCerrarAhora;
  };

  const cerrarSemanaYGuardarHistorial = async () => {
    if (!verificarHorarioCierre()) {
      setStatus('El cierre semanal solo está disponible después de las 14:00 horas.');
      return;
    }

    setIsLoading(true);
    setStatus('Iniciando proceso de cierre semanal...');
    setModal({ isOpen: false, title: '', message: '', type: 'info' });

    try {
      const db = getFirestore();
      
      // 1. Obtener el menú actual
      const menuActualRef = doc(db, 'menus', 'menuActual');
      const menuActualSnap = await getDoc(menuActualRef);
      const existeMenuActual = menuActualSnap.exists();
      
      // 2. Obtener el menú de la próxima semana
      const menuProximaRef = doc(db, 'menus', 'menuProxima');
      const menuProximaSnap = await getDoc(menuProximaRef);

      if (!menuProximaSnap.exists()) {
        setStatus('No hay menú de próxima semana disponible.');
        setIsLoading(false);
        return;
      }

      // 3. Si existe menú actual, guardar pedidos en historial y eliminarlos
      if (existeMenuActual) {
        const pedidosRef = collection(db, "pedidos");
        const q = query(pedidosRef, where("tipo", "==", "actual"));
        const querySnapshot = await getDocs(q);

        // Guardar pedidos en historial
        const historialRef = collection(db, "historial_pedidos");
        for (const docSnapshot of querySnapshot.docs) {
          const pedidoData = docSnapshot.data();
          await addDoc(historialRef, {
            ...pedidoData,
            fechaPedido: new Date(),
            corteSemana: true
          });
        }

        // Eliminar los pedidos actuales
        for (const docSnapshot of querySnapshot.docs) {
          await deleteDoc(docSnapshot.ref);
        }
      }

      // 4. Mover el menú de próxima semana a actual
      const menuProximaData = menuProximaSnap.data();
      await setDoc(menuActualRef, menuProximaData);

      // 5. Cambiar tipo de pedidos de próxima semana a actual
      const pedidosProximaRef = collection(db, "pedidos");
      const qProxima = query(pedidosProximaRef, where("tipo", "==", "proxima"));
      const pedidosProximaSnap = await getDocs(qProxima);

      for (const docSnapshot of pedidosProximaSnap.docs) {
        await setDoc(docSnapshot.ref, {
          ...docSnapshot.data(),
          tipo: "actual"
        });
      }

      // 6. Eliminar el menú de próxima semana
      await deleteDoc(menuProximaRef);

      // 7. Actualizar la fecha de última rotación
      const configRef = doc(db, 'config', 'ultimaRotacion');
      await setDoc(configRef, {
        fecha: Timestamp.fromDate(new Date())
      });

      setStatus(existeMenuActual 
        ? 'Cierre semanal completado exitosamente. Los pedidos han sido guardados en el historial.'
        : 'Cierre semanal completado exitosamente. Primera semana configurada.');
    } catch (error) {
      console.error('Error en el cierre semanal:', error);
      setStatus('Error al realizar el cierre semanal: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmarCerrarSemana = () => {
    if (!puedeCerrar) {
      setModal({
        isOpen: true,
        title: 'No se puede cerrar la semana',
        message: 'El cierre semanal solo está disponible después de las 14:00 horas.',
        type: 'warning',
        actions: [
          {
            label: 'Entendido',
            type: 'secondary',
            onClick: () => setModal({ isOpen: false, title: '', message: '', type: 'info' })
          }
        ]
      });
      return;
    }

    setModal({
      isOpen: true,
      title: 'Cerrar semana y guardar historial',
      message: '¿Está seguro que desea cerrar la semana? Todos los pedidos actuales se guardarán en el historial y se eliminarán de la lista principal. Esta acción no se puede deshacer.',
      type: 'warning',
      actions: [
        {
          label: 'Cancelar',
          type: 'secondary',
          onClick: () => setModal({ isOpen: false, title: '', message: '', type: 'info' })
        },
        {
          label: 'Cerrar semana',
          type: 'danger',
          onClick: cerrarSemanaYGuardarHistorial
        }
      ]
    });
  };

  return (
    <div className="cierre-semanal-container">
      <button 
        className="cerrar-semana-btn"
        onClick={handleConfirmarCerrarSemana}
        disabled={isLoading || !puedeCerrar}
        title={!puedeCerrar ? "El cierre semanal solo está disponible después de las 14:00 horas" : ""}
      >
        {isLoading ? 'Procesando...' : 'Cerrar semana y guardar historial'}
      </button>
      
      {status && <div className="status-message">{status}</div>}

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ isOpen: false, title: '', message: '', type: 'info' })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        actions={modal.actions}
      />
    </div>
  );
};

export default CierreSemanal; 