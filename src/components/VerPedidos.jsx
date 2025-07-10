import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc, where, updateDoc, addDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import Modal from './Modal';
import Spinner from './Spinner';
import VerPedidosTardios from './VerPedidosTardios';
import VerPedidosProximaSemana from './VerPedidosProximaSemana';
import './VerPedidos.css';

const VerPedidos = ({ tipo = 'actual' }) => {
  // Si el tipo es 'tardio', renderizar el componente VerPedidosTardios
  if (tipo === 'tardio') {
    return <VerPedidosTardios />;
  }

  // Si el tipo es 'proxima', renderizar el componente VerPedidosProximaSemana
  if (tipo === 'proxima') {
    return <VerPedidosProximaSemana />;
  }

  const [pedidos, setPedidos] = useState([]);
  const [contadores, setContadores] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hayMenu, setHayMenu] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [editingUser, setEditingUser] = useState(null);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', type: 'info', actions: [] });
  const [menuData, setMenuData] = useState(null);
  const [precioMenu, setPrecioMenu] = useState(0);
  const [bonificacionEmpleadoNormal, setBonificacionEmpleadoNormal] = useState(0);
  const [isPrecioLoaded, setIsPrecioLoaded] = useState(false);
  const [isMenuLoaded, setIsMenuLoaded] = useState(false);
  const [isPedidosLoaded, setIsPedidosLoaded] = useState(false);
  const [opcionesMenuConfig, setOpcionesMenuConfig] = useState(null);
  const [filtroNombre, setFiltroNombre] = useState('');

  const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
  const diasSemanaFirestore = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

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

      // Obtener los pedidos según el tipo
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

      // Crear lista final de usuarios con sus pedidos
      const usuariosConPedidos = Array.from(usuarios.values())
        .map(usuario => {
          const pedido = pedidosPorUsuario.get(usuario.id);
          
          // Calcular el precio total basado en los pedidos y la bonificación
          let precioTotal = 0;
          if (pedido) {
            diasSemana.forEach(dia => {
              const diaData = pedido[dia];
              if (diaData && diaData.pedido && diaData.pedido !== 'no_pedir') {
                if (usuario.bonificacion) {
                  precioTotal += 0; // Si está bonificado, el precio es 0
                } else {
                  precioTotal += (precioMenu - bonificacionEmpleadoNormal); // Si no está bonificado, es el precio normal menos la bonificación
                }
              }
            });
          }

          return {
            id: usuario.id,
            nombre: usuario.nombre,
            fecha: pedido ? pedido.fechaCreacion : '',
            lunesData: pedido ? pedido.lunes : null,
            martesData: pedido ? pedido.martes : null,
            miercolesData: pedido ? pedido.miercoles : null,
            juevesData: pedido ? pedido.jueves : null,
            viernesData: pedido ? pedido.viernes : null,
            tienePedido: !!pedido,
            precioTotal: precioTotal,
            bonificacion: usuario.bonificacion
          };
        })
        .filter(usuario => usuario !== null);

      // Ordenar alfabéticamente por nombre
      usuariosConPedidos.sort((a, b) => a.nombre.localeCompare(b.nombre));

      setPedidos(usuariosConPedidos);
      setIsPedidosLoaded(true);
    } catch (error) {
      setError(`Error al cargar la información: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const cargarMenu = async () => {
    try {
      const menuRef = doc(db, 'menus', 'menuActual');
      const menuDoc = await getDoc(menuRef);
      
      if (menuDoc.exists()) {
        setMenuData(menuDoc.data());
        setHayMenu(true);
      } else {
        setHayMenu(false);
      }
      setIsMenuLoaded(true);
    } catch (error) {
      setError('Error al cargar el menú');
    }
  };

  const cargarPrecioMenu = async () => {
    try {
      const precioRef = doc(db, 'config', 'precioMenu');
      const precioSnap = await getDoc(precioRef);
      if (precioSnap.exists()) {
        const data = precioSnap.data();
        setPrecioMenu(data.precio || 0);
        setBonificacionEmpleadoNormal(data.bonificacionEmpleadoNormal || 0);
      }
      setIsPrecioLoaded(true);
    } catch (error) {
      setPrecioMenu(0);
      setBonificacionEmpleadoNormal(0);
      setIsPrecioLoaded(true);
    }
  };

  const cargarOpcionesMenu = async () => {
    try {
      const opcionesRef = doc(db, 'config', 'opcionesMenu');
      const opcionesSnap = await getDoc(opcionesRef);
      if (opcionesSnap.exists()) {
        const opcionesData = opcionesSnap.data();
        setOpcionesMenuConfig(opcionesData);
      }
    } catch (error) {
      setError('Error al cargar opciones de menú');
    }
  };

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setLoading(true);
        await cargarPrecioMenu();
        await cargarMenu();
        await cargarOpcionesMenu();
        await cargarPedidos();
      } catch (error) {
        setError('Error al cargar los datos iniciales');
      } finally {
        setLoading(false);
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
  }, [precioMenu]);

  const limpiarPedidosActuales = async () => {
    setModal({
      isOpen: true,
      title: 'Confirmar eliminación',
      message: '¿Estás seguro de que deseas eliminar todos los pedidos? Esta acción no se puede deshacer.',
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
          onClick: confirmarEliminacion
        }
      ]
    });
  };

  const confirmarEliminacion = async () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
    setIsDeleting(true);
    try {
      const pedidosRef = collection(db, 'pedidos');
      const pedidosSnapshot = await getDocs(pedidosRef);
      
      if (pedidosSnapshot.empty) {
        setModal({
          isOpen: true,
          title: 'Sin pedidos',
          message: 'No hay pedidos para eliminar',
          type: 'info'
        });
        return;
      }

      for (const doc of pedidosSnapshot.docs) {
        await deleteDoc(doc.ref);
      }
      
      setModal({
        isOpen: true,
        title: 'Éxito',
        message: `Se han eliminado ${pedidosSnapshot.size} pedidos correctamente`,
        type: 'success'
      });
      
      await cargarPedidos();
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al eliminar los pedidos: ' + error.message,
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const calcularContadores = (pedidosData) => {
    // Crear un objeto dinámico para los contadores basado en los labels completos de Firestore
    const conteo = {};

    // Crear un Map para todas las opciones únicas de todos los días (normalizadas)
    const labelsUnicos = new Map();
    // Mapeo value->label por día
    const valueToLabelPorDia = {};
    
    // Primero, recolectar todas las opciones únicas de todos los días
    diasSemana.forEach((dia, index) => {
      const diaFirestore = diasSemanaFirestore[index];
      valueToLabelPorDia[dia] = {};
      
      // Verificar si existen las opciones para este día
      if (opcionesMenuConfig && opcionesMenuConfig[diaFirestore]) {
        const opcionesDelDia = opcionesMenuConfig[diaFirestore];
        
        opcionesDelDia.forEach(label => {
          if (label.trim().toUpperCase() === 'NO PEDIR COMIDA ESTE DÍA') return;
          
          // Generar value igual que en el formulario
          const value = label
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
            .replace(/\s+/g, '_');
          
          valueToLabelPorDia[dia][value] = label;
          
          // Normalizar el label para unicidad (robusto)
          const labelNorm = label
            .trim()
            .toUpperCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
            .replace(/\s+/g, ' ') // un solo espacio entre palabras
            .replace(/ +/g, ' '); // quitar espacios extra
          
          if (!labelsUnicos.has(labelNorm)) {
            labelsUnicos.set(labelNorm, label.trim());
          }
        });
      }
    });

    // Inicializar el conteo para todas las opciones únicas con ceros
    Array.from(labelsUnicos.values()).forEach(label => {
      conteo[label] = { LU: 0, MA: 0, MI: 0, JU: 0, VI: 0 };
    });

    // Contar los pedidos exactos por label y día
    pedidosData.forEach(usuario => {
      diasSemana.forEach((dia, index) => {
        const diaData = usuario[`${dia}Data`];
        if (!diaData) return;
        
        const opcion = diaData.pedido;
        if (opcion && opcion !== 'no_pedir') {
          // Buscar el label correspondiente a este value
          const label = valueToLabelPorDia[dia][opcion];
          if (label) {
            // Solo normalizar a C/GELATINA si es un pedido tardío
            const labelNormalizado = diaData.esTardio ? 
              label.replace(/C\/[A-Z]+$/, 'C/GELATINA') : 
              label;
            
            if (conteo[labelNormalizado]) {
              const diaKey = Object.keys(conteo[labelNormalizado])[index];
              conteo[labelNormalizado][diaKey]++;
            }
          }
        }
      });
    });

    // Asegurarse de que todas las opciones del menú estén en el conteo
    Object.values(opcionesMenuConfig || {}).flat().forEach(label => {
      if (label.trim().toUpperCase() === 'NO PEDIR COMIDA ESTE DÍA') return;
      
      if (!conteo[label.trim()]) {
        conteo[label.trim()] = { LU: 0, MA: 0, MI: 0, JU: 0, VI: 0 };
      }
    });

    return { conteo, todasLasOpciones: labelsUnicos };
  };

  useEffect(() => {
    if (pedidos.length > 0) {
      const nuevosContadores = calcularContadores(pedidos);
      setContadores(nuevosContadores.conteo);
    }
  }, [pedidos]);

  const opcionesMenu = [
    { value: "no_pedir", label: "NO PEDIR" },
    { value: "beti_jai_gelatina", label: "BETI JAI C/GELATINA" },
    { value: "pastas_gelatina", label: "PASTAS C/GELATINA" },
    { value: "light_gelatina", label: "LIGHT C/GELATINA" },
    { value: "clasico_gelatina", label: "CLASICO C/GELATINA" },
    { value: "ensalada_gelatina", label: "ENSALADA C/GELATINA" },
    { value: "dieta_blanda_gelatina", label: "DIETA BLANDA C/GELATINA" },
    { value: "menu_pbt_2_gelatina", label: "MENU PBT X 2 C/GELATINA" },
    { value: "sand_miga_gelatina", label: "SAND DE MIGA C/GELATINA" },
    { value: "beti_jai_con_postre", label: "BETI JAI C/POSTRE" },
    { value: "pastas_con_postre", label: "PASTAS C/POSTRE" },
    { value: "light_con_postre", label: "LIGHT C/POSTRE" },
    { value: "clasico_con_postre", label: "CLASICO C/POSTRE" },
    { value: "ensalada_con_postre", label: "ENSALADA C/POSTRE" },
    { value: "dieta_blanda_con_postre", label: "DIETA BLANDA C/POSTRE" },
    { value: "menu_pbt_2_con_postre", label: "MENU PBT X 2 C/POSTRE" },
    { value: "sand_miga_con_postre", label: "SAND DE MIGA C/POSTRE" }
  ];

  const opcionesMenuCompleto = [
    { value: "no_pedir", label: "NO PEDIR" },
    { value: "beti_jai_gelatina", label: "BETI JAI C/GELATINA" },
    { value: "beti_jai_manzana", label: "BETI JAI C/MANZANA" },
    { value: "beti_jai_naranja", label: "BETI JAI C/NARANJA" },
    { value: "beti_jai_pomelo", label: "BETI JAI C/POMELO" },
    { value: "beti_jai_banana", label: "BETI JAI C/BANANA" },
    { value: "pastas_gelatina", label: "PASTAS C/GELATINA" },
    { value: "pastas_manzana", label: "PASTAS C/MANZANA" },
    { value: "pastas_naranja", label: "PASTAS C/NARANJA" },
    { value: "pastas_pomelo", label: "PASTAS C/POMELO" },
    { value: "pastas_banana", label: "PASTAS C/BANANA" },
    { value: "light_gelatina", label: "LIGHT C/GELATINA" },
    { value: "light_manzana", label: "LIGHT C/MANZANA" },
    { value: "light_naranja", label: "LIGHT C/NARANJA" },
    { value: "light_pomelo", label: "LIGHT C/POMELO" },
    { value: "light_banana", label: "LIGHT C/BANANA" },
    { value: "clasico_gelatina", label: "CLASICO C/GELATINA" },
    { value: "clasico_manzana", label: "CLASICO C/MANZANA" },
    { value: "clasico_naranja", label: "CLASICO C/NARANJA" },
    { value: "clasico_pomelo", label: "CLASICO C/POMELO" },
    { value: "clasico_banana", label: "CLASICO C/BANANA" },
    { value: "ensalada_gelatina", label: "ENSALADA C/GELATINA" },
    { value: "ensalada_manzana", label: "ENSALADA C/MANZANA" },
    { value: "ensalada_naranja", label: "ENSALADA C/NARANJA" },
    { value: "ensalada_pomelo", label: "ENSALADA C/POMELO" },
    { value: "ensalada_banana", label: "ENSALADA C/BANANA" },
    { value: "dieta_blanda_gelatina", label: "DIETA BLANDA C/GELATINA" },
    { value: "dieta_blanda_manzana", label: "DIETA BLANDA C/MANZANA" },
    { value: "dieta_blanda_naranja", label: "DIETA BLANDA C/NARANJA" },
    { value: "dieta_blanda_pomelo", label: "DIETA BLANDA C/POMELO" },
    { value: "dieta_blanda_banana", label: "DIETA BLANDA C/BANANA" },
    { value: "menu_pbt_2_gelatina", label: "MENU PBT X 2 C/GELATINA" },
    { value: "menu_pbt_2_manzana", label: "MENU PBT X 2 C/MANZANA" },
    { value: "menu_pbt_2_naranja", label: "MENU PBT X 2 C/NARANJA" },
    { value: "menu_pbt_2_pomelo", label: "MENU PBT X 2 C/POMELO" },
    { value: "menu_pbt_2_banana", label: "MENU PBT X 2 C/BANANA" },
    { value: "sand_miga_gelatina", label: "SAND DE MIGA C/GELATINA" },
    { value: "sand_miga_manzana", label: "SAND DE MIGA C/MANZANA" },
    { value: "sand_miga_naranja", label: "SAND DE MIGA C/NARANJA" },
    { value: "sand_miga_pomelo", label: "SAND DE MIGA C/POMELO" },
    { value: "sand_miga_banana", label: "SAND DE MIGA C/BANANA" },
    { value: "beti_jai_con_postre", label: "BETI JAI C/POSTRE" },
    { value: "pastas_con_postre", label: "PASTAS C/POSTRE" },
    { value: "light_con_postre", label: "LIGHT C/POSTRE" },
    { value: "clasico_con_postre", label: "CLASICO C/POSTRE" },
    { value: "ensalada_con_postre", label: "ENSALADA C/POSTRE" },
    { value: "dieta_blanda_con_postre", label: "DIETA BLANDA C/POSTRE" },
    { value: "menu_pbt_2_con_postre", label: "MENU PBT X 2 C/POSTRE" },
    { value: "sand_miga_con_postre", label: "SAND DE MIGA C/POSTRE" }
  ];

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Fecha desconocida';
    try {
      // Firestore Timestamp
      if (fecha.seconds) {
        return new Date(fecha.seconds * 1000).toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      // String ISO
      if (typeof fecha === 'string') {
        return new Date(fecha).toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      // Date object
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
    if (!opcion) return 'NO COMPLETÓ';
    if (typeof opcion === 'object') {
      if (opcion.pedido === 'no_pedir') return 'NO PIDIÓ';
      const opcionEncontrada = opcionesMenuCompleto.find(opt => opt.value === opcion.pedido) || 
                             opcionesMenu.find(opt => opt.value === opcion.pedido);
      let menuLabel = opcionEncontrada ? opcionEncontrada.label : opcion.pedido.toUpperCase().replace(/_/g, ' ');
      
      if (opcion.esTardio) {
        // Reemplazar cualquier sufijo de postre por C/GELATINA
        menuLabel = menuLabel.replace(/C\/[A-Z]+$/, 'C/GELATINA');
        return `${menuLabel} (Pedido Tarde)`;
      }
      return menuLabel;
    }
    if (opcion === 'no_pedir') return 'NO PIDIÓ';
    const opcionEncontrada = opcionesMenuCompleto.find(opt => opt.value === opcion) || 
                           opcionesMenu.find(opt => opt.value === opcion);
    return opcionEncontrada ? opcionEncontrada.label : opcion.toUpperCase().replace(/_/g, ' ');
  };

  const esPedidoTardio = (opcion) => {
    if (!opcion) return false;
    if (typeof opcion === 'object') {
      return opcion.esTardio === true;
    }
    return false;
  };

  const exportarAExcel = () => {
    // Preparar los datos de pedidos para Excel
    const datosPedidos = pedidos.map(usuario => {
      // Calcular cantidad de menús pedidos en la semana
      const cantidadMenus = diasSemana.reduce((total, dia) => {
        const diaData = usuario[`${dia}Data`];
        return total + (diaData && diaData.pedido && diaData.pedido !== 'no_pedir' ? 1 : 0);
      }, 0);

      // Calcular bonificación empleado normal (solo para usuarios no bonificados)
      const bonificacionNormal = !usuario.bonificacion ? 
        (bonificacionEmpleadoNormal * cantidadMenus) : 0;

      // Calcular bonificación completa (solo para usuarios bonificados)
      const bonificacionCompleta = usuario.bonificacion ? 
        (precioMenu * cantidadMenus) : 0;

      return {
        'Nombre': usuario.nombre,
        'Fecha': usuario.fecha ? formatearFecha(usuario.fecha) : '',
        'Lunes': usuario.lunesData === null ? 'NO COMPLETÓ' : (formatearOpcion(usuario.lunesData) === 'NO PIDIÓ' ? '' : formatearOpcion(usuario.lunesData)),
        'Martes': usuario.martesData === null ? 'NO COMPLETÓ' : (formatearOpcion(usuario.martesData) === 'NO PIDIÓ' ? '' : formatearOpcion(usuario.martesData)),
        'Miércoles': usuario.miercolesData === null ? 'NO COMPLETÓ' : (formatearOpcion(usuario.miercolesData) === 'NO PIDIÓ' ? '' : formatearOpcion(usuario.miercolesData)),
        'Jueves': usuario.juevesData === null ? 'NO COMPLETÓ' : (formatearOpcion(usuario.juevesData) === 'NO PIDIÓ' ? '' : formatearOpcion(usuario.juevesData)),
        'Viernes': usuario.viernesData === null ? 'NO COMPLETÓ' : (formatearOpcion(usuario.viernesData) === 'NO PIDIÓ' ? '' : formatearOpcion(usuario.viernesData)),
        'Cantidad de Pedidos': cantidadMenus,
        'Precio con Bonificaciones': usuario.tienePedido ? (usuario.precioTotal || 0) : 0,
        'Bonificacion Parcial': bonificacionNormal,
        'Bonificacion Completa': bonificacionCompleta
      };
    });

    // Preparar los datos de contadores para Excel
    let datosContadores = [];
    
    // Inicializar contadores de totales
    const totales = { LU: 0, MA: 0, MI: 0, JU: 0, VI: 0, TOTAL: 0 };
    
    // Mostrar todas las opciones únicas en el resumen, en orden alfabético
    Object.entries(contadores).forEach(([categoria, valores]) => {
      if (categoria !== 'FRUTAS') {
        // Calcular total de la fila
        const totalFila = valores.LU + valores.MA + valores.MI + valores.JU + valores.VI;
        
        // Sumar a los totales
        totales.LU += valores.LU;
        totales.MA += valores.MA;
        totales.MI += valores.MI;
        totales.JU += valores.JU;
        totales.VI += valores.VI;
        totales.TOTAL += totalFila;
        
        datosContadores.push({
          'MENU': categoria,
          'LU': valores.LU,
          'MA': valores.MA,
          'MI': valores.MI,
          'JU': valores.JU,
          'VI': valores.VI,
          'TOTAL': totalFila
        });
      }
    });

    // Ordenar por MENU descendente antes de agregar el total
    datosContadores.sort((a, b) => a.MENU.localeCompare(b.MENU));
    // Agregar fila de totales
    datosContadores.push({
      'MENU': 'TOTAL',
      'LU': totales.LU,
      'MA': totales.MA,
      'MI': totales.MI,
      'JU': totales.JU,
      'VI': totales.VI,
      'TOTAL': totales.TOTAL
    });

    // Preparar datos del resumen de bonificaciones
    const menusCompletamenteBonificados = pedidos.reduce((total, usuario) => {
      if (usuario.bonificacion) {
        return total + diasSemana.reduce((subtotal, dia) => {
          const diaData = usuario[`${dia}Data`];
          return subtotal + (diaData && diaData.pedido && diaData.pedido !== 'no_pedir' ? 1 : 0);
        }, 0);
      }
      return total;
    }, 0);

    const menusBonificacionParcial = pedidos.reduce((total, usuario) => {
      if (!usuario.bonificacion) {
        return total + diasSemana.reduce((subtotal, dia) => {
          const diaData = usuario[`${dia}Data`];
          return subtotal + (diaData && diaData.pedido && diaData.pedido !== 'no_pedir' ? 1 : 0);
        }, 0);
      }
      return total;
    }, 0);

    // Calcular valores totales
    const valorTotalCompletamenteBonificados = menusCompletamenteBonificados * precioMenu;
    const bonificacionNormalTotal = menusBonificacionParcial * bonificacionEmpleadoNormal;
    const totalAbonarBetiJai = (menusCompletamenteBonificados + menusBonificacionParcial) * precioMenu;

    const datosBonificaciones = [
      {
        'Tipo de Bonificación': 'Menús Completamente Bonificados',
        'Cantidad': menusCompletamenteBonificados,
        'Total Bonificaciones': valorTotalCompletamenteBonificados,
        'Total a Abonar Beti Jai': menusCompletamenteBonificados * precioMenu
      },
      {
        'Tipo de Bonificación': 'Menús con Bonificación Parcial',
        'Cantidad': menusBonificacionParcial,
        'Total Bonificaciones': bonificacionNormalTotal,
        'Total a Abonar Beti Jai': menusBonificacionParcial * precioMenu
      },
      {
        'Tipo de Bonificación': 'Total de Menús',
        'Cantidad': menusCompletamenteBonificados + menusBonificacionParcial,
        'Total Bonificaciones': valorTotalCompletamenteBonificados + bonificacionNormalTotal,
        'Total a Abonar Beti Jai': totalAbonarBetiJai
      }
    ];

    // Crear el libro de trabajo y las hojas
    const wb = XLSX.utils.book_new();
    const wsPedidos = XLSX.utils.json_to_sheet(datosPedidos);
    const wsContadores = XLSX.utils.json_to_sheet(datosContadores);
    const wsBonificaciones = XLSX.utils.json_to_sheet(datosBonificaciones);

    // Ajustar el ancho de las columnas
    const wscols = [
      { wch: 30 }, // Nombre/Menú
      { wch: 30 }, // Fecha
      { wch: 30 }, // Lunes
      { wch: 30 }, // Martes
      { wch: 30 }, // Miércoles
      { wch: 30 }, // Jueves
      { wch: 30 }, // Viernes
      { wch: 20 }, // Cantidad de Pedidos
      { wch: 30 }, // Precio con Bonificaciones
      { wch: 30 }, // Bonificacion Parcial
      { wch: 30 }, // Bonificacion Completa
    ];
    wsPedidos['!cols'] = wscols;
    wsContadores['!cols'] = wscols;
    wsBonificaciones['!cols'] = [
      { wch: 40 }, // Tipo de Bonificación
      { wch: 20 }, // Cantidad
      { wch: 30 }, // Total Bonificaciones
      { wch: 30 }  // Total a Abonar Beti Jai
    ];

    // Agregar las hojas al libro
    XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos');
    XLSX.utils.book_append_sheet(wb, wsContadores, 'Resumen');
    XLSX.utils.book_append_sheet(wb, wsBonificaciones, 'Bonificaciones');

    // Guardar el archivo
    const fecha = new Date().toLocaleDateString().replace(/\//g, '-');
    XLSX.writeFile(wb, `Pedidos_${fecha}.xlsx`);
  };

  const handleRowClick = (usuario) => {
    if (!menuData) return;
    setEditingUser(usuario);
    setIsEditingModalOpen(true);
  };

  const handleCloseEditingModal = () => {
    setEditingUser(null);
    setIsEditingModalOpen(false);
  };

  const actualizarPrecioTotal = (usuario) => {
    let total = 0;
    diasSemana.forEach(dia => {
      const diaData = usuario[`${dia}Data`];
      if (diaData && diaData.pedido && diaData.pedido !== 'no_pedir') {
        if (usuario.bonificacion) {
          total += 0; // Si está bonificado, el precio es 0
        } else {
          total += (precioMenu - bonificacionEmpleadoNormal); // Si no está bonificado, es el precio normal menos la bonificación
        }
      }
    });
    return total;
  };

  const handleSaveEdit = async (updatedUser) => {
    try {
      const precioTotal = actualizarPrecioTotal(updatedUser);
      const usuarioActualizado = { ...updatedUser, precioTotal };

      // Buscar el documento de pedido correspondiente al usuario
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef, where('uidUsuario', '==', usuarioActualizado.id), where('tipo', '==', 'actual'));
      const querySnapshot = await getDocs(q);

      const pedidoData = {
        uidUsuario: usuarioActualizado.id,
        lunes: { ...(usuarioActualizado.lunesData || {}), esTardio: usuarioActualizado.lunesData?.esTardio || false },
        martes: { ...(usuarioActualizado.martesData || {}), esTardio: usuarioActualizado.martesData?.esTardio || false },
        miercoles: { ...(usuarioActualizado.miercolesData || {}), esTardio: usuarioActualizado.miercolesData?.esTardio || false },
        jueves: { ...(usuarioActualizado.juevesData || {}), esTardio: usuarioActualizado.juevesData?.esTardio || false },
        viernes: { ...(usuarioActualizado.viernesData || {}), esTardio: usuarioActualizado.viernesData?.esTardio || false },
        precioTotal: precioTotal,
        tipo: 'actual',
        fechaCreacion: new Date()
      };

      if (!querySnapshot.empty) {
        // Si existe el pedido, actualizarlo
        const pedidoDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'pedidos', pedidoDoc.id), pedidoData);
      } else {
        // Si no existe el pedido, crearlo
        await addDoc(pedidosRef, pedidoData);
      }

      handleCloseEditingModal();
      cargarPedidos();
      setModal({
        isOpen: true,
        title: 'Éxito',
        message: 'El pedido ha sido guardado correctamente',
        type: 'success',
        actions: [
          {
            label: 'Aceptar',
            type: 'primary',
            onClick: () => setModal({ isOpen: false, title: '', message: '', type: 'info' })
          }
        ]
      });
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: `Error al guardar los cambios: ${error.message}`,
        type: 'error',
        actions: [
          {
            label: 'Aceptar',
            type: 'primary',
            onClick: () => setModal({ isOpen: false, title: '', message: '', type: 'info' })
          }
        ]
      });
    }
  };

  const handleDeletePedido = async (usuario) => {
    try {
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef, where('uidUsuario', '==', usuario.id), where('tipo', '==', 'actual'));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const pedidoDoc = querySnapshot.docs[0];
        await deleteDoc(doc(db, 'pedidos', pedidoDoc.id));
        handleCloseEditingModal();
        cargarPedidos();
        setModal({
          isOpen: true,
          title: 'Éxito',
          message: 'El pedido ha sido eliminado correctamente',
          type: 'success',
          actions: [
            {
              label: 'Aceptar',
              type: 'primary',
              onClick: () => setModal({ isOpen: false, title: '', message: '', type: 'info' })
            }
          ]
        });
      }
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: `Error al eliminar el pedido: ${error.message}`,
        type: 'error',
        actions: [
          {
            label: 'Aceptar',
            type: 'primary',
            onClick: () => setModal({ isOpen: false, title: '', message: '', type: 'info' })
          }
        ]
      });
    }
  };

  // Filtrar pedidos por nombre
  const pedidosFiltrados = pedidos.filter(usuario =>
    usuario.nombre.toLowerCase().includes(filtroNombre.toLowerCase())
  );

  if (loading || !isPrecioLoaded || !isMenuLoaded || !isPedidosLoaded) {
    return <Spinner />;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!menuData) {
    return (
      <div className="no-menu-message">
        <h2>No hay menú de la semana actual disponible</h2>
        <p>Por favor, carga el menú antes de gestionar o editar pedidos.</p>
      </div>
    );
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
        <h2>Estado de Pedidos {tipo === 'actual' ? 'Semana Actual' : 'Próxima Semana'}</h2>
        <div className="header-buttons">
          <div className="filtro-container">
            <input
              type="text"
              placeholder="Filtrar por nombre..."
              value={filtroNombre}
              onChange={(e) => setFiltroNombre(e.target.value)}
              className="filtro-input"
            />
            {filtroNombre && (
              <button
                onClick={() => setFiltroNombre('')}
                className="limpiar-filtro-btn"
                title="Limpiar filtro"
              >
                ✕
              </button>
            )}
          </div>
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
              <th>Precio Total</th>
            </tr>
          </thead>
          <tbody>
            {pedidosFiltrados.map((usuario) => (
              <tr key={usuario.id} className={usuario.tienePedido ? 'clickable-row' : 'sin-pedido clickable-row'} onClick={() => handleRowClick(usuario)}>
                <td>{usuario.nombre}</td>
                <td>{usuario.fecha ? formatearFecha(usuario.fecha) : ''}</td>
                {diasSemana.map(dia => {
                  const diaData = usuario[`${dia}Data`];
                  return (
                    <td key={dia}>
                      {formatearOpcion(diaData)}
                    </td>
                  );
                })}
                <td>${usuario.tienePedido ? (usuario.precioTotal || 0).toLocaleString() : '0'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isEditingModalOpen && editingUser && (
        <Modal
          isOpen={isEditingModalOpen}
          onClose={handleCloseEditingModal}
          title={`Editar Pedido de ${editingUser.nombre}`}
          message={null}
          type="info"
        >
          <form onSubmit={e => { e.preventDefault(); handleSaveEdit(editingUser); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {diasSemana.map((dia, index) => {
              const diaData = editingUser[`${dia}Data`];
              const diaFirestore = diasSemanaFirestore[index];
              return (
                <div key={dia} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column' }}>
                    {diaFirestore}:
                    {menuData?.dias?.[dia]?.esFeriado ? (
                      <div style={{ color: '#b91c1c', fontWeight: 'bold', margin: '0.5rem 0' }}>
                        FERIADO - No hay servicio de comida este día
                      </div>
                    ) : (
                      <select
                        name={dia}
                        value={diaData ? diaData.pedido : 'no_pedir'}
                        onChange={(e) => {
                          const newDiaData = { ...diaData, pedido: e.target.value };
                          const updatedUser = { ...editingUser, [`${dia}Data`]: newDiaData };
                          const nuevoPrecioTotal = actualizarPrecioTotal(updatedUser);
                          setEditingUser({ ...updatedUser, precioTotal: nuevoPrecioTotal });
                        }}
                        className="select-edit"
                      >
                        {opcionesMenuConfig?.[diaFirestore]
                          ?.slice()
                          ?.sort((a, b) => {
                            // "NO PEDIR" siempre va primero (cualquier variación)
                            const aIsNoPedir = a.trim().toUpperCase().includes('NO PEDIR');
                            const bIsNoPedir = b.trim().toUpperCase().includes('NO PEDIR');
                            
                            if (aIsNoPedir && !bIsNoPedir) return -1;
                            if (!aIsNoPedir && bIsNoPedir) return 1;
                            
                            // El resto se ordena alfabéticamente
                            return a.trim()
                              .normalize('NFD')
                              .replace(/[\u0300-\u036f]/g, '')
                              .toLowerCase()
                              .localeCompare(
                                b.trim()
                                  .normalize('NFD')
                                  .replace(/[\u0300-\u036f]/g, '')
                                  .toLowerCase()
                              );
                          })
                          ?.map((opcion, idx) => (
                            <option 
                              key={idx} 
                              value={opcion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_')}
                            >
                              {opcion}
                            </option>
                          ))}
                      </select>
                    )}
                  </label>
                  {!menuData?.dias?.[dia]?.esFeriado && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={diaData?.esTardio || false}
                        onChange={(e) => {
                          const newDiaData = { ...diaData, esTardio: e.target.checked };
                          setEditingUser({ ...editingUser, [`${dia}Data`]: newDiaData });
                        }}
                        style={{ width: '1.2rem', height: '1.2rem' }}
                      />
                      <span style={{ color: '#666', fontSize: '0.9rem' }}>Pedido tarde</span>
                    </label>
                  )}
                </div>
              );
            })}
            <div style={{ fontWeight: 'bold', marginTop: '1rem', color: '#FFA000', fontSize: '1.1rem' }}>
              Precio total: ${editingUser.precioTotal || 0}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="submit"
                className="modal-button primary"
                style={{
                  background: '#FFA000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.7rem 1.5rem',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  flex: 1,
                  transition: 'background 0.2s'
                }}
              >
                Guardar cambios
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: 'Confirmar eliminación',
                    message: '¿Está seguro que desea eliminar este pedido? Esta acción no se puede deshacer.',
                    type: 'warning',
                    actions: [
                      {
                        label: 'Cancelar',
                        type: 'secondary',
                        onClick: () => setConfirmModal({ isOpen: false, title: '', message: '', type: 'info', actions: [] })
                      },
                      {
                        label: 'Eliminar',
                        type: 'danger',
                        onClick: () => {
                          setConfirmModal({ isOpen: false, title: '', message: '', type: 'info', actions: [] });
                          handleDeletePedido(editingUser);
                        }
                      }
                    ]
                  });
                }}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.7rem 1.5rem',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  flex: 1,
                  transition: 'background 0.2s'
                }}
              >
                Eliminar pedido
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={handleCloseEditingModal}
                style={{
                  background: '#6b7280',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.7rem 2rem',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                Cerrar
              </button>
            </div>
          </form>
        </Modal>
      )}

      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, title: '', message: '', type: 'info', actions: [] })}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        actions={confirmModal.actions}
      />

      {/* Tabla de Resumen */}
      <div className="resumen-container">
        <h3>Resumen de Pedidos</h3>
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
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filas = Object.entries(contadores)
                  .filter(([categoria]) => categoria !== 'FRUTAS')
                  .map(([categoria, valores]) => ({
                    MENU: categoria,
                    LU: valores.LU,
                    MA: valores.MA,
                    MI: valores.MI,
                    JU: valores.JU,
                    VI: valores.VI,
                    TOTAL: valores.LU + valores.MA + valores.MI + valores.JU + valores.VI
                  }));
                // Separar la fila TOTAL si existe
                const filaTotal = filas.find(f => f.MENU && f.MENU.trim().toUpperCase() === 'TOTAL');
                const filasSinTotal = filas.filter(f => f.MENU && f.MENU.trim().toUpperCase() !== 'TOTAL');
                // Ordenar A-Z robusto
                filasSinTotal.sort((a, b) =>
                  a.MENU.trim().normalize('NFD').replace(/\u0300-\u036f/g, '').toLowerCase()
                    .localeCompare(
                      b.MENU.trim().normalize('NFD').replace(/\u0300-\u036f/g, '').toLowerCase()
                    )
                );
                if (filaTotal) filasSinTotal.push(filaTotal);
                return filasSinTotal.map(fila => (
                  <tr key={fila.MENU}>
                    <td>{fila.MENU}</td>
                    <td>{fila.LU}</td>
                    <td>{fila.MA}</td>
                    <td>{fila.MI}</td>
                    <td>{fila.JU}</td>
                    <td>{fila.VI}</td>
                    <td>{fila.TOTAL}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>

        {/* Nuevo resumen de bonificaciones */}
        <div className="resumen-bonificaciones" style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '1rem', color: '#333' }}>Resumen de Bonificaciones</h3>
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fff', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h4 style={{ color: '#666', marginBottom: '0.5rem' }}>Menús Completamente Bonificados</h4>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FFA000' }}>
                {pedidos.reduce((total, usuario) => {
                  if (usuario.bonificacion) {
                    return total + diasSemana.reduce((subtotal, dia) => {
                      const diaData = usuario[`${dia}Data`];
                      return subtotal + (diaData && diaData.pedido && diaData.pedido !== 'no_pedir' ? 1 : 0);
                    }, 0);
                  }
                  return total;
                }, 0)}
              </p>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#fff', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h4 style={{ color: '#666', marginBottom: '0.5rem' }}>Menús con Bonificación Parcial</h4>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FFA000' }}>
                {pedidos.reduce((total, usuario) => {
                  if (!usuario.bonificacion) {
                    return total + diasSemana.reduce((subtotal, dia) => {
                      const diaData = usuario[`${dia}Data`];
                      return subtotal + (diaData && diaData.pedido && diaData.pedido !== 'no_pedir' ? 1 : 0);
                    }, 0);
                  }
                  return total;
                }, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerPedidos; 