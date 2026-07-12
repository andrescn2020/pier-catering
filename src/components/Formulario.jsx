// src/components/Formulario.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, where, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { catalogDb } from '../firebase';
import Modal from './Modal';
import Spinner from './Spinner';
import "./Formulario.css";

const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

// Normaliza texto para comparación flexible: sin tildes, sin puntuación, sin mayúsculas, sin espacios extra
const normalizarTexto = (t) =>
  (t ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')  // quita tildes: acentos
    .replace(/[^a-z0-9\s]/gi, '')                       // quita puntuación y símbolos
    .replace(/\s+/g, ' ');                              // colapsa espacios múltiples

// Busca en el catálogo compartido si un texto de plato tiene imagen asociada
const buscarImagenTooltip = (texto, imagenes) => {
  const imgUrl = Object.entries(imagenes || {}).find(
    ([k]) => normalizarTexto(k) === normalizarTexto(texto)
  )?.[1]?.url;
  if (!imgUrl) return null;
  return (
    <div className="menu-img-tooltip" data-lightbox-url={imgUrl}>
      <img src={imgUrl} alt={texto} onError={e => { e.target.style.display = 'none'; }} />
    </div>
  );
};

// Renderiza un ítem del menú (plato/sandwich/ensalada/postre) con tooltip de imagen si corresponde.
// Se comparte entre los 5 bloques diarios (lunes a viernes) porque su lógica es idéntica.
const renderPlatoItem = (key, value, imagenes) => {
  if (key === 'sandwichMiga' && value?.tipo) {
    const tooltip = buscarImagenTooltip(value.tipo, imagenes);
    return (
      <div key={key} className="sandwich-miga">
        <h4>Sandwich de Miga</h4>
        <div className={`menu-item-desc-wrap${tooltip ? ' has-img-tooltip' : ''}`}>
          <p className="menu-item-desc">{value.tipo} ({value.cantidad} triángulos)</p>
          {tooltip}
        </div>
      </div>
    );
  }
  if (key === 'ensaladas' && value?.ensalada1) {
    const tooltip = buscarImagenTooltip(value.ensalada1, imagenes);
    return (
      <div key={key} className="ensalada">
        <h4>Ensalada</h4>
        <div className={`menu-item-desc-wrap${tooltip ? ' has-img-tooltip' : ''}`}>
          <p className="menu-item-desc">{value.ensalada1}</p>
          {tooltip}
        </div>
      </div>
    );
  }
  if (key === 'postre') {
    const tooltip = buscarImagenTooltip(value, imagenes);
    return (
      <div key={key} className="postre">
        <h4>Postre</h4>
        <div className={`menu-item-desc-wrap${tooltip ? ' has-img-tooltip' : ''}`}>
          <p className="menu-item-desc">{value}</p>
          {tooltip}
        </div>
      </div>
    );
  }
  const tooltip = buscarImagenTooltip(value, imagenes);
  return (
    <div key={key} className="menu-item">
      <h4>{key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}</h4>
      <div className={`menu-item-desc-wrap${tooltip ? ' has-img-tooltip' : ''}`}>
        <p className="menu-item-desc">{value}</p>
        {tooltip}
      </div>
    </div>
  );
};

const Formulario = ({ readOnly = false, tipo = 'actual' }) => {
  const [data, setData] = useState({
    lunes: "no_pedir",
    martes: "no_pedir",
    miercoles: "no_pedir",
    jueves: "no_pedir",
    viernes: "no_pedir"
  });
  const [menuActual, setMenuActual] = useState(null);
  const [menuSemanal, setMenuSemanal] = useState(null);
  const [precioTotal, setPrecioTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [menuData, setMenuData] = useState(null);
  const [hayCambios, setHayCambios] = useState(false);
  const [diasModificados, setDiasModificados] = useState([]);
  const [ultimaModificacion, setUltimaModificacion] = useState(null);
  const [diasTardios, setDiasTardios] = useState({});
  const [opcionesMenuConfig, setOpcionesMenuConfig] = useState(null);
  const [menuStructure, setMenuStructure] = useState(null);
  const auth = getAuth();
  const db = getFirestore();
  const navigate = useNavigate();
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [fechaLimite, setFechaLimite] = useState(null);
  const [fechaInicio, setFechaInicio] = useState(null);
  const [esTardio, setEsTardio] = useState(false);
  const [esMuyTemprano, setEsMuyTemprano] = useState(false);
  const [semanaSeleccionada, setSemanaSeleccionada] = useState('esta');
  const [mensajeTardio, setMensajeTardio] = useState('');
  const [mensajeTemprano, setMensajeTemprano] = useState('');
  const [ahora, setAhora] = useState(new Date());
  const [necesitaRecargar, setNecesitaRecargar] = useState(false);
  const [precioPorDia, setPrecioPorDia] = useState(2000); // Precio por defecto
  const [precioMenu, setPrecioMenu] = useState(2000);
  const [porcentajeBonificacion, setPorcentajeBonificacion] = useState(70);
  const [lightboxImg, setLightboxImg] = useState(null);

  // Calcular día de la semana y semana seleccionada dentro del componente
  const hoy = new Date();
  const diaSemana = hoy.getDay(); // 0 = domingo, 6 = sábado

  // 1. Utilidad para calcular el lunes de la semana de una fecha
  function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    d.setDate(diff);
    d.setHours(0,0,0,0);
    return d;
  }

  // 2. Calcular semana actual y próxima
  const lunesActual = getMonday(hoy);
  const lunesProxima = new Date(lunesActual);
  lunesProxima.setDate(lunesActual.getDate() + 7);

  // 3. Determinar qué semana mostrar según el día y la lógica de negocio
  let semanaSeleccionadaDate = lunesActual;
  let esProximaSemana = false;
  if (diaSemana === 6 || diaSemana === 0) { // Sábado o domingo
    semanaSeleccionadaDate = lunesProxima;
    esProximaSemana = true;
  }
  const semanaSeleccionadaStr = semanaSeleccionadaDate.toISOString().slice(0,10);

  // Utilidad para saber si un día es anterior al actual
  function isPastDay(dia, hoy) {
    const diaSemana = hoy.getDay();
    // Si es fin de semana (sábado o domingo), permitir todos los días
    if (diaSemana === 0 || diaSemana === 6) {
      return false;
    }
    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    const diaActual = dias[diaSemana - 1];
    // Si es lunes y es el día actual, no es un día pasado
    if (dia === 'lunes' && diaSemana === 1) {
      return false;
    }
    return dias.indexOf(dia) < dias.indexOf(diaActual);
  }

  // Utilidad para saber si es el día actual y ya pasó de las 8:30
  function isCurrentDayAndLate(dia, hoy) {
    const diaSemana = hoy.getDay();
    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    const diaActual = dias[diaSemana - 1] || 'lunes';
    if (dia !== diaActual) return false;
    
    // Obtener la hora actual en Argentina
    const horaArgentina = new Date(hoy.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const hora = horaArgentina.getHours();
    const minutos = horaArgentina.getMinutes();
    
    /*console.log('Verificando si es tarde para', dia, ':', {
      horaArgentina: horaArgentina.toLocaleTimeString(),
      hora,
      minutos,
      esTardio: hora > 8 || (hora === 8 && minutos > 30)
    }); */
    
    return hora > 8 || (hora === 8 && minutos > 30);
  }

  // Función para verificar si un día está disponible para pedir
  function isDiaDisponible(dia, ahora) {
    const diaSemana = ahora.getDay();
    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    const diaActual = dias[diaSemana - 1] || 'lunes';
    
    // Obtener la hora actual en Argentina
    const horaArgentina = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const hora = horaArgentina.getHours();
    const minutos = horaArgentina.getMinutes();
    
    /*console.log('Verificando disponibilidad para:', {
      dia,
      diaSemana,
      diaActual,
      horaArgentina: horaArgentina.toLocaleTimeString(),
      hora,
      minutos
    });*/
    
    // Si es fin de semana, todos los días están disponibles
    if (diaSemana === 0 || diaSemana === 6) {
      //console.log('Es fin de semana, todos los días disponibles');
      return true;
    }

    // Si es el día actual, verificar la hora
    if (dia === diaActual) {
      const esDisponible = hora < 8 || (hora === 8 && minutos <= 30);
      
      /*console.log('Es el día actual:', {
        dia,
        hora,
        minutos,
        esDisponible
      });*/
      
      return esDisponible;
    }

    // Si es un día futuro
    const esFuturo = dias.indexOf(dia) > dias.indexOf(diaActual);
    /* console.log('Es día futuro:', {
      dia,
      diaActual,
      esFuturo
    }); */
    
    return esFuturo;
  }

  // Agrega esta función arriba de handleSubmit o cerca del inicio del archivo
  function getSemanaTexto(lunesStr) {
    const lunes = new Date(lunesStr);
    const viernes = new Date(lunesStr);
    viernes.setDate(lunes.getDate() + 4);
    const pad = n => n.toString().padStart(2, '0');
    return `Lunes ${pad(lunes.getDate())} al Viernes ${pad(viernes.getDate())}`;
  }

  // Event delegation para clicks en los tooltips de imagen + tecla Escape para cerrar lightbox
  useEffect(() => {
    const handleClick = (e) => {
      const tooltipEl = e.target.closest('[data-lightbox-url]');
      if (tooltipEl) {
        const url = tooltipEl.dataset.lightboxUrl;
        if (url) {
          tooltipEl.style.setProperty('display', 'none', 'important');
          setLightboxImg(url);
        }
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.menu-img-tooltip').forEach(el => {
          el.style.removeProperty('display');
        });
        setLightboxImg(null);
      }
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        // Cargar estructura del menú desde Firestore
        const structureRef = doc(db, 'config', 'menuStructure');
        const structureSnap = await getDoc(structureRef);
        if (structureSnap.exists()) {
          const structure = structureSnap.data();
          // console.log('Estructura del menú cargada:', structure);
          setMenuStructure(structure);
        }

        // Cargar opciones de menú desde Firestore
        const opcionesRef = doc(db, 'config', 'opcionesMenu');
        const opcionesSnap = await getDoc(opcionesRef);
        if (opcionesSnap.exists()) {
          const opcionesData = opcionesSnap.data();
          // console.log('Opciones cargadas desde Firestore:', opcionesData);
          setOpcionesMenuConfig(opcionesData);
        }

        // Consultar fechas de configuración
        const ref = doc(db, 'config', 'fechasLimite');
        const snap = await getDoc(ref);
        let fechaLimitePedido = null;
        let fechaInicioPedido = null;
        
        if (snap.exists()) {
          const data = snap.data();
          // console.log('Datos de fechas desde Firestore:', data);
          
          // Procesar fecha límite
          fechaLimitePedido = data.proximaSemana?.toDate ? data.proximaSemana.toDate() : new Date(data.proximaSemana);
          // console.log('Fecha límite procesada:', fechaLimitePedido);
          
          // Procesar fecha de inicio
          fechaInicioPedido = data.inicioPedidos?.toDate ? data.inicioPedidos.toDate() : new Date(data.inicioPedidos);
          // console.log('Fecha de inicio procesada:', fechaInicioPedido);
          
          setFechaLimite(fechaLimitePedido);
          setFechaInicio(fechaInicioPedido);
          
          const ahora = new Date();
          // console.log('Fecha actual:', ahora);
          // console.log('¿Estamos dentro del rango?', {
          // console.log('Estado de fechas:', {
          // console.log('No se encontraron fechas en la configuración');
          
          const esTardioActual = fechaLimitePedido && ahora > fechaLimitePedido;
          const esMuyTempranoActual = fechaInicioPedido && ahora < fechaInicioPedido;
          
          // console.log('Estado de fechas:', {
          // console.log('esTardio:', esTardioActual);
          // console.log('esMuyTemprano:', esMuyTempranoActual);
          // console.log('ahora:', ahora);
          // console.log('fechaInicio:', fechaInicioPedido);
          // console.log('fechaLimite:', fechaLimitePedido);
          
          setEsTardio(esTardioActual);
          setEsMuyTemprano(esMuyTempranoActual);
          
          if (esMuyTempranoActual) {
            setMensajeTemprano(`Los pedidos estarán disponibles a partir del ${fechaInicioPedido.toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}`);
          }
        } else {
          // console.log('No se encontraron fechas en la configuración');
        }

        // Lógica ultra-tardía mejorada
        if (fechaLimitePedido && new Date() > fechaLimitePedido) {
          if (tipo === 'actual') {
            const diaSemana = ahora.getDay();
            // Obtener la hora actual en Argentina
            const horaArgentina = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
            const hora = horaArgentina.getHours();
            const minutos = horaArgentina.getMinutes();
            const antesDe830 = hora < 8 || (hora === 8 && minutos <= 30);

            const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
            const diaActual = diasSemana[diaSemana];

            const diasDisponibles = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].filter(dia => {
              const indiceDia = diasSemana.indexOf(dia);
              if (dia === diaActual) {
                return antesDe830;
              }
              return indiceDia > diaSemana;
            });
            // console.log('Días disponibles calculados:', diasDisponibles);

          } 
          setSemanaSeleccionada('proxima');
          setMensajeTardio('Puedes realizar pedidos tardes para la próxima semana.');
          setEsTardio(true);
          setEsMuyTemprano(false);
        } else {
          // console.log('No es pedido tardío, configurando días disponibles');
          // Habilitar días según el tipo y el día actual
          if (tipo === 'proxima') {
            
          } else {
            const diaSemana = ahora.getDay();
            // Obtener la hora actual en Argentina
            const horaArgentina = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
            const hora = horaArgentina.getHours();
            const minutos = horaArgentina.getMinutes();
            const antesDe830 = hora < 8 || (hora === 8 && minutos <= 30);

            const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
            const diaActual = diasSemana[diaSemana];

            const diasDisponibles = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].filter(dia => {
              const indiceDia = diasSemana.indexOf(dia);
              if (dia === diaActual) {
                return antesDe830;
              }
              return indiceDia > diaSemana;
            });


          }
          setEsTardio(false);
          setEsMuyTemprano(false);
        }

        // Si es modo solo lectura, no necesitamos cargar datos del usuario
        if (!readOnly) {
          const user = auth.currentUser;
          if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              setUserData(userDoc.data());
            }
          }
        }

        // Cargar el menú semanal según el tipo
        const menuRef = doc(db, 'menus', tipo === 'actual' ? 'menuActual' : 'menuProxima');
        const menuDoc = await getDoc(menuRef);
        
        if (menuDoc.exists()) {
          const menuData = menuDoc.data();
          // console.log("Menú cargado:", menuData);

          // Cargar imágenes de platos desde el catálogo central (compartido entre clientes)
          let imgsLocales = {};
          try {
            const imagenesSnap = await getDoc(doc(catalogDb, 'config', 'textoImagenes'));
            if (imagenesSnap.exists()) imgsLocales = imagenesSnap.data();
          } catch (imgErr) {
            console.warn('No se pudo cargar el catálogo de imágenes:', imgErr.message);
          }

          const menuFormateado = {
            LUNES: menuData.dias.lunes?.esFeriado ? (
              <div className="menu-opcion-feriado">
                FERIADO - No hay servicio de comida este día
              </div>
            ) : (
              <div className="menu-items">
                {Object.entries(menuData.dias.lunes || {})
                  .filter(([key]) => key !== 'esFeriado')
                  .sort(([keyA], [keyB]) => {
                    // Convertir las claves a un formato comparable
                    const formatKey = (key) => {
                      if (key === 'sandwichMiga') return 'sandwich de miga';
                      if (key === 'ensaladas') return 'ensalada';
                      return key;
                    };
                    return formatKey(keyA).localeCompare(formatKey(keyB));
                  })
                  .map(([key, value]) => renderPlatoItem(key, value, imgsLocales))}
              </div>
            ),
            MARTES: menuData.dias.martes?.esFeriado ? (
              <div className="menu-opcion-feriado">
                FERIADO - No hay servicio de comida este día
              </div>
            ) : (
              <div className="menu-items">
                {Object.entries(menuData.dias.martes || {})
                  .filter(([key]) => key !== 'esFeriado')
                  .sort(([keyA], [keyB]) => {
                    // Convertir las claves a un formato comparable
                    const formatKey = (key) => {
                      if (key === 'sandwichMiga') return 'sandwich de miga';
                      if (key === 'ensaladas') return 'ensalada';
                      return key;
                    };
                    return formatKey(keyA).localeCompare(formatKey(keyB));
                  })
                  .map(([key, value]) => renderPlatoItem(key, value, imgsLocales))}
              </div>
            ),
            MIERCOLES: menuData.dias.miercoles?.esFeriado ? (
              <div className="menu-opcion-feriado">
                FERIADO - No hay servicio de comida este día
              </div>
            ) : (
              <div className="menu-items">
                {Object.entries(menuData.dias.miercoles || {})
                  .filter(([key]) => key !== 'esFeriado')
                  .sort(([keyA], [keyB]) => {
                    // Convertir las claves a un formato comparable
                    const formatKey = (key) => {
                      if (key === 'sandwichMiga') return 'sandwich de miga';
                      if (key === 'ensaladas') return 'ensalada';
                      return key;
                    };
                    return formatKey(keyA).localeCompare(formatKey(keyB));
                  })
                  .map(([key, value]) => renderPlatoItem(key, value, imgsLocales))}
              </div>
            ),
            JUEVES: menuData.dias.jueves?.esFeriado ? (
              <div className="menu-opcion-feriado">
                FERIADO - No hay servicio de comida este día
              </div>
            ) : (
              <div className="menu-items">
                {Object.entries(menuData.dias.jueves || {})
                  .filter(([key]) => key !== 'esFeriado')
                  .sort(([keyA], [keyB]) => {
                    // Convertir las claves a un formato comparable
                    const formatKey = (key) => {
                      if (key === 'sandwichMiga') return 'sandwich de miga';
                      if (key === 'ensaladas') return 'ensalada';
                      return key;
                    };
                    return formatKey(keyA).localeCompare(formatKey(keyB));
                  })
                  .map(([key, value]) => renderPlatoItem(key, value, imgsLocales))}
              </div>
            ),
            VIERNES: menuData.dias.viernes?.esFeriado ? (
              <div className="menu-opcion-feriado">
                FERIADO - No hay servicio de comida este día
              </div>
            ) : (
              <div className="menu-items">
                {Object.entries(menuData.dias.viernes || {})
                  .filter(([key]) => key !== 'esFeriado')
                  .sort(([keyA], [keyB]) => {
                    // Convertir las claves a un formato comparable
                    const formatKey = (key) => {
                      if (key === 'sandwichMiga') return 'sandwich de miga';
                      if (key === 'ensaladas') return 'ensalada';
                      return key;
                    };
                    return formatKey(keyA).localeCompare(formatKey(keyB));
                  })
                  .map(([key, value]) => renderPlatoItem(key, value, imgsLocales))}
              </div>
            )
          };
          
          // console.log("Menú formateado:", menuFormateado);
          setMenuSemanal(menuFormateado);
          setMenuData(menuData);
          setHayCambios(menuData.hayCambios || false);
          setDiasModificados(menuData.diasModificados || []);
          setUltimaModificacion(menuData.ultimaModificacion);
        } else {
          // console.log("No se encontró ningún menú");
          setMenuSemanal(null);
        }

        // Cargar el pedido del usuario si está autenticado
        if (!readOnly && auth.currentUser) {
          let pedidos = [];
          try {
            // Buscar pedido por semana seleccionada
            const pedidosRef = collection(db, "pedidos");
            const qPedidos = query(
              pedidosRef,
              where('tipo', '==', tipo),
              where('uidUsuario', '==', auth.currentUser.uid)
            );
            const querySnapshot = await getDocs(qPedidos);
            const todosPedidos = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));

            pedidos = todosPedidos;

            if (pedidos.length > 0) {
              const pedidoMasReciente = pedidos.sort((a, b) => {
                const fechaA = a.fechaCreacion ? new Date(a.fechaCreacion) : new Date(0);
                const fechaB = b.fechaCreacion ? new Date(b.fechaCreacion) : new Date(0);
                return fechaB - fechaA;
              })[0];

              setMenuActual(pedidoMasReciente);
              setData({
                lunes: pedidoMasReciente.lunes?.pedido || "",
                martes: pedidoMasReciente.martes?.pedido || "",
                miercoles: pedidoMasReciente.miercoles?.pedido || "",
                jueves: pedidoMasReciente.jueves?.pedido || "",
                viernes: pedidoMasReciente.viernes?.pedido || ""
              });
            }
          } catch (error) {
            setError('Error al cargar los pedidos: ' + error.message);
          }
        }

        setDataLoaded(true);
      } catch (error) {
        console.error('Error al cargar datos:', error);
        setError("Error al cargar los datos");
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [auth, db, readOnly, tipo]);

  useEffect(() => {
    // Calcular el precio total cuando cambian los datos
    const diasSeleccionados = Object.entries(data).filter(([dia, valor]) => {
      // Solo contar días que tengan un valor y no sean "no_pedir"
      return valor && valor !== "" && valor !== "no_pedir";
    }).length;
    
    setPrecioTotal(diasSeleccionados * precioPorDia);
  }, [data, precioPorDia]);

  useEffect(() => {
    // Cuando se carga el menú, establecer automáticamente "no_pedir" para los días feriados
    if (menuData) {
      setData(prevData => {
        const newData = {
          ...prevData,
          lunes: menuData.dias.lunes.esFeriado ? "no_pedir" : prevData.lunes,
          martes: menuData.dias.martes.esFeriado ? "no_pedir" : prevData.martes,
          miercoles: menuData.dias.miercoles.esFeriado ? "no_pedir" : prevData.miercoles,
          jueves: menuData.dias.jueves.esFeriado ? "no_pedir" : prevData.jueves,
          viernes: menuData.dias.viernes.esFeriado ? "no_pedir" : prevData.viernes,
        };

        // Si hay un pedido tardío existente, marcar los días como tardíos
        if (menuActual && menuActual.esTardio) {
          const ahora = new Date();
          const diaActual = ahora.getDay();
          const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
          
          const nuevosDiasTardios = {};
          Object.entries(menuActual).forEach(([dia, valor]) => {
            if (valor && valor !== 'no_pedir' && diasSemana.includes(dia)) {
              const indiceDia = diasSemana.indexOf(dia);
              // Si es el día actual o anterior, es tardío
              nuevosDiasTardios[dia] = indiceDia <= diaActual;
            }
          });
          
          setDiasTardios(nuevosDiasTardios);
        }

        return newData;
      });
    }
  }, [menuData, menuActual]);

  // Mover la lógica de días tardíos a un useEffect con dependencias correctas
  useEffect(() => {
    if (tipo === 'actual' && menuActual) {
      const ahora = new Date();
      const diaActual = ahora.getDay();
      const horaActual = ahora.getHours();
      const minutosActual = ahora.getMinutes();
      const antesDe830 = horaActual < 8 || (horaActual === 8 && minutosActual <= 30);

      const nuevosDiasTardios = {};
      Object.entries(data).forEach(([dia, valor]) => {
        if (valor && valor !== 'no_pedir') {
          const indiceDia = diasSemana.indexOf(dia);
          const esDiaNuevo = !menuActual[dia];
          nuevosDiasTardios[dia] = esDiaNuevo && (indiceDia <= diaActual);
        }
      });

      setDiasTardios(nuevosDiasTardios);
    }
  }, [tipo, menuActual, data]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Verificar que todos los días tengan una opción seleccionada, excepto los que no están disponibles
    const diasSinSeleccion = Object.entries(data)
      .filter(([key, value]) => {
        const esFeriado = menuData?.dias[key]?.esFeriado;
        const esDiaPasado = isPastDay(key, ahora);
        const esDiaActualTardio = isCurrentDayAndLate(key, ahora);
        const estaDisponible = !esDiaPasado && !esDiaActualTardio;
        // Considerar "no_pedir" como una selección válida
        return !esFeriado && estaDisponible && key !== 'precioTotal' && !value && value !== "no_pedir";
      })
      .map(([key]) => key);

    if (diasSinSeleccion.length > 0) {
      setModal({
        isOpen: true,
        title: 'Días sin selección',
        message: `Por favor selecciona una opción para los siguientes días: ${diasSinSeleccion.join(', ')}`,
        type: 'warning'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }

      const ahora = new Date();
      const diaSemana = ahora.getDay();
      const esFinDeSemana = diaSemana === 0 || diaSemana === 6;

      // Determinar el tipo correcto según el tipo del formulario
      const tipoPedido = tipo;

      // Crear la nueva estructura de datos para el pedido
      const pedidoData = {
        lunes: {
          pedido: data.lunes,
          esTardio: esFinDeSemana || tipo === 'actual' ? (
            // Si es un pedido nuevo o no existía antes
            (!menuActual?.lunes?.pedido || menuActual.lunes.pedido === "no_pedir") ||
            // O si ya era tardío antes
            menuActual?.lunes?.esTardio
          ) : false
        },
        martes: {
          pedido: data.martes,
          esTardio: esFinDeSemana || tipo === 'actual' ? (
            (!menuActual?.martes?.pedido || menuActual.martes.pedido === "no_pedir") ||
            menuActual?.martes?.esTardio
          ) : false
        },
        miercoles: {
          pedido: data.miercoles,
          esTardio: esFinDeSemana || tipo === 'actual' ? (
            (!menuActual?.miercoles?.pedido || menuActual.miercoles.pedido === "no_pedir") ||
            menuActual?.miercoles?.esTardio
          ) : false
        },
        jueves: {
          pedido: data.jueves,
          esTardio: esFinDeSemana || tipo === 'actual' ? (
            (!menuActual?.jueves?.pedido || menuActual.jueves.pedido === "no_pedir") ||
            menuActual?.jueves?.esTardio
          ) : false
        },
        viernes: {
          pedido: data.viernes,
          esTardio: esFinDeSemana || tipo === 'actual' ? (
            (!menuActual?.viernes?.pedido || menuActual.viernes.pedido === "no_pedir") ||
            menuActual?.viernes?.esTardio
          ) : false
        },
        uidUsuario: user.uid,
        tipo: tipoPedido,
        fechaCreacion: serverTimestamp(),
        precioTotal: precioTotal,
        semana: menuData.semana
      };

      // Buscar si ya existe un pedido para este usuario y semana y tipo
      const pedidosRef = collection(db, "pedidos");
      const qPedidos = query(
        pedidosRef,
        where('tipo', '==', tipoPedido),
        where('uidUsuario', '==', user.uid)
      );
      const querySnapshot = await getDocs(qPedidos);

      let esPedidoNuevo = true;
      let pedidoId = null;

      // Si existe un pedido, actualizarlo
      if (!querySnapshot.empty) {
        const pedidoExistente = querySnapshot.docs[0];
        pedidoId = pedidoExistente.id;
        await setDoc(doc(db, "pedidos", pedidoId), pedidoData);
        esPedidoNuevo = false;
      } else {
        // Si no existe, crear uno nuevo
        const nuevoPedidoRef = await addDoc(pedidosRef, pedidoData);
        pedidoId = nuevoPedidoRef.id;
      }

      // Actualizar el estado menuActual con el nuevo pedido
      const pedidoActualizado = {
        id: pedidoId,
        ...pedidoData,
        fechaCreacion: new Date()
      };
      setMenuActual(pedidoActualizado);

      // Esperar a que el estado se actualice antes de mostrar el modal de éxito
      await new Promise(resolve => setTimeout(resolve, 100));
      setModal({
        isOpen: true,
        title: 'Éxito',
        message: esPedidoNuevo ? 'Pedido guardado correctamente' : 'Pedido actualizado correctamente',
        type: 'success',
        actions: [
          {
            label: 'Cerrar',
            type: 'primary',
            onClick: () => {
              setNecesitaRecargar(true);
              setModal({ isOpen: false, title: '', message: '', type: 'info' });
            }
          }
        ]
      });

      // Limpiar el formulario
      setData({
        lunes: "",
        martes: "",
        miercoles: "",
        jueves: "",
        viernes: ""
      });
      setPrecioTotal(0);
    } catch (e) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al guardar el pedido: ' + e.message,
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVolver = () => {
    // console.log('Intentando volver a /menu');
    navigate('/menu');
  };

  const handleCerrarSesion = async () => {
    // console.log('Intentando cerrar sesión');
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      // console.error('Error al cerrar sesión:', error);
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al cerrar sesión: ' + error.message,
        type: 'error'
      });
    }
  };

  const formatearFecha = (timestamp) => {
    if (!timestamp) return '';
    try {
      // Si es un timestamp de Firestore
      if (timestamp?.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleDateString('es-AR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      // Si es una cadena ISO
      if (typeof timestamp === 'string') {
        return new Date(timestamp).toLocaleDateString('es-AR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
      // Si ya es un objeto Date
      if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString('es-AR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
      return '';
    } catch (error) {
      // console.error('Error al formatear fecha:', error, 'Timestamp:', timestamp);
      return '';
    }
  };

  const opcionesMenu = [
    { value: "no_pedir", label: "NO PEDIR COMIDA ESTE DÍA" },
    { value: "beti_jai_con_postre", label: "BETI JAI C/POSTRE" },
    { value: "beti_jai_con_gelatina", label: "BETI JAI C/GELATINA" },
    { value: "pastas_con_postre", label: "PASTAS C/POSTRE" },
    { value: "pastas_con_gelatina", label: "PASTAS C/GELATINA" },
    { value: "light_con_postre", label: "LIGHT C/POSTRE" },
    { value: "light_con_gelatina", label: "LIGHT C/GELATINA" },
    { value: "clasico_con_postre", label: "CLASICO C/POSTRE" },
    { value: "clasico_con_gelatina", label: "CLASICO C/GELATINA" },
    { value: "ensalada_con_postre", label: "ENSALADA C/POSTRE" },
    { value: "ensalada_con_gelatina", label: "ENSALADA C/GELATINA" },
    { value: "dieta_blanda_con_postre", label: "DIETA BLANDA C/POSTRE" },
    { value: "dieta_blanda_con_gelatina", label: "DIETA BLANDA C/GELATINA" },
    { value: "menu_pbt_2_con_postre", label: "MENU PBT X 2 C/POSTRE" },
    { value: "menu_pbt_2_con_gelatina", label: "MENU PBT X 2 C/GELATINA" },
    { value: "sand_miga_con_postre", label: "SAND DE MIGA C/POSTRE" },
    { value: "sand_miga_con_gelatina", label: "SAND DE MIGA C/GELATINA" },
  ];

  const opcionesMenuCompleto = [
    { value: "no_pedir", label: "NO PEDIR COMIDA ESTE DÍA" },
    { value: "beti_jai_gelatina", label: "BETI JAI C/GELATINA" },
    { value: "beti_jai_manzana", label: "BETI JAI C/MANZANA" },
    { value: "beti_jai_naranja", label: "BETI JAI C/NARANJA" },
    { value: "beti_jai_banana", label: "BETI JAI C/BANANA" },
    { value: "pastas_gelatina", label: "PASTAS C/GELATINA" },
    { value: "pastas_manzana", label: "PASTAS C/MANZANA" },
    { value: "pastas_naranja", label: "PASTAS C/NARANJA" },
    { value: "pastas_banana", label: "PASTAS C/BANANA" },
    { value: "light_gelatina", label: "LIGHT C/GELATINA" },
    { value: "light_manzana", label: "LIGHT C/MANZANA" },
    { value: "light_naranja", label: "LIGHT C/NARANJA" },
    { value: "light_banana", label: "LIGHT C/BANANA" },
    { value: "clasico_gelatina", label: "CLASICO C/GELATINA" },
    { value: "clasico_manzana", label: "CLASICO C/MANZANA" },
    { value: "clasico_naranja", label: "CLASICO C/NARANJA" },
    { value: "clasico_banana", label: "CLASICO C/BANANA" },
    { value: "ensalada_gelatina", label: "ENSALADA C/GELATINA" },
    { value: "ensalada_manzana", label: "ENSALADA C/MANZANA" },
    { value: "ensalada_naranja", label: "ENSALADA C/NARANJA" },
    { value: "ensalada_banana", label: "ENSALADA C/BANANA" },
    { value: "dieta_blanda_gelatina", label: "DIETA BLANDA C/GELATINA" },
    { value: "dieta_blanda_manzana", label: "DIETA BLANDA C/MANZANA" },
    { value: "dieta_blanda_naranja", label: "DIETA BLANDA C/NARANJA" },
    { value: "dieta_blanda_banana", label: "DIETA BLANDA C/BANANA" },
    { value: "menu_pbt_2_gelatina", label: "MENU PBT X 2 C/GELATINA" },
    { value: "menu_pbt_2_manzana", label: "MENU PBT X 2 C/MANZANA" },
    { value: "menu_pbt_2_naranja", label: "MENU PBT X 2 C/NARANJA" },
    { value: "menu_pbt_2_banana", label: "MENU PBT X 2 C/BANANA" },
    { value: "sand_miga_gelatina", label: "SAND DE MIGA C/GELATINA" },
    { value: "sand_miga_manzana", label: "SAND DE MIGA C/MANZANA" },
    { value: "sand_miga_naranja", label: "SAND DE MIGA C/NARANJA" },
    { value: "sand_miga_banana", label: "SAND DE MIGA C/BANANA" }
  ];

  // Actualizar la hora cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setAhora(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Función para recargar los datos
  const recargarDatos = async () => {
    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }

      // Recargar el pedido del usuario
      const pedidosRef = collection(db, "pedidos");
      const qPedidos = query(
        pedidosRef,
        where('tipo', '==', tipo),
        where('uidUsuario', '==', user.uid)
      );
      const querySnapshot = await getDocs(qPedidos);
      const todosPedidos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (todosPedidos.length > 0) {
        const pedidoMasReciente = todosPedidos.sort((a, b) => {
          const fechaA = a.fechaCreacion ? new Date(a.fechaCreacion) : new Date(0);
          const fechaB = b.fechaCreacion ? new Date(b.fechaCreacion) : new Date(0);
          return fechaB - fechaA;
        })[0];

        setMenuActual(pedidoMasReciente);
        setData({
          lunes: pedidoMasReciente.lunes?.pedido || "",
          martes: pedidoMasReciente.martes?.pedido || "",
          miercoles: pedidoMasReciente.miercoles?.pedido || "",
          jueves: pedidoMasReciente.jueves?.pedido || "",
          viernes: pedidoMasReciente.viernes?.pedido || ""
        });
      } else {
        setMenuActual(null);
        setData({
          lunes: "no_pedir",
          martes: "no_pedir",
          miercoles: "no_pedir",
          jueves: "no_pedir",
          viernes: "no_pedir"
        });
      }
    } catch (error) {
      console.error('Error al recargar datos:', error);
      setError('Error al recargar los datos: ' + error.message);
    } finally {
      setIsLoading(false);
      setNecesitaRecargar(false);
    }
  };

  // Efecto para recargar datos cuando sea necesario
  useEffect(() => {
    if (necesitaRecargar) {
      recargarDatos();
    }
  }, [necesitaRecargar]);

  useEffect(() => {
    cargarPrecio();
  }, []);

  const cargarPrecio = async () => {
    try {
      const precioRef = doc(db, 'config', 'precioMenu');
      const precioSnap = await getDoc(precioRef);
      
      if (precioSnap.exists()) {
        const data = precioSnap.data();
        setPrecioMenu(data.precio || 6400);
        setPorcentajeBonificacion(data.porcentajeBonificacion || 70);
        
        // Calcular el precio por día según la bonificación del usuario
        if (userData?.bonificacion) {
          setPrecioPorDia(0); // Si está bonificado, el precio es 0
        } else {
          // Si no está bonificado, aplicar el porcentaje de bonificación
          const porcentaje = parseFloat(data.porcentajeBonificacion) || 70;
          const precioConBonificacion = Math.round(data.precio * (100 - porcentaje) / 100);
          setPrecioPorDia(precioConBonificacion);
        }
      }
    } catch (error) {
      console.error('Error al cargar el precio:', error);
    }
  };

  // Actualizar el precio cuando cambie el estado del usuario
  useEffect(() => {
    if (userData) {
      if (userData.bonificacion) {
        setPrecioPorDia(0);
      } else {
        const porcentaje = parseFloat(porcentajeBonificacion) || 70;
        const precioConBonificacion = Math.round(precioMenu * (100 - porcentaje) / 100);
        setPrecioPorDia(precioConBonificacion);
      }
    }
  }, [userData, precioMenu, porcentajeBonificacion]);

  if (isLoading) {
    return (
      <div className="loading-container">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="formulario-container">
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ isOpen: false, title: '', message: '', type: 'info' })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        actions={modal.actions}
      />
      <div className="formulario-header">
        <div className="header-buttons">
          <button 
            type="button" 
            onClick={handleVolver} 
            className="volver-button"
          >
            Volver
          </button>
          <button 
            type="button" 
            onClick={handleCerrarSesion} 
            className="cerrar-sesion-button"
          >
            Cerrar Sesión
          </button>
        </div>
        <h2 className="formulario-titulo">
          {(() => {
            if ((diaSemana === 6 || diaSemana === 0) && tipo !== 'actual') {
              return 'Menú de la Próxima Semana';
            }
            return `Menú de la ${tipo === 'actual' ? 'Semana Actual' : 'Próxima Semana'}`;
          })()}
        </h2>
      </div>

      {!readOnly && userData && (
        <div className="bienvenida">
          ¡Hola {userData.nombre}!
        </div>
      )}

{ /*     {!readOnly && (
        <div className="advertencia-seleccion" style={{
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
          color: '#92400e'
        }}>
          <h3 style={{margin: '0 0 0.5rem 0'}}>⚠️ Importante</h3>
          <p style={{margin: '0'}}>
            Por favor, selecciona cuidadosamente tus opciones ya que:
          </p>
          <ul style={{textAlign: 'left', margin: '0.5rem 0', paddingLeft: '1rem'}}>
            <li>No se pueden realizar modificaciones una vez cerrada la lista</li>
            <li>Solo se puede agregar un pedido a un día que no se haya seleccionado previamente</li>
            <li>En pedidos tardes, todos los postres serán gelatina, independientemente de la opción seleccionada</li>
          </ul>
        </div>
      )}*/}

      {/* Mostrar el rango de la semana si está disponible */}
      {menuData?.semana && (
        <div className="menu-semana-rango" style={{textAlign:'center', marginBottom:'1rem', color:'#FFA000', fontWeight:'bold'}}>
          Semana: {menuData.semana}
        </div>
      )}

      {/* Cartel informativo de días disponibles */}
      {!readOnly && tipo === 'actual' && !(diaSemana === 6 || diaSemana === 0) && (
        <div className="dias-disponibles-alert" style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
          color: '#0369a1'
        }}>
          <h3 style={{margin: '0 0 0.5rem 0'}}>📅 Días disponibles para pedir</h3>
          <p style={{margin: '0'}}>
            {(() => {
              const ahora = new Date();
              const diaSemana = ahora.getDay();
              // Obtener la hora actual en Argentina
              const horaArgentina = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
              const hora = horaArgentina.getHours();
              const minutos = horaArgentina.getMinutes();
              const antesDe830 = hora < 8 || (hora === 8 && minutos <= 30);
              
              if (diaSemana >= 1 && diaSemana <= 5) {
                const diasDisponibles = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
                  .filter(dia => {
                    const indiceDia = diasSemana.indexOf(dia);
                    if (dia === diasSemana[diaSemana]) {
                      return antesDe830;
                    }
                    return indiceDia > diaSemana;
                  })
                  .map(dia => dia.charAt(0).toUpperCase() + dia.slice(1));
                
                if (diasDisponibles.length === 0) {
                  return 'No hay días disponibles para pedir en este momento.';
                }
                
                return `Puedes pedir para: ${diasDisponibles.join(', ')}`;
              } else {
                return 'No hay días disponibles para pedir en este momento.';
              }
            })()}
          </p>
        </div>
      )}

      {/* Mostrar el menú semanal global */}
      {menuSemanal ? (
        <>
          <div className="menu-semanal">
            {/*tipo !== "actual" && <h2 className="menu-semanal-titulo">Menú Semanal</h2>*/}
            <div className="menu-semanal-grid">
              {Object.entries(menuSemanal).map(([dia, opciones]) => {
                const diaLower = dia.toLowerCase();
                const esFeriado = menuData?.dias[diaLower]?.esFeriado;
                // console.log('Día habilitado:', !isPastDay(diaLower, ahora) && !isCurrentDayAndLate(diaLower, ahora), 'tipo:', tipo);
                return (
                  <div key={dia} className="menu-semanal-dia" style={{width: 'fit-content'}}>
                    <h3 className="menu-semanal-dia-titulo">
                      {dia}
                      {esFeriado && <span className="feriado-badge">FERIADO</span>}
                    </h3>
                    {esFeriado ? (
                      <div className="menu-opcion-feriado">
                        FERIADO - No hay servicio de comida este día
                      </div>
                    ) : (
                      <div className="menu-semanal-opciones">
                        {opciones}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="no-menu-alert">
          <h3>⚠️ Menú No Disponible</h3>
          <p>El menú semanal aún no ha sido cargado.</p>
          <p>Por favor, intenta más tarde o contacta al administrador.</p>
        </div>
      )}
      
      {hayCambios && !readOnly && tipo !== 'actual' && (
        <div className="menu-changes-alert">
          <h3>⚠️ Cambios en el Menú</h3>
          <p>El menú ha sido actualizado recientemente.</p>
          <p>Se modificaron los siguientes días: {diasModificados.map(dia => dia.charAt(0).toUpperCase() + dia.slice(1)).join(', ')}</p>
          <p>Última actualización: {formatearFecha(ultimaModificacion)}</p>
          <p className="recommendation">Te recomendamos revisar las opciones actualizadas antes de realizar tu pedido.</p>
        </div>
      )}

      {/* Formulario para hacer/modificar pedidos - visible según reglas de semana y tardío */}
      {!readOnly && (
        <form onSubmit={handleSubmit} className="formulario">
          {((diaSemana === 6 || diaSemana === 0) && tipo !== 'actual') && (
            <div className="tardio-alert" style={{background:'#78350f', color:'#fff', padding:'1rem', borderRadius:'8px', marginBottom:'1.5rem', textAlign:'center'}}>
              <strong>¡Atención!</strong> Este es un pedido tarde para la próxima semana.<br />
              {mensajeTardio}
            </div>
          )}
          {esTardio && (
            <div className="tardio-alert" style={{background:'#78350f', color:'#fff', padding:'1rem', borderRadius:'8px', marginBottom:'1.5rem', textAlign:'center'}}>
              <strong>¡Importante!</strong> En pedidos tardes, todos los postres serán gelatina, independientemente de la opción seleccionada.
            </div>
          )}
          <div className="formulario-grid">
            {/* LUNES */}
            <div className="formulario-item">
              <label className="formulario-label">
                Lunes<span className="required">*</span>
                {menuData?.dias.lunes?.esFeriado && <span className="feriado-label">(Feriado)</span>}
              </label>
              {menuData?.dias.lunes?.esFeriado ? (
                <div className="formulario-feriado-mensaje">
                  FERIADO - No hay servicio de comida este día
                </div>
              ) : (
                <>
                  {diasTardios?.lunes && (
                    <div className="formulario-dia-tardio">
                      Pedido tardío
                    </div>
                  )}
                  <select
                    name="lunes"
                    className="formulario-select"
                    value={data.lunes}
                    onChange={handleChange}
                    disabled={
                      menuData?.dias.lunes?.esFeriado ||
                      (tipo === 'actual' && (
                        (menuActual?.lunes?.pedido && menuActual.lunes.pedido !== "no_pedir") ||
                        !isDiaDisponible('lunes', ahora)
                      )) ||
                      (diaSemana === 0 || diaSemana === 6)
                    }
                    required={!menuData?.dias.lunes?.esFeriado}
                  >
                    <option value="">Selecciona una opción</option>
                    {opcionesMenuConfig?.Lunes
                      ?.sort((a, b) => {
                        // Si es "NO PEDIR", siempre va primero
                        if (a === "NO PEDIR") return -1;
                        if (b === "NO PEDIR") return 1;
                        // El resto se ordena alfabéticamente
                        return a.localeCompare(b);
                      })
                      .map((opcion, index) => (
                        <option key={index} value={opcion.toLowerCase().replace(/\s+/g, '_')}>
                          {opcion}
                        </option>
                      ))}
                  </select>
                </>
              )}
            </div>
            {/* MARTES */}
            <div className="formulario-item">
              <label className="formulario-label">
                Martes<span className="required">*</span>
                {menuData?.dias.martes?.esFeriado && <span className="feriado-label">(Feriado)</span>}
              </label>
              {menuData?.dias.martes?.esFeriado ? (
                <div className="formulario-feriado-mensaje">
                  FERIADO - No hay servicio de comida este día
                </div>
              ) : (
                <>
                  {diasTardios?.martes && (
                    <div className="formulario-dia-tardio">
                      Pedido tarde
                    </div>
                  )}
                  <select
                    name="martes"
                    className="formulario-select"
                    value={data.martes}
                    onChange={handleChange}
                    disabled={
                      menuData?.dias.martes?.esFeriado ||
                      (tipo === 'actual' && (
                        (menuActual?.martes?.pedido && menuActual.martes.pedido !== "no_pedir") ||
                        !isDiaDisponible('martes', ahora)
                      )) ||
                      (diaSemana === 0 || diaSemana === 6)
                    }
                    required={!menuData?.dias.martes?.esFeriado}
                  >
                    <option value="">Selecciona una opción</option>
                    {opcionesMenuConfig?.Martes
                      ?.sort((a, b) => {
                        // Si es "NO PEDIR", siempre va primero
                        if (a === "NO PEDIR") return -1;
                        if (b === "NO PEDIR") return 1;
                        // El resto se ordena alfabéticamente
                        return a.localeCompare(b);
                      })
                      .map((opcion, index) => (
                        <option key={index} value={opcion.toLowerCase().replace(/\s+/g, '_')}>
                          {opcion}
                        </option>
                      ))}
                  </select>
                </>
              )}
            </div>
            {/* MIÉRCOLES */}
            <div className="formulario-item">
              <label className="formulario-label">
                Miércoles<span className="required">*</span>
                {menuData?.dias.miercoles?.esFeriado && <span className="feriado-label">(Feriado)</span>}
              </label>
              {menuData?.dias.miercoles?.esFeriado ? (
                <div className="formulario-feriado-mensaje">
                  FERIADO - No hay servicio de comida este día
                </div>
              ) : (
                <>
                  {diasTardios?.miercoles && (
                    <div className="formulario-dia-tardio">
                      Pedido tarde
                    </div>
                  )}
                  <select
                    name="miercoles"
                    className="formulario-select"
                    value={data.miercoles}
                    onChange={handleChange}
                    disabled={
                      menuData?.dias.miercoles?.esFeriado ||
                      (tipo === 'actual' && (
                        (menuActual?.miercoles?.pedido && menuActual.miercoles.pedido !== "no_pedir") ||
                        !isDiaDisponible('miercoles', ahora)
                      )) ||
                      (diaSemana === 0 || diaSemana === 6)
                    }
                    required={!menuData?.dias.miercoles?.esFeriado}
                  >
                    <option value="">Selecciona una opción</option>
                    {opcionesMenuConfig?.['Miércoles']
                      ?.sort((a, b) => {
                        // Si es "NO PEDIR", siempre va primero
                        if (a === "NO PEDIR") return -1;
                        if (b === "NO PEDIR") return 1;
                        // El resto se ordena alfabéticamente
                        return a.localeCompare(b);
                      })
                      .map((opcion, index) => (
                        <option key={index} value={opcion.toLowerCase().replace(/\s+/g, '_')}>
                          {opcion}
                        </option>
                      ))}
                  </select>
                </>
              )}
            </div>
            {/* JUEVES */}
            <div className="formulario-item">
              <label className="formulario-label">
                Jueves<span className="required">*</span>
                {menuData?.dias.jueves?.esFeriado && <span className="feriado-label">(Feriado)</span>}
              </label>
              {menuData?.dias.jueves?.esFeriado ? (
                <div className="formulario-feriado-mensaje">
                  FERIADO - No hay servicio de comida este día
                </div>
              ) : (
                <>
                  {diasTardios?.jueves && (
                    <div className="formulario-dia-tardio">
                      Pedido tarde
                    </div>
                  )}
                  <select
                    name="jueves"
                    className="formulario-select"
                    value={data.jueves}
                    onChange={handleChange}
                    disabled={
                      menuData?.dias.jueves?.esFeriado ||
                      (tipo === 'actual' && (
                        (menuActual?.jueves?.pedido && menuActual.jueves.pedido !== "no_pedir") ||
                        !isDiaDisponible('jueves', ahora)
                      )) ||
                      (diaSemana === 0 || diaSemana === 6)
                    }
                    required={!menuData?.dias.jueves?.esFeriado}
                  >
                    <option value="">Selecciona una opción</option>
                    {opcionesMenuConfig?.Jueves
                      ?.sort((a, b) => {
                        // Si es "NO PEDIR", siempre va primero
                        if (a === "NO PEDIR") return -1;
                        if (b === "NO PEDIR") return 1;
                        // El resto se ordena alfabéticamente
                        return a.localeCompare(b);
                      })
                      .map((opcion, index) => (
                        <option key={index} value={opcion.toLowerCase().replace(/\s+/g, '_')}>
                          {opcion}
                        </option>
                      ))}
                  </select>
                </>
              )}
            </div>
            {/* VIERNES */}
            <div className="formulario-item">
              <label className="formulario-label">
                Viernes<span className="required">*</span>
                {menuData?.dias.viernes?.esFeriado && <span className="feriado-label">(Feriado)</span>}
              </label>
              {menuData?.dias.viernes?.esFeriado ? (
                <div className="formulario-feriado-mensaje">
                  FERIADO - No hay servicio de comida este día
                </div>
              ) : (
                <>
                  {diasTardios?.viernes && (
                    <div className="formulario-dia-tardio">
                      Pedido tarde
                    </div>
                  )}
                  <select
                    name="viernes"
                    className="formulario-select"
                    value={data.viernes}
                    onChange={handleChange}
                    disabled={
                      menuData?.dias.viernes?.esFeriado ||
                      (tipo === 'actual' && (
                        (menuActual?.viernes?.pedido && menuActual.viernes.pedido !== "no_pedir") ||
                        !isDiaDisponible('viernes', ahora)
                      )) ||
                      (diaSemana === 0 || diaSemana === 6)
                    }
                    required={!menuData?.dias.viernes?.esFeriado}
                  >
                    <option value="">Selecciona una opción</option>
                    {opcionesMenuConfig?.Viernes
                      ?.sort((a, b) => {
                        // Si es "NO PEDIR", siempre va primero
                        if (a === "NO PEDIR") return -1;
                        if (b === "NO PEDIR") return 1;
                        // El resto se ordena alfabéticamente
                        return a.localeCompare(b);
                      })
                      .map((opcion, index) => (
                        <option key={index} value={opcion.toLowerCase().replace(/\s+/g, '_')}>
                          {opcion}
                        </option>
                      ))}
                  </select>
                </>
              )}
            </div>
          </div>

          <div className="formulario-precio">
            <p className="formulario-precio-total">
              Precio total: ${precioTotal.toLocaleString()}
            </p>
            <p className="formulario-precio-detalle">
              {precioTotal > 0 
                ? `(${precioTotal / precioPorDia} día${precioTotal / precioPorDia > 1 ? 's' : ''} × $${precioPorDia.toLocaleString()})` 
                : userData?.bonificacion 
                  ? 'Menú bonificado (sin costo)'
                  : 'Selecciona al menos un menú para ver el precio'}
            </p>
          </div>

          {(() => {
            // Verificar si hay algún día sin pedido y que no sea feriado
            const algunDiaSinPedido = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].some(dia => {
              const esFeriado = menuData?.dias[dia]?.esFeriado;
              const tienePedido = menuActual?.[dia]?.pedido && menuActual?.[dia]?.pedido !== "no_pedir";
              const esDiaPasado = isPastDay(dia, ahora);
              const esDiaActualTardio = isCurrentDayAndLate(dia, ahora);
              const estaDisponible = !esDiaPasado && !esDiaActualTardio;
              
              // Considerar "no_pedir" como una selección válida
              return !esFeriado && estaDisponible && (!tienePedido || data[dia] === "no_pedir");
            });

            // Si es tipo 'proxima', siempre mostrar el botón
            if (tipo === 'proxima') {
              return (
                <button 
                  type="submit" 
                  className="formulario-boton" 
                  disabled={isSubmitting || (diaSemana === 0 || diaSemana === 6)}
                >
                  <div className="button-content">
                    <span>{menuActual ? (isSubmitting ? "Actualizando..." : "Actualizar Pedido") : (isSubmitting ? "Guardando..." : "Guardar Pedido")}</span>
                    {isSubmitting && <div className="spinner" />}
                  </div>
                </button>
              );
            }

            // Para tipo 'actual', mostrar el botón solo si hay días disponibles para pedir
            if (algunDiaSinPedido) {
              return (
                <button 
                  type="submit" 
                  className="formulario-boton" 
                  disabled={isSubmitting || (diaSemana === 0 || diaSemana === 6)}
                >
                  <div className="button-content">
                    <span>{menuActual ? (isSubmitting ? "Actualizando..." : "Actualizar Pedido") : (isSubmitting ? "Guardando..." : "Guardar Pedido")}</span>
                    {isSubmitting && <div className="spinner" />}
                  </div>
                </button>
              );
            }

            return null;
          })()}
        </form>
      )}

      {/* Visualización del pedido actual */}
      {!readOnly && menuSemanal && (
        <>
          {menuActual ? (
            <div className="menu-actual">
              <div className="menu-actual-header">
                <h2 className="menu-actual-titulo">
                  Mi pedido para la {tipo === 'actual' ? 'semana actual' : 'próxima semana'}
                </h2>
              </div>
              <div className="menu-actual-contenido">
                <div className="menu-actual-info">
                  <div>
                    <p className="menu-actual-fecha">
                      Pedido realizado el: {formatearFecha(menuActual.fechaCreacion)}
                    </p>
                    <p className="menu-actual-total">
                      Total: ${(() => {
                        // Contar los días que tienen un pedido válido
                        const diasConPedido = Object.entries(menuActual)
                          .filter(([key, value]) => 
                            ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].includes(key) && 
                            value?.pedido && 
                            value.pedido !== "no_pedir"
                          ).length;
                        return (diasConPedido * precioPorDia).toLocaleString();
                      })()}
                    </p>
                  </div>
                </div>
                <div className="menu-actual-lista">
                  {["lunes", "martes", "miercoles", "jueves", "viernes"].map((dia, index) => {
                    const diaData = menuActual[dia];
                    return (
                      <div key={dia} className="menu-actual-dia">
                        <div className="menu-actual-numero">{index + 1}</div>
                        <div className="menu-actual-nombre">
                          {dia.toUpperCase()}
                          {diaData?.esTardio && diaData?.pedido !== "no_pedir" && (
                            <span className="tardio-badge" style={{marginLeft: '8px', color: '#fff', background: '#b91c1c', borderRadius: '4px', padding: '2px 6px', fontSize: '0.85em'}}>Tarde</span>
                          )}
                        </div>
                        <div className={`menu-actual-plato ${diaData?.pedido === "no_pedir" ? "menu-actual-no-pedir" : ""}`}>
                          {diaData?.pedido === "no_pedir" 
                            ? "NO PEDIR"
                            : (opcionesMenuCompleto.find(opcion => opcion.value === diaData?.pedido)?.label || diaData?.pedido).toUpperCase()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            tipo === 'actual' && (
              <div className="no-pedido-alert">
                <h3>No tienes pedidos para esta semana</h3>
              </div>
            )
          )}
        </>
      )}

      {/* Lightbox - imagen completa al hacer click */}
      {lightboxImg && (() => {
        const closeLightbox = () => {
          // Restaurar tooltips que fueron ocultados manualmente
          document.querySelectorAll('.menu-img-tooltip').forEach(el => {
            el.style.removeProperty('display');
          });
          setLightboxImg(null);
        };
        return (
          <div className="lightbox-overlay" onClick={closeLightbox}>
            <button className="lightbox-close" onClick={closeLightbox}>✕</button>
            <img
              className="lightbox-img"
              src={lightboxImg}
              alt="Vista completa"
              onClick={e => e.stopPropagation()}
            />
          </div>
        );
      })()}
    </div>
  );
};

export default Formulario;
