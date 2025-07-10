import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, updateDoc, getDoc, deleteDoc, addDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import Modal from './Modal';
import Spinner from './Spinner';
import './VerPedidos.css';

const VerPedidosProximaSemana = () => {
  const [pedidos, setPedidos] = useState([]);
  const [contadores, setContadores] = useState({ conteo: {}, todasLasOpciones: new Set() });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [formEdit, setFormEdit] = useState({ lunes: '', martes: '', miercoles: '', jueves: '', viernes: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [menuData, setMenuData] = useState(null);
  const [precioPorDia, setPrecioPorDia] = useState(2000);
  const [opcionesMenuConfig, setOpcionesMenuConfig] = useState(null);
  const [filtroNombre, setFiltroNombre] = useState('');

  const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
  const diasSemanaFirestore = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

  useEffect(() => {
    cargarPedidos();
    cargarMenu();
    cargarPrecio();
    cargarOpcionesMenu();

    const handlePedidosActualizados = () => {
      cargarPedidos();
    };

    window.addEventListener('pedidosActualizados', handlePedidosActualizados);

    return () => {
      window.removeEventListener('pedidosActualizados', handlePedidosActualizados);
    };
  }, []);

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

      // Obtener el precio del menú y la bonificación
      const precioRef = doc(db, 'config', 'precioMenu');
      const precioSnap = await getDoc(precioRef);
      const precioMenu = precioSnap.exists() ? precioSnap.data().precio : 0;
      const bonificacionEmpleadoNormal = precioSnap.exists() ? precioSnap.data().bonificacionEmpleadoNormal : 0;

      // Obtener los pedidos de próxima semana
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef, where('tipo', '==', 'proxima'));
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
              if (diaData && diaData.pedido && !esNoPedir(diaData.pedido)) {
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
        });

      // Ordenar alfabéticamente por nombre
      usuariosConPedidos.sort((a, b) => a.nombre.localeCompare(b.nombre));

      setPedidos(usuariosConPedidos);
    } catch (error) {
      setError(`Error al cargar la información: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

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

  const cargarPrecio = async () => {
    try {
      const precioRef = doc(db, 'config', 'precioMenu');
      const precioSnap = await getDoc(precioRef);
      
      if (precioSnap.exists()) {
        setPrecioPorDia(precioSnap.data().precio);
      }
    } catch (error) {
      console.error('Error al cargar el precio:', error);
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
      console.error('Error al cargar opciones de menú:', error);
    }
  };

  const calcularContadores = (pedidosData) => {
    // Crear un objeto dinámico para los contadores basado en los labels completos de Firestore
    const conteo = {};

    // Crear un Map para todas las opciones únicas de todos los días (normalizadas)
    const labelsUnicos = new Map();
    // Mapeo value->label por día
    const valueToLabelPorDia = {};
    diasSemana.forEach((dia, index) => {
      const diaFirestore = diasSemanaFirestore[index];
      valueToLabelPorDia[dia] = {};
      if (opcionesMenuConfig?.[diaFirestore]) {
        opcionesMenuConfig[diaFirestore].forEach(label => {
          if (label.trim().toUpperCase() === 'NO PEDIR COMIDA ESTE DÍA') return; // Filtrar
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
    // Inicializar el conteo para todas las opciones únicas
    Array.from(labelsUnicos.values()).forEach(label => {
      if (!conteo[label]) {
        conteo[label] = { LU: 0, MA: 0, MI: 0, JU: 0, VI: 0 };
      }
    });

    // Contar los pedidos exactos por label y día
    pedidosData.forEach(usuario => {
      diasSemana.forEach((dia, index) => {
        const diaData = usuario[`${dia}Data`];
        if (!diaData || diaData.esTardio) return;
        const opcion = diaData.pedido;
        if (opcion && !esNoPedir(opcion)) {
          // Buscar el label correspondiente a este value
          const label = valueToLabelPorDia[dia][opcion];
          if (label && conteo[label]) {
            const diaKey = Object.keys(conteo[label])[index];
            conteo[label][diaKey]++;
          }
        }
      });
    });
    return { conteo, todasLasOpciones: labelsUnicos };
  };

  useEffect(() => {
    if (pedidos.length > 0) {
      const resultado = calcularContadores(pedidos);
      setContadores(resultado);
    }
  }, [pedidos]);

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

  const esNoPedir = (valor) => {
    if (!valor) return true;
    if (valor === 'no_pedir') return true;
    if (typeof valor === 'string' && valor.trim().toUpperCase().normalize('NFD').replace(/\u0300-\u036f/g, '') === 'NO PEDIR COMIDA ESTE DIA') return true;
    return false;
  };

  const formatearOpcion = (opcion) => {
    if (!opcion) return 'NO COMPLETÓ';
    if (typeof opcion === 'object') {
      if (esNoPedir(opcion.pedido)) return 'NO PIDIÓ';
      if (opcion.esTardio) return 'Pedido Tarde';
      const opcionEncontrada = opcionesMenuCompleto.find(opt => opt.value === opcion.pedido);
      return opcionEncontrada ? opcionEncontrada.label : opcion.pedido.toUpperCase().replace(/_/g, ' ');
    }
    if (esNoPedir(opcion)) return 'NO PIDIÓ';
    const opcionEncontrada = opcionesMenuCompleto.find(opt => opt.value === opcion);
    return opcionEncontrada ? opcionEncontrada.label : opcion.toUpperCase().replace(/_/g, ' ');
  };

  const opcionesMenu = [
    { value: "no_pedir", label: "NO PEDIR COMIDA ESTE DÍA" },
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
    { value: "no_pedir", label: "NO PEDIR COMIDA ESTE DÍA" },
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

  const exportarAExcel = () => {
    // Preparar los datos de pedidos para Excel
    const datosPedidos = pedidos.map(usuario => ({
      'Nombre': usuario.nombre,
      'Fecha': usuario.fecha ? formatearFecha(usuario.fecha) : '',
      'Lunes': usuario.lunesData === null ? 'NO COMPLETÓ' : (formatearOpcion(usuario.lunesData) === 'NO PIDIÓ' ? '' : formatearOpcion(usuario.lunesData)),
      'Martes': usuario.martesData === null ? 'NO COMPLETÓ' : (formatearOpcion(usuario.martesData) === 'NO PIDIÓ' ? '' : formatearOpcion(usuario.martesData)),
      'Miércoles': usuario.miercolesData === null ? 'NO COMPLETÓ' : (formatearOpcion(usuario.miercolesData) === 'NO PIDIÓ' ? '' : formatearOpcion(usuario.miercolesData)),
      'Jueves': usuario.juevesData === null ? 'NO COMPLETÓ' : (formatearOpcion(usuario.juevesData) === 'NO PIDIÓ' ? '' : formatearOpcion(usuario.juevesData)),
      'Viernes': usuario.viernesData === null ? 'NO COMPLETÓ' : (formatearOpcion(usuario.viernesData) === 'NO PIDIÓ' ? '' : formatearOpcion(usuario.viernesData)),
      'Precio Total': usuario.tienePedido ? (usuario.precioTotal || 0) : 0
    }));

    // Preparar los datos de contadores para Excel
    let datosContadores = [];
    
    // Mostrar todas las opciones únicas de Firestore en el resumen, en orden alfabético
    const opcionesResumen = Array.from(contadores?.todasLasOpciones?.values() || []).sort((a, b) => a.localeCompare(b));
    
    // Inicializar contadores de totales
    const totales = { LU: 0, MA: 0, MI: 0, JU: 0, VI: 0, TOTAL: 0 };
    
    opcionesResumen.forEach(label => {
      const fila = (contadores?.conteo && contadores.conteo[label]) || { LU: 0, MA: 0, MI: 0, JU: 0, VI: 0 };
      // Calcular total de la fila
      const totalFila = fila.LU + fila.MA + fila.MI + fila.JU + fila.VI;
      
      // Sumar a los totales
      totales.LU += fila.LU;
      totales.MA += fila.MA;
      totales.MI += fila.MI;
      totales.JU += fila.JU;
      totales.VI += fila.VI;
      totales.TOTAL += totalFila;
      
      datosContadores.push({
        'MENU': label,
        'LU': fila.LU,
        'MA': fila.MA,
        'MI': fila.MI,
        'JU': fila.JU,
        'VI': fila.VI,
        'TOTAL': totalFila
      });
    });

    // Ordenar por MENU descendente (Z-A) y dejar TOTAL al final
    const filaTotalExcel = datosContadores.find(f => f.MENU && f.MENU.trim().toUpperCase() === 'TOTAL');
    let datosContadoresSinTotal = datosContadores.filter(f => f.MENU && f.MENU.trim().toUpperCase() !== 'TOTAL');
    datosContadoresSinTotal = datosContadoresSinTotal.sort((a, b) =>
      a.MENU.trim().normalize('NFD').replace(/\u0300-\u036f/g, '').toLowerCase()
        .localeCompare(
          b.MENU.trim().normalize('NFD').replace(/\u0300-\u036f/g, '').toLowerCase()
        )
    );
    if (filaTotalExcel) datosContadoresSinTotal.push(filaTotalExcel);

    // Crear el libro de trabajo y las hojas
    const wb = XLSX.utils.book_new();
    const wsPedidos = XLSX.utils.json_to_sheet(datosPedidos);
    const wsContadores = XLSX.utils.json_to_sheet(datosContadoresSinTotal);

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
    wsContadores['!cols'] = wscols;

    // Agregar las hojas al libro
    XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos Próxima Semana');
    XLSX.utils.book_append_sheet(wb, wsContadores, 'Resumen');
    

    // Guardar el archivo
    const fecha = new Date().toLocaleDateString().replace(/\//g, '-');
    XLSX.writeFile(wb, `Pedidos_Proxima_Semana_${fecha}.xlsx`);
  };

  // Calcular usuarios con al menos un día NO tardío
  const filasNormales = pedidos.filter(usuario =>
    diasSemana.some(dia => {
      const diaData = usuario[`${dia}Data`];
      return diaData && (!diaData.esTardio || diaData.esTardio === false);
    })
  );

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
      const q = query(pedidosRef, where('uidUsuario', '==', usuarioEditando.id), where('tipo', '==', 'proxima'));
      const querySnapshot = await getDocs(q);

      // Calcular nuevo precio total
      const diasPedidos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].filter(
        dia => !esNoPedir(formEdit[dia])
      ).length;
      const nuevoPrecioTotal = diasPedidos * precioPorDia;

      // Preparar los datos del pedido
      const pedidoData = {
        uidUsuario: usuarioEditando.id,
        tipo: 'proxima',
        fechaCreacion: new Date(),
        precioTotal: nuevoPrecioTotal,
        lunes: { pedido: formEdit.lunes, esTardio: usuarioEditando.lunesData?.esTardio || false },
        martes: { pedido: formEdit.martes, esTardio: usuarioEditando.martesData?.esTardio || false },
        miercoles: { pedido: formEdit.miercoles, esTardio: usuarioEditando.miercolesData?.esTardio || false },
        jueves: { pedido: formEdit.jueves, esTardio: usuarioEditando.juevesData?.esTardio || false },
        viernes: { pedido: formEdit.viernes, esTardio: usuarioEditando.viernesData?.esTardio || false }
      };

      if (!querySnapshot.empty) {
        // Si existe un pedido, actualizarlo
        const pedidoDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'pedidos', pedidoDoc.id), pedidoData);
        setModal({ isOpen: true, title: 'Éxito', message: 'Pedido actualizado correctamente.', type: 'success' });
      } else {
        // Si no existe un pedido, crear uno nuevo
        await addDoc(collection(db, 'pedidos'), pedidoData);
        setModal({ isOpen: true, title: 'Éxito', message: 'Nuevo pedido creado correctamente.', type: 'success' });
      }

      setUsuarioEditando(null);
      cargarPedidos();
    } catch (error) {
      setModal({ isOpen: true, title: 'Error', message: 'Error al guardar los cambios: ' + error.message, type: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  const confirmarEliminarPedido = () => {
    // Cerrar temporalmente el modal de edición
    setUsuarioEditando(null);
    
    // Mostrar el modal de confirmación
    setModal({
      isOpen: true,
      title: 'Confirmar eliminación',
      message: '¿Está seguro que desea eliminar este pedido? Esta acción no se puede deshacer.',
      type: 'warning',
      actions: [
        {
          label: 'Cancelar',
          type: 'secondary',
          onClick: () => {
            setModal({ isOpen: false, title: '', message: '', type: 'info' });
            // Volver a abrir el modal de edición
            setUsuarioEditando(usuarioEditando);
          }
        },
        {
          label: 'Eliminar',
          type: 'danger',
          onClick: async () => {
            setModal({ isOpen: false, title: '', message: '', type: 'info' });
            await handleEliminarPedido();
          }
        }
      ]
    });
  };

  const handleEliminarPedido = async () => {
    if (!usuarioEditando) return;
    setEditLoading(true);
    try {
      // Buscar el pedido de este usuario
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef, where('uidUsuario', '==', usuarioEditando.id), where('tipo', '==', 'proxima'));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const pedidoDoc = querySnapshot.docs[0];
        // Eliminar el pedido
        await deleteDoc(doc(db, 'pedidos', pedidoDoc.id));
        setModal({ isOpen: true, title: 'Éxito', message: 'Pedido eliminado correctamente.', type: 'success' });
        setUsuarioEditando(null);
        cargarPedidos();
      } else {
        setModal({ isOpen: true, title: 'Error', message: 'No se encontró el pedido para eliminar.', type: 'error' });
      }
    } catch (error) {
      setModal({ isOpen: true, title: 'Error', message: 'Error al eliminar el pedido: ' + error.message, type: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  // Filtrar pedidos por nombre
  const pedidosFiltrados = pedidos.filter(usuario =>
    usuario.nombre.toLowerCase().includes(filtroNombre.toLowerCase())
  );

  const spinnerStyle = {
    width: '30px',
    height: '30px',
    border: '3px solid #FFA000',
    borderTop: '3px solid transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginRight: '10px'
  };

  if (loading) {
    return <Spinner style={spinnerStyle} />;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!menuData) {
    return (
      <div className="no-menu-alert" style={{
        background: '#78350f',
        color: '#fff',
        padding: '1.5rem',
        borderRadius: '8px',
        textAlign: 'center',
        marginBottom: '1.5rem'
      }}>
        <h3>⚠️ No hay menú disponible</h3>
        <p>Actualmente no hay menú configurado para la próxima semana.</p>
        <p>Por favor, contacta al administrador para que configure el menú.</p>
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
        <h2>Pedidos Próxima Semana</h2>
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
              <tr key={usuario.id} className={usuario.tienePedido ? '' : 'sin-pedido'} style={{ cursor: 'pointer' }} onClick={() => handleFilaClick(usuario)}>
                <td>{usuario.nombre}</td>
                <td>{usuario.fecha ? formatearFecha(usuario.fecha) : ''}</td>
                {diasSemana.map(dia => {
                  const diaData = usuario[`${dia}Data`];
                  return (
                    <td key={dia}>
                      {(() => {
                        if (!diaData) return 'NO COMPLETÓ';
                        return formatearOpcion(diaData);
                      })()}
                    </td>
                  );
                })}
                <td>${usuario.precioTotal.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                const filas = Object.entries(contadores?.conteo || {})
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
                const filaTotal = filas.find(f => f.MENU.trim().toUpperCase() === 'TOTAL');
                const filasSinTotal = filas.filter(f => f.MENU.trim().toUpperCase() !== 'TOTAL');
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
      </div>

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
            {diasSemana.map((dia, index) => (
              <div key={dia} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column' }}>
                  {diasSemanaFirestore[index]}:
                  {menuData?.dias?.[dia]?.esFeriado ? (
                    <div style={{ color: '#b91c1c', fontWeight: 'bold', margin: '0.5rem 0' }}>
                      FERIADO - No hay servicio de comida este día
                    </div>
                  ) : (
                    <select
                      name={dia}
                      value={formEdit[dia] || 'no_pedir'}
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
                      {opcionesMenuConfig?.[diasSemanaFirestore[index]]?.filter(
                        opcion => opcion.trim().toUpperCase() !== 'NO PEDIR COMIDA ESTE DÍA'
                      ).map((opcion, idx) => (
                        <option key={idx} value={opcion.toLowerCase().replace(/\s+/g, '_')}>
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
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="submit"
                disabled={editLoading}
                style={{
                  flex: 1,
                  background: editLoading ? '#90caf9' : '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.7rem 1.5rem',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: editLoading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                {editLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                onClick={confirmarEliminarPedido}
                disabled={editLoading}
                style={{
                  flex: 1,
                  background: editLoading ? '#fecaca' : '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.7rem 1.5rem',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: editLoading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                {editLoading ? 'Eliminando...' : 'Eliminar pedido'}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setUsuarioEditando(null)}
                disabled={editLoading}
                style={{
                  background: '#6b7280',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.7rem 2rem',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: editLoading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                Cerrar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default VerPedidosProximaSemana; 