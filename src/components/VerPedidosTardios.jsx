import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, deleteDoc, addDoc, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import Modal from './Modal';
import Spinner from './Spinner';
import './VerPedidos.css';

const VerPedidosTardios = () => {
  const [pedidos, setPedidos] = useState([]);
  const [contadores, setContadores] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [success, setSuccess] = useState(null);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [formEdit, setFormEdit] = useState({ lunes: '', martes: '', miercoles: '', jueves: '', viernes: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [menuData, setMenuData] = useState(null);
  const [precioMenu, setPrecioMenu] = useState(0);
  const [opcionesMenu, setOpcionesMenu] = useState(null);
  const [porcentajeBonificacion, setPorcentajeBonificacion] = useState(70);

  const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

  const esNoPedir = (valor) => {
    if (!valor) return true;
    if (valor === 'no_pedir') return true;
    if (typeof valor === 'string' && valor.trim().toUpperCase().normalize('NFD').replace(/\u0300-\u036f/g, '') === 'NO PEDIR COMIDA ESTE DIA') return true;
    return false;
  };

  const cargarPedidos = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener todos los usuarios registrados de la colección users
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);

      // Crear un mapa de usuarios (excluyendo al administrador)
      const usuarios = new Map();
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (userData.rol !== 'admin') {
          usuarios.set(doc.id, {
            id: doc.id,
            nombre: `${userData.nombre || ''} ${userData.apellido || ''}`.trim() || 'Usuario sin nombre',
            email: userData.email,
            bonificacion: userData.bonificacion || false
          });
        }
      });

      // Obtener los pedidos actuales
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef, where('tipo', '==', 'actual'));
      const pedidosSnapshot = await getDocs(q);

      // Crear un mapa de los pedidos más recientes por usuario
      const pedidosPorUsuario = new Map();
      const pedidosOrdenados = pedidosSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .sort((a, b) => {
          const fechaA = a.fechaCreacion ? new Date(a.fechaCreacion) : new Date(0);
          const fechaB = b.fechaCreacion ? new Date(b.fechaCreacion) : new Date(0);
          return fechaB - fechaA;
        });

      pedidosOrdenados.forEach(pedido => {
        if (!pedidosPorUsuario.has(pedido.uidUsuario)) {
          pedidosPorUsuario.set(pedido.uidUsuario, pedido);
        }
      });

      // Crear lista final de usuarios con sus pedidos tardíos
      const usuariosConPedidos = Array.from(usuarios.values())
        .map(usuario => {
          const pedido = pedidosPorUsuario.get(usuario.id);
          if (!pedido) return null;

          // Calcular el precio total basado en los pedidos tardíos
          let precioTotal = 0;
          diasSemana.forEach(dia => {
            const diaData = pedido[dia];
            if (diaData && diaData.esTardio === true && diaData.pedido && diaData.pedido !== 'no_pedir') {
              if (usuario.bonificacion) {
                precioTotal += 0; // Si está bonificado, el precio es 0
              } else {
                // Si no está bonificado, aplicar el porcentaje de bonificación
                const porcentaje = parseFloat(porcentajeBonificacion) || 70;
                const precioConBonificacion = Math.round(precioMenu * (100 - porcentaje) / 100);
                precioTotal += precioConBonificacion;
              }
            }
          });

          return {
            id: usuario.id,
            nombre: usuario.nombre,
            fecha: pedido.fechaCreacion,
            lunesData: pedido.lunes ? { ...pedido.lunes } : null,
            martesData: pedido.martes ? { ...pedido.martes } : null,
            miercolesData: pedido.miercoles ? { ...pedido.miercoles } : null,
            juevesData: pedido.jueves ? { ...pedido.jueves } : null,
            viernesData: pedido.viernes ? { ...pedido.viernes } : null,
            tienePedido: true,
            precioTotal: precioTotal
          };
        })
        .filter(usuario => usuario !== null);

      setPedidos(usuariosConPedidos);
    } catch (error) {
      setError(`Error al cargar la información: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const cargarOpcionesMenu = async () => {
    try {
      const opcionesRef = doc(db, 'config', 'opcionesMenu');
      const opcionesSnap = await getDoc(opcionesRef);
      if (opcionesSnap.exists()) {
        const data = opcionesSnap.data();
        const opcionesArray = [...new Set(Object.values(data).flat())]
          .filter(opt => opt !== 'NO PEDIR')
          .sort((a, b) => a.localeCompare(b, 'es'));
        setOpcionesMenu(opcionesArray);
      }
    } catch (error) {
      setError('Error al cargar opciones de menú');
    }
  };

  const normalizarPedido = (pedido) => {
    return pedido
      .toUpperCase()
      .replace(/_/g, ' ')
      .replace(/C\/GELATINA/g, 'C/GELATINA')
      .replace(/C\/BANANA/g, 'C/BANANA')
      .replace(/C\/MANZANA/g, 'C/MANZANA')
      .replace(/C\/NARANJA/g, 'C/NARANJA')
      .replace(/C\/POSTRE/g, 'C/POSTRE')
      .replace(/C\/YOGURT/g, 'C/YOGURT');
  };

  const calcularContadores = (pedidosData) => {
    if (!opcionesMenu || !Array.isArray(opcionesMenu)) {
      return {};
    }

    const conteo = {};
    
    // Inicializar contadores para cada opción del menú
    opcionesMenu.forEach(opcion => {
      if (opcion !== 'NO PEDIR') {
        // Normalizar la opción para que use C/GELATINA
        const opcionNormalizada = opcion.replace(/C\/[A-Z]+$/, 'C/GELATINA');
        conteo[opcionNormalizada] = { LU: 0, MA: 0, MI: 0, JU: 0, VI: 0 };
      }
    });

    // Contar pedidos
    pedidosData.forEach(usuario => {
      diasSemana.forEach((dia, index) => {
        const diaData = usuario[`${dia}Data`];
        if (diaData && diaData.esTardio && diaData.pedido && !esNoPedir(diaData.pedido)) {
          const pedidoNormalizado = normalizarPedido(diaData.pedido);
          // Normalizar el pedido para que use C/GELATINA
          const pedidoConGelatina = pedidoNormalizado.replace(/C\/[A-Z]+$/, 'C/GELATINA');
          const opcionEncontrada = opcionesMenu.find(opt => {
            const optNormalizada = opt.replace(/C\/[A-Z]+$/, 'C/GELATINA');
            return pedidoConGelatina.includes(optNormalizada);
          });

          if (opcionEncontrada) {
            const opcionNormalizada = opcionEncontrada.replace(/C\/[A-Z]+$/, 'C/GELATINA');
            const diaKey = Object.keys(conteo[opcionNormalizada])[index];
            conteo[opcionNormalizada][diaKey]++;
          }
        }
      });
    });

    return conteo;
  };

  useEffect(() => {
    if (pedidos.length > 0 && opcionesMenu) {
      const nuevosContadores = calcularContadores(pedidos);
      setContadores(nuevosContadores);
    }
  }, [pedidos, opcionesMenu]);

  const cargarMenu = async () => {
    try {
      const menuRef = doc(db, 'menus', 'menuProxima');
      const menuSnap = await getDoc(menuRef);
      if (menuSnap.exists()) {
        setMenuData(menuSnap.data());
      }
    } catch (error) {
      setMenuData(null);
    }
  };

  const cargarPrecioMenu = async () => {
    try {
      const configRef = doc(db, 'config', 'precioMenu');
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const data = configSnap.data();
        setPrecioMenu(data.precio || 0);
        setPorcentajeBonificacion(data.porcentajeBonificacion || 70);
      } else {
        setPrecioMenu(0);
        setPorcentajeBonificacion(70);
      }
    } catch (error) {
      setPrecioMenu(0);
      setPorcentajeBonificacion(70);
    }
  };

  const formatearPrecio = (precio) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(precio);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Fecha desconocida';
    try {
      if (fecha.seconds) {
        return new Date(fecha.seconds * 1000).toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      if (typeof fecha === 'string') {
        return new Date(fecha).toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      if (fecha instanceof Date) {
        return fecha.toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      return 'Fecha desconocida';
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  const formatearOpcion = (opcion) => {
    if (!opcion) {
      return 'NO COMPLETÓ';
    }
    
    // Si es un objeto (pedido tardío)
    if (typeof opcion === 'object') {
      if (opcion.pedido === 'no_pedir') {
        return 'NO PIDIÓ';
      }
      
      if (!opcion.esTardio) {
        return 'PEDIDO NORMAL';
      }
      
      // Para pedidos tardíos, mostrar el pedido original
      const pedidoNormalizado = normalizarPedido(opcion.pedido);
      const menuLabel = Array.isArray(opcionesMenu) && opcionesMenu.find(opt => pedidoNormalizado.includes(opt)) || pedidoNormalizado;
      // Reemplazar cualquier sufijo de postre por C/GELATINA
      const menuLabelConGelatina = menuLabel.replace(/C\/[A-Z]+$/, 'C/GELATINA');
      return `${menuLabelConGelatina} (Pedido Tarde)`;
    }
    
    // Si es un string (pedido normal)
    if (opcion === 'no_pedir') return 'NO PIDIÓ';
    
    const pedidoNormalizado = normalizarPedido(opcion);
    const menuLabel = Array.isArray(opcionesMenu) && opcionesMenu.find(opt => pedidoNormalizado.includes(opt)) || pedidoNormalizado;
    // Reemplazar cualquier sufijo de postre por C/GELATINA
    return menuLabel.replace(/C\/[A-Z]+$/, 'C/GELATINA');
  };

  const exportarAExcel = () => {
    // Preparar los datos de pedidos tardíos para Excel
    const datosPedidos = pedidos.map(usuario => ({
      'Nombre': usuario.nombre,
      'Fecha': usuario.fecha ? formatearFecha(usuario.fecha) : '',
      'Lunes': usuario.lunesData && usuario.lunesData.esTardio && !esNoPedir(usuario.lunesData.pedido) ? formatearOpcion(usuario.lunesData) : '',
      'Martes': usuario.martesData && usuario.martesData.esTardio && !esNoPedir(usuario.martesData.pedido) ? formatearOpcion(usuario.martesData) : '',
      'Miércoles': usuario.miercolesData && usuario.miercolesData.esTardio && !esNoPedir(usuario.miercolesData.pedido) ? formatearOpcion(usuario.miercolesData) : '',
      'Jueves': usuario.juevesData && usuario.juevesData.esTardio && !esNoPedir(usuario.juevesData.pedido) ? formatearOpcion(usuario.juevesData) : '',
      'Viernes': usuario.viernesData && usuario.viernesData.esTardio && !esNoPedir(usuario.viernesData.pedido) ? formatearOpcion(usuario.viernesData) : '',
      'Precio Total': usuario.precioTotal
    }));

    // Crear el libro de trabajo y las hojas
    const wb = XLSX.utils.book_new();
    const wsPedidos = XLSX.utils.json_to_sheet(datosPedidos);

    // Ajustar el ancho de las columnas
    const wscols = [
      { wch: 30 }, // Nombre/Menú
      { wch: 30 }, // Fecha
      { wch: 30 }, // Lunes
      { wch: 30 }, // Martes
      { wch: 30 }, // Miércoles
      { wch: 30 }, // Jueves
      { wch: 30 }, // Viernes
      { wch: 30 }  // Precio Total
    ];
    wsPedidos['!cols'] = wscols;

    // Agregar las hojas al libro
    XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos Tardes');

    // Guardar el archivo
    const fecha = new Date().toLocaleDateString().replace(/\//g, '-');
    XLSX.writeFile(wb, `Pedidos_Tardes_${fecha}.xlsx`);
  };

  const handleFilaClick = (usuario) => {
    setUsuarioEditando(usuario);
    setFormEdit({
      lunes: usuario.lunesData?.pedido || '',
      martes: usuario.martesData?.pedido || '',
      miercoles: usuario.miercolesData?.pedido || '',
      jueves: usuario.juevesData?.pedido || '',
      viernes: usuario.viernesData?.pedido || ''
    });
  };

  const handleChangeEdit = (e) => {
    const { name, value } = e.target;
    setFormEdit(prev => ({ ...prev, [name]: value }));
  };

  const handleGuardarEdicion = async () => {
    if (!usuarioEditando) return;
    setEditLoading(true);
    try {
      // Buscar el pedido de este usuario
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef, where('uidUsuario', '==', usuarioEditando.id), where('tipo', 'in', ['proxima', 'actual']));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const pedidoDoc = querySnapshot.docs[0];
        const pedidoData = pedidoDoc.data();
        
        // Calcular nuevo precio total (solo días tardíos y no 'no_pedir')
        const diasPedidos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].filter(
          dia => formEdit[dia] && formEdit[dia] !== 'no_pedir' && usuarioEditando[`${dia}Data`]?.esTardio
        ).length;
        const porcentaje = parseFloat(porcentajeBonificacion) || 70;
        const precioConBonificacion = Math.round(precioMenu * (100 - porcentaje) / 100);
        const nuevoPrecioTotal = diasPedidos * precioConBonificacion;

        // Actualizar los campos de los días manteniendo el estado esTardio
        const diasActualizados = {};
        diasSemana.forEach(dia => {
          diasActualizados[dia] = {
            ...pedidoData[dia],
            pedido: formEdit[dia],
            esTardio: usuarioEditando[`${dia}Data`]?.esTardio || false
          };
        });

        // Actualizar el documento
        await updateDoc(doc(db, 'pedidos', pedidoDoc.id), {
          ...diasActualizados,
          precioTotal: nuevoPrecioTotal
        });

        setModal({ isOpen: true, title: 'Éxito', message: 'Pedido actualizado correctamente.', type: 'success' });
        setUsuarioEditando(null);
        cargarPedidos();
      } else {
        setModal({ isOpen: true, title: 'Error', message: 'No se encontró el pedido para editar.', type: 'error' });
      }
    } catch (error) {
      setModal({ isOpen: true, title: 'Error', message: 'Error al guardar los cambios: ' + error.message, type: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        await cargarPrecioMenu();
        await cargarMenu();
        await cargarOpcionesMenu();
        await cargarPedidos();
      } catch (error) {
        setError('Error al cargar los datos iniciales');
      }
    };

    cargarDatos();

    const handlePedidosActualizados = () => {
      cargarPedidos();
    };

    window.addEventListener('pedidosActualizados', handlePedidosActualizados);

    return () => {
      window.removeEventListener('pedidosActualizados', handlePedidosActualizados);
    };
  }, [precioMenu, porcentajeBonificacion]);

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!pedidos || pedidos.length === 0) {
    return <div className="no-pedidos">No hay pedidos tardes registrados</div>;
  }

  return (
    <div className="ver-pedidos-container">
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ isOpen: false, title: '', message: '', type: 'info' })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        actions={modal.actions}
      />
      <div className="header-container">
        <h2>Pedidos Tardes</h2>
        <div className="header-buttons">
          <button 
            className="exportar-btn"
            onClick={exportarAExcel}
          >
            Exportar a Excel
          </button>
        </div>
      </div>

      <div className="tabla-container">
        <table className="tabla-pedidos">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Fecha</th>
              <th>Lunes</th>
              <th>Martes</th>
              <th>Miércoles</th>
              <th>Jueves</th>
              <th>Viernes</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((usuario) => (
              <tr key={usuario.id} style={{ cursor: 'pointer' }} onClick={() => handleFilaClick(usuario)}>
                <td>{usuario.nombre}</td>
                <td>{usuario.fecha ? formatearFecha(usuario.fecha) : ''}</td>
                {diasSemana.map(dia => {
                  const diaData = usuario[`${dia}Data`];
                  return (
                    <td key={dia}>
                      {diaData ? formatearOpcion(diaData) : ''}
                    </td>
                  );
                })}
                <td>{formatearPrecio(usuario.precioTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tabla de Resumen */}
      <div className="resumen-container">
        <h3>Resumen de Pedidos Tardes</h3>
        <div className="tablas-resumen">
          <table className="tabla-resumen">
            <thead>
              <tr>
                <th>MENU</th>
                <th>LU</th>
                <th>MA</th>
                <th>MI</th>
                <th>JU</th>
                <th>VI</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(contadores)
                .sort(([a], [b]) => a.localeCompare(b, 'es'))
                .map(([menu, valores]) => (
                  <tr key={menu}>
                    <td>{menu}</td>
                    <td>{valores.LU}</td>
                    <td>{valores.MA}</td>
                    <td>{valores.MI}</td>
                    <td>{valores.JU}</td>
                    <td>{valores.VI}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {success && <div className="success-message">{success}</div>}

      {/* Modal de edición */}
      {usuarioEditando && (
        <Modal
          isOpen={true}
          onClose={() => setUsuarioEditando(null)}
          title={`Editar pedido de ${usuarioEditando.nombre}`}
          message={null}
          type="info"
        >
          <form onSubmit={e => { e.preventDefault(); handleGuardarEdicion(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].map((dia) => (
              <div key={dia} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column' }}>
                  {dia.charAt(0).toUpperCase() + dia.slice(1)}:
                  {menuData?.dias?.[dia]?.esFeriado ? (
                    <div style={{ color: '#b91c1c', fontWeight: 'bold', margin: '0.5rem 0' }}>
                      FERIADO - No hay servicio de comida este día
                    </div>
                  ) : (
                    <select
                      name={dia}
                      value={formEdit[dia] || ''}
                      onChange={handleChangeEdit}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #bdbdbd',
                        fontSize: '1rem',
                        marginTop: '0.3rem',
                        marginBottom: '0.3rem',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        outline: 'none'
                      }}
                    >
                      <option value="">Selecciona una opción</option>
                      <option value="no_pedir">NO PIDIÓ</option>
                      {opcionesMenu?.map(opt => (
                        <option key={opt} value={opt.toLowerCase().replace(/ /g, '_')}>{opt}</option>
                      ))}
                    </select>
                  )}
                </label>
                {!menuData?.dias?.[dia]?.esFeriado && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={usuarioEditando[`${dia}Data`]?.esTardio || false}
                      onChange={(e) => {
                        const newDiaData = { ...usuarioEditando[`${dia}Data`], esTardio: e.target.checked };
                        setUsuarioEditando({ ...usuarioEditando, [`${dia}Data`]: newDiaData });
                      }}
                      style={{ width: '1.2rem', height: '1.2rem' }}
                    />
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>Pedido tarde</span>
                  </label>
                )}
              </div>
            ))}
            <button
              type="submit"
              disabled={editLoading}
              style={{
                background: editLoading ? '#90caf9' : '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.7rem 1.5rem',
                fontWeight: 'bold',
                fontSize: '1rem',
                cursor: editLoading ? 'not-allowed' : 'pointer',
                marginTop: '1rem',
                transition: 'background 0.2s'
              }}
            >
              {editLoading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default VerPedidosTardios; 