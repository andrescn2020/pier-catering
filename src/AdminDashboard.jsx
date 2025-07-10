import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import AdminUsers from './AdminUsers';
import MenuForm from './MenuForm';
import SubirMenu from './SubirMenu';
import AdminMenu from './components/AdminMenu';
import MenuStructureManager from './components/MenuStructureManager';
import VerPedidos from './components/VerPedidos';
import HistorialPedidos from './components/HistorialPedidos';
import PrecioMenu from './components/PrecioMenu';
import CierreSemanal from './components/CierreSemanal';
import Modal from './components/Modal';
import { getFirestore, collection, query, where, getDocs, setDoc, doc, deleteDoc, getDoc, addDoc, Timestamp } from 'firebase/firestore';
import ConfiguracionOpciones from './components/ConfiguracionOpciones';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const navigate = useNavigate();
  const backButtonRef = useRef(null);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [fechaLimite, setFechaLimite] = useState(null);
  const [fechaLimiteInput, setFechaLimiteInput] = useState('');
  const [modalFechaLimite, setModalFechaLimite] = useState(false);
  const [modalFechaInicio, setModalFechaInicio] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(null);
  const [fechaInicioInput, setFechaInicioInput] = useState('');
  const [fechaLimiteMaxima, setFechaLimiteMaxima] = useState('');

  // Efecto para manejar el scroll cuando cambia la sección
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeSection]);

  useEffect(() => {
    cargarFechaLimite();
  }, []);

  const cargarFechaLimite = async () => {
    try {
      const db = getFirestore();
      const ref = doc(db, 'config', 'fechasLimite');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        
        // Convertir a fecha con zona horaria de Argentina
        const fechaLimiteData = data.proximaSemana?.toDate ? data.proximaSemana.toDate() : new Date(data.proximaSemana);
        const fechaInicioData = data.inicioPedidos?.toDate ? data.inicioPedidos.toDate() : new Date(data.inicioPedidos);
        
        // Formatear para input datetime-local (YYYY-MM-DDThh:mm)
        const formatearParaInput = (fecha) => {
          return fecha.toLocaleString('sv', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 16);
        };
        
        setFechaLimite(fechaLimiteData);
        setFechaLimiteInput(formatearParaInput(fechaLimiteData));
        
        setFechaInicio(fechaInicioData);
        setFechaInicioInput(formatearParaInput(fechaInicioData));

        // Calcular fecha límite máxima (viernes de la misma semana)
        if (fechaInicioData) {
          const fechaInicioObj = new Date(fechaInicioData);
          const diaSemana = fechaInicioObj.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
          const diasHastaViernes = 5 - diaSemana; // días hasta el viernes
          const fechaLimiteMax = new Date(fechaInicioObj);
          fechaLimiteMax.setDate(fechaInicioObj.getDate() + diasHastaViernes);
          fechaLimiteMax.setHours(23, 59, 0, 0);
          setFechaLimiteMaxima(formatearParaInput(fechaLimiteMax));
        }
      }
    } catch (e) { 
      console.error('Error al cargar fechas:', e);
      setFechaLimite(null);
      setFechaInicio(null);
    }
  };

  const handleFechaInicioChange = (e) => {
    const nuevaFechaInicio = e.target.value;
    setFechaInicioInput(nuevaFechaInicio);
    
    // Calcular fecha límite máxima cuando cambia la fecha de inicio
    if (nuevaFechaInicio) {
      const fechaInicioObj = new Date(nuevaFechaInicio);
      const diaSemana = fechaInicioObj.getDay();
      const diasHastaViernes = 5 - diaSemana;
      const fechaLimiteMax = new Date(fechaInicioObj);
      fechaLimiteMax.setDate(fechaInicioObj.getDate() + diasHastaViernes);
      fechaLimiteMax.setHours(23, 59, 0, 0);
      setFechaLimiteMaxima(fechaLimiteMax.toLocaleString('sv', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 16));
    }
  };

  const guardarFechaLimite = async () => {
    try {
      const db = getFirestore();
      const ref = doc(db, 'config', 'fechasLimite');
      const nuevaFecha = new Date(fechaLimiteInput);
      await setDoc(ref, { proximaSemana: Timestamp.fromDate(nuevaFecha) });
      setFechaLimite(nuevaFecha);
      setFechaLimiteInput(nuevaFecha.toISOString().slice(0,16));
      setModal({ isOpen: true, title: 'Éxito', message: 'Fecha límite actualizada.', type: 'success' });
    } catch (e) {
      setModal({ isOpen: true, title: 'Error', message: 'No se pudo guardar la fecha límite.', type: 'error' });
    }
  };

  const guardarFechas = async () => {
    try {
      const db = getFirestore();
      const ref = doc(db, 'config', 'fechasLimite');
      
      // Crear fechas con zona horaria de Argentina
      const nuevaFechaInicio = new Date(fechaInicioInput + ':00-03:00');
      const nuevaFechaLimite = new Date(fechaLimiteInput + ':00-03:00');
      
      await setDoc(ref, {
        inicioPedidos: Timestamp.fromDate(nuevaFechaInicio),
        proximaSemana: Timestamp.fromDate(nuevaFechaLimite)
      });
      
      setFechaInicio(nuevaFechaInicio);
      setFechaLimite(nuevaFechaLimite);
      setModal({ isOpen: true, title: 'Éxito', message: 'Fechas actualizadas correctamente.', type: 'success' });
    } catch (e) {
      console.error('Error al guardar fechas:', e);
      setModal({ isOpen: true, title: 'Error', message: 'No se pudieron guardar las fechas.', type: 'error' });
    }
  };

  const eliminarFechas = async () => {
    try {
      const db = getFirestore();
      const ref = doc(db, 'config', 'fechasLimite');
      
      await setDoc(ref, {
        inicioPedidos: null,
        proximaSemana: null
      });
      
      setFechaInicio(null);
      setFechaLimite(null);
      setFechaInicioInput('');
      setFechaLimiteInput('');
      setModal({ isOpen: true, title: 'Éxito', message: 'Fechas eliminadas correctamente.', type: 'success' });
    } catch (e) {
      console.error('Error al eliminar fechas:', e);
      setModal({ isOpen: true, title: 'Error', message: 'No se pudieron eliminar las fechas.', type: 'error' });
    }
  };

  const handleEditarMenu = () => {
    setActiveSection('subirMenu');
    setTimeout(() => {
      backButtonRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  /* const handleSubirMenu = () => {
    setActiveSection('menu');
  }; */

  const handleVerMenu = () => {
    setActiveSection('verMenu');
    setTimeout(() => {
      backButtonRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleVerMenuProxima = () => {
    setActiveSection('verMenuProxima');
    setTimeout(() => {
      backButtonRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleVerUsuarios = () => {
    setActiveSection('usuarios');
    setTimeout(() => {
      backButtonRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleVerPedidos = () => {
    setActiveSection('pedidosProxima');
    setTimeout(() => {
      backButtonRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleVerPedidosActual = () => {
    setActiveSection('pedidosActual');
    setTimeout(() => {
      backButtonRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleVerPedidosTardios = () => {
    setActiveSection('pedidosTardios');
    setTimeout(() => {
      backButtonRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleVerHistorial = () => {
    setActiveSection('historial');
    setTimeout(() => {
      backButtonRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleGestionarEstructura = () => {
    setActiveSection('estructuraMenu');
    setTimeout(() => {
      backButtonRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleConfiguracionOpciones = () => {
    setActiveSection('configuracionOpciones');
    setTimeout(() => {
      backButtonRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleCerrarSesion = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleVolver = () => {
    setActiveSection('dashboard');
  };

  const handleFinalizarPedidos = async () => {
    setModal({
      isOpen: true,
      title: 'Confirmar finalización',
      message: '¿Estás seguro de que quieres finalizar los pedidos de la próxima semana? Esta acción moverá todos los pedidos a la semana actual y también actualizará el menú actual.',
      type: 'warning',
      actions: [
        {
          label: 'Cancelar',
          type: 'secondary',
          onClick: () => setModal({ isOpen: false, title: '', message: '', type: 'info' })
        },
        {
          label: 'Finalizar',
          type: 'danger',
          onClick: async () => {
            try {
              // console.log('Iniciando proceso de finalización de pedidos...');
              const db = getFirestore();
              const pedidosRef = collection(db, "pedidos");
              
              // Obtener todos los pedidos de la próxima semana
              const q = query(pedidosRef, where("tipo", "==", "proxima"));
              const querySnapshot = await getDocs(q);
              // console.log('Pedidos encontrados de próxima semana:', querySnapshot.size);

              if (querySnapshot.empty) {
                // console.log('No se encontraron pedidos de próxima semana');
                setModal({
                  isOpen: true,
                  title: 'Sin pedidos',
                  message: 'No hay pedidos de próxima semana para finalizar.',
                  type: 'info'
                });
                return;
              }

              // Mover cada pedido a la semana actual y guardar en historial
              const historialRef = collection(db, "historial_pedidos");
              for (const docSnapshot of querySnapshot.docs) {
                const pedidoData = docSnapshot.data();
                // console.log('Procesando pedido:', {
                //   id: docSnapshot.id,
                //   tipoActual: pedidoData.tipo,
                //   uidUsuario: pedidoData.uidUsuario
                // });

                const nuevoPedidoRef = doc(db, "pedidos", docSnapshot.id);
                
                // Crear un nuevo objeto con todos los datos del pedido y actualizar el tipo
                const pedidoActualizado = {
                  ...pedidoData,
                  tipo: "actual",
                  fechaFinalizacion: new Date()
                };

                // console.log('Actualizando pedido con datos:', pedidoActualizado);

                // Actualizar el pedido completamente
                await setDoc(nuevoPedidoRef, pedidoActualizado);
                // console.log('Pedido actualizado exitosamente');

                // Guardar en historial
                await addDoc(historialRef, {
                  ...pedidoData,
                  fechaPedido: new Date(),
                  corteSemana: true // puedes usar este flag para distinguir los cortes semanales
                });
                // console.log('Pedido guardado en historial');
              }

              // Copiar el menú de próxima semana como menú actual
              const menuProximaRef = doc(db, 'menus', 'menuProxima');
              const menuActualRef = doc(db, 'menus', 'menuActual');
              const menuProximaSnap = await getDoc(menuProximaRef);
              if (menuProximaSnap.exists()) {
                const menuProximaData = menuProximaSnap.data();
                await setDoc(menuActualRef, menuProximaData);
                // console.log('Menú de próxima semana copiado como menú actual');
                // Eliminar el menú de próxima semana
                await deleteDoc(menuProximaRef);
                // console.log('Menú de próxima semana eliminado');
              } else {
                // console.warn('No se encontró menú de próxima semana para copiar');
              }

              // Verificar que los pedidos se hayan actualizado correctamente
              const pedidosActualizadosRef = collection(db, "pedidos");
              const qActualizados = query(pedidosActualizadosRef, where("tipo", "==", "actual"));
              const pedidosActualizados = await getDocs(qActualizados);
              // console.log('Pedidos actuales después de la actualización:', pedidosActualizados.size);

              setModal({
                isOpen: true,
                title: 'Éxito',
                message: `Se han finalizado ${querySnapshot.size} pedidos correctamente y el menú actual ha sido actualizado.`,
                type: 'success'
              });
            } catch (error) {
              console.error('Error detallado al finalizar pedidos:', error);
              setModal({
                isOpen: true,
                title: 'Error',
                message: 'Error al finalizar los pedidos: ' + error.message,
                type: 'error'
              });
            }
          }
        }
      ]
    });
  };

  const handleCierreSemanal = () => {
    navigate('/admin/cierre-semanal');
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'subirMenu':
        return <SubirMenu />;
      case 'menu':
        return <MenuForm />;
      case 'verMenu':
        return <AdminMenu onMenuDeleted={() => setActiveSection('dashboard')} tipo="actual" />;
      case 'verMenuProxima':
        return <AdminMenu onMenuDeleted={() => setActiveSection('dashboard')} tipo="proxima" />;
      case 'usuarios':
        return <AdminUsers mode="view" />;
      case 'pedidosActual':
        return <VerPedidos tipo="actual" />;
      case 'pedidosProxima':
        return <VerPedidos tipo="proxima" />;
      case 'pedidosTardios':
        return <VerPedidos tipo="tardio" />;
      case 'historial':
        return <HistorialPedidos />;
      case 'estructuraMenu':
        return <MenuStructureManager />;
      case 'precioMenu':
        return <PrecioMenu />;
      case 'configuracionOpciones':
        return <ConfiguracionOpciones />;
      default:
        return null;
    }
  };

  return (
    <div className="admin-dashboard">
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ isOpen: false, title: '', message: '', type: 'info' })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        actions={modal.actions}
      />
      <h1 className="admin-dashboard-title">Panel de Administración</h1>
      
      {activeSection === 'dashboard' ? (
        <div className="admin-buttons-container">
          <button className="admin-button" style={{backgroundColor:'#88bc27'}} onClick={handleVerMenu}>
            <span className="button-icon">📋 </span>
            Menú Semana Actual
          </button>
          <button className="admin-button" style={{backgroundColor:'#4f4f4f'}} onClick={handleEditarMenu}>
            <span className="button-icon">📝</span>
            Subir Menú / Editar Menú
          </button>
          <button className="admin-button" style={{backgroundColor:'#3156bc'}} onClick={handleVerMenuProxima}>
            <span className="button-icon">📋 </span>
            Menú Próxima Semana
          </button>
          <button className="admin-button" style={{backgroundColor:'#5c47d3'}} onClick={handleGestionarEstructura}>
            <span className="button-icon">⚙️</span>
            Gestionar Estructura del Menú
          </button>
          <button className="admin-button" onClick={handleVerHistorial}>
            <span className="button-icon">📊</span>
            Historial de Pedidos
          </button>
          <button className="admin-button" style={{backgroundColor:'#5c47d3'}} onClick={handleConfiguracionOpciones}>
            <span className="button-icon">⚙️</span>
            Configurar Opciones del Menú
          </button> 
          <button className="admin-button" style={{backgroundColor:'#88bc27'}} onClick={handleVerPedidosActual}>
            <span className="button-icon">📋</span>
            Pedidos Semana Actual
          </button>
          <button className="admin-button" style={{backgroundColor:'#259e9e'}} onClick={handleVerUsuarios}>
            <span className="button-icon">👥</span>
            Usuarios
          </button>
          <button className="admin-button" style={{backgroundColor:'#3156bc'}} onClick={handleVerPedidos}>
            <span className="button-icon">📋</span>
            Pedidos Próxima Semana
          </button>
          {/* <button className="admin-button" onClick={handleVerPedidosTardios}>
            <span className="button-icon">📋⏰</span>
            Pedidos Tarde
          </button> */}
          <button className="admin-button special" style={{backgroundColor:'#282a30'}} onClick={handleCierreSemanal}>
            <span className="button-icon">📊</span>
            Cierre Semanal
          </button>
          <button className="admin-button" style={{backgroundColor:'#4f4f4f'}} onClick={()=>setModalFechaInicio(true)}>
            <span className="button-icon">🗓️</span>
            Configurar Fechas
          </button>
          <button className="admin-button" style={{backgroundColor:'#11b709'}} onClick={() => setActiveSection('precioMenu')}>
            <span className="button-icon">💰</span>
            Configurar Precio Menú
          </button>
          <button className="admin-button" style={{ backgroundColor: '#A31A30' }} onClick={handleCerrarSesion}>
            <span className="button-icon">🚪</span>
            Cerrar Sesión
          </button>
          <Modal
            isOpen={modalFechaInicio}
            onClose={()=>setModalFechaInicio(false)}
            title="Configurar Fechas de Pedidos"
            message="Configura la fecha de inicio y la fecha límite para los pedidos."
            type="info"
            actions={[]}
          >
            <div style={{margin:'1.5rem 0', textAlign:'center', display:'flex', flexDirection:'column', gap:'2.5rem', alignItems:'center'}}>
              <div>
                <label style={{color:'#FFA000', fontWeight:'bold'}}>Fecha de inicio:</label><br/>
                <input 
                  type="datetime-local" 
                  value={fechaInicioInput} 
                  onChange={handleFechaInicioChange}
                  style={{padding:'0.5rem', borderRadius:'6px', border:'1px solid #3a3a38', marginTop:'0.5rem'}} 
                />
                <div style={{color:'#fff', marginTop:'0.5rem', fontSize:'0.95em'}}>
                  Actual: {fechaInicio ? fechaInicio.toLocaleString('es-AR', { 
                    day: 'numeric',
                    month: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  }) : 'No definida'}
                </div>
              </div>
              <div>
                <label style={{color:'#FFA000', fontWeight:'bold'}}>Fecha límite:</label><br/>
                <input 
                  type="datetime-local" 
                  value={fechaLimiteInput} 
                  onChange={e=>setFechaLimiteInput(e.target.value)} 
                  min={fechaInicioInput}
                  max={fechaLimiteMaxima}
                  style={{padding:'0.5rem', borderRadius:'6px', border:'1px solid #3a3a38', marginTop:'0.5rem'}} 
                />
                <div style={{color:'#fff', marginTop:'0.5rem', fontSize:'0.95em'}}>
                  Actual: {fechaLimite ? fechaLimite.toLocaleString('es-AR', {
                    day: 'numeric',
                    month: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  }) : 'No definida'}
                </div>
                <div style={{color:'#FFA000', marginTop:'0.5rem', fontSize:'0.9em'}}>
                  La fecha límite debe ser antes del sabado de la misma semana
                </div>
              </div>
              <div style={{display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center'}}>
                <button 
                  className="admin-button" 
                  style={{background:'#888', width:'40%'}} 
                  onClick={()=>setModalFechaInicio(false)}
                >
                  Cancelar
                </button>
                <button 
                  className="admin-button" 
                  style={{background:'#28a745', width:'40%'}} 
                  onClick={()=>{
                    guardarFechas();
                    setModalFechaInicio(false);
                  }}
                >
                  Guardar Fechas
                </button>
              </div>
              <div style={{display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center'}}>
                <button 
                  className="admin-button" 
                  style={{background:'#dc3545', width:'40%'}} 
                  onClick={()=>{
                    if(window.confirm('¿Estás seguro de que quieres eliminar las fechas configuradas?')) {
                      eliminarFechas();
                      setModalFechaInicio(false);
                    }
                  }}
                >
                  Eliminar Fechas
                </button>
              </div>
            </div>
          </Modal>
        </div>
      ) : (
        <div className="admin-section">
          <button ref={backButtonRef} className="back-button" onClick={handleVolver}>
            <span className="button-icon">←</span>
            
          </button>
          {renderActiveSection()}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 