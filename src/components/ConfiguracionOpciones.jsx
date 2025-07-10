import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import Modal from './Modal';
import './ConfiguracionOpciones.css';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

const OPCIONES_MENU = [
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
  { value: "sand_miga_con_gelatina", label: "SAND DE MIGA C/GELATINA" }
];

const OPCIONES_MENU_COMPLETO = [
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
  { value: "sand_miga_banana", label: "SAND DE MIGA C/BANANA" }
];

const OPCIONES_DEFAULT = {
  Lunes: OPCIONES_MENU.map(op => op.label),
  Martes: OPCIONES_MENU.map(op => op.label),
  Miércoles: OPCIONES_MENU.map(op => op.label),
  Jueves: OPCIONES_MENU_COMPLETO.map(op => op.label),
  Viernes: OPCIONES_MENU.map(op => op.label)
};

const ConfiguracionOpciones = () => {
  const [opciones, setOpciones] = useState(OPCIONES_DEFAULT);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [nuevaOpcion, setNuevaOpcion] = useState({
    Lunes: '',
    Martes: '',
    Miércoles: '',
    Jueves: '',
    Viernes: ''
  });
  const [editandoOpcion, setEditandoOpcion] = useState({
    dia: null,
    index: null,
    texto: ''
  });

  useEffect(() => {
    cargarOpciones();
  }, []);

  const cargarOpciones = async () => {
    try {
      const db = getFirestore();
      const configRef = doc(db, 'config', 'opcionesMenu');
      const docSnap = await getDoc(configRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const opcionesFormateadas = {};
        DIAS_SEMANA.forEach(dia => {
          const opcionesDelDia = Array.isArray(data[dia]) && data[dia].length > 0 
            ? data[dia] 
            : OPCIONES_DEFAULT[dia];
          
          // Ordenar alfabéticamente, pero "NO PEDIR" siempre va primero
          const opcionesOrdenadas = opcionesDelDia.sort((a, b) => {
            // "NO PEDIR" siempre va primero
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
          });
          
          opcionesFormateadas[dia] = opcionesOrdenadas;
        });
        setOpciones(opcionesFormateadas);
      } else {
        console.log('Creando opciones por defecto en Firestore');
        await setDoc(configRef, OPCIONES_DEFAULT);
        setOpciones(OPCIONES_DEFAULT);
        setModal({
          isOpen: true,
          title: 'Información',
          message: 'Se han creado las opciones por defecto en la base de datos.',
          type: 'info'
        });
      }
    } catch (error) {
      console.error('Error al cargar opciones:', error);
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al cargar las opciones: ' + error.message,
        type: 'error'
      });
      setOpciones(OPCIONES_DEFAULT);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNuevaOpcion = (dia, valor) => {
    setNuevaOpcion(prev => ({
      ...prev,
      [dia]: valor
    }));
  };

  const agregarOpcion = (dia) => {
    if (!nuevaOpcion[dia]) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Por favor ingresa una opción',
        type: 'error'
      });
      return;
    }

    if (opciones[dia].includes(nuevaOpcion[dia])) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Esta opción ya existe para este día',
        type: 'error'
      });
      return;
    }

    setOpciones(prev => {
      const nuevasOpciones = [...prev[dia], nuevaOpcion[dia]];
      
      // Ordenar alfabéticamente, pero "NO PEDIR" siempre va primero
      const opcionesOrdenadas = nuevasOpciones.sort((a, b) => {
        // "NO PEDIR" siempre va primero
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
      });
      
      return {
        ...prev,
        [dia]: opcionesOrdenadas
      };
    });

    setNuevaOpcion(prev => ({
      ...prev,
      [dia]: ''
    }));
  };

  const eliminarOpcion = (dia, opcionAEliminar) => {
    if (opcionAEliminar === "NO PEDIR") {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'No se puede eliminar la opción "NO PEDIR"',
        type: 'error'
      });
      return;
    }
    setOpciones(prev => ({
      ...prev,
      [dia]: prev[dia].filter(opcion => opcion !== opcionAEliminar)
    }));
  };

  const iniciarEdicion = (dia, index, texto) => {
    // No permitir editar "NO PEDIR"
    if (texto.trim().toUpperCase().includes('NO PEDIR')) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'No se puede editar la opción "NO PEDIR"',
        type: 'error'
      });
      return;
    }
    
    setEditandoOpcion({
      dia,
      index,
      texto
    });
  };

  const cancelarEdicion = () => {
    setEditandoOpcion({
      dia: null,
      index: null,
      texto: ''
    });
  };

  const guardarEdicion = (dia, index) => {
    if (!editandoOpcion.texto.trim()) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'La opción no puede estar vacía',
        type: 'error'
      });
      return;
    }

    // Verificar si ya existe una opción con ese texto (excluyendo la actual)
    const opcionesActuales = opciones[dia];
    const opcionExistente = opcionesActuales.find((opcion, i) => 
      i !== index && opcion.trim() === editandoOpcion.texto.trim()
    );

    if (opcionExistente) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Ya existe una opción con ese texto',
        type: 'error'
      });
      return;
    }

    setOpciones(prev => {
      const nuevasOpciones = [...prev[dia]];
      nuevasOpciones[index] = editandoOpcion.texto.trim();
      
      // Reordenar alfabéticamente después de la edición
      const opcionesOrdenadas = nuevasOpciones.sort((a, b) => {
        // "NO PEDIR" siempre va primero
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
      });
      
      return {
        ...prev,
        [dia]: opcionesOrdenadas
      };
    });

    cancelarEdicion();
  };

  const guardarOpciones = async () => {
    try {
      setIsLoading(true);
      const db = getFirestore();
      const configRef = doc(db, 'config', 'opcionesMenu');
      
      // Asegurarse de que todas las opciones sean arrays
      const opcionesFormateadas = {};
      DIAS_SEMANA.forEach(dia => {
        opcionesFormateadas[dia] = Array.isArray(opciones[dia]) ? opciones[dia] : [];
      });
      
      // console.log('Guardando opciones en Firestore:', opcionesFormateadas);
      
      // Guardar en Firestore
      await setDoc(configRef, opcionesFormateadas);
      
      // Verificar que los datos se guardaron correctamente
      const docSnap = await getDoc(configRef);
      if (!docSnap.exists()) {
        throw new Error('No se pudo verificar el guardado');
      }
      
      const datosGuardados = docSnap.data();
      // console.log('Datos guardados en Firestore:', datosGuardados);
      
      setModal({
        isOpen: true,
        title: 'Éxito',
        message: 'Opciones guardadas exitosamente',
        type: 'success'
      });
    } catch (error) {
      console.error('Error al guardar opciones:', error);
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al guardar las opciones: ' + error.message,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="configuracion-loading">Cargando...</div>;
  }

  return (
    <div className="configuracion-opciones">
      <h2>Configuración de Opciones del Menú</h2>
      <p className="instrucciones">
        Agrega o elimina las opciones disponibles para cada día de la semana.
        Estas opciones aparecerán en el formulario de pedidos.
      </p>

      <button 
        className="guardar-btn"
        onClick={guardarOpciones}
        disabled={isLoading}
        style={{ marginBottom: '2rem' }}
      >
        {isLoading ? 'Guardando...' : 'Guardar Configuración'}
      </button>

      <div className="opciones-grid">
        {DIAS_SEMANA.map(dia => (
          <div key={dia} className="dia-opciones">
            <h3>{dia}</h3>
            
            <div className="opciones-actuales">
              <h4>Opciones Actuales</h4>
              <div className="opciones-lista">
                {Array.isArray(opciones[dia]) && opciones[dia].map((opcion, index) => (
                  <div key={index} className="opcion-item">
                    {editandoOpcion.dia === dia && editandoOpcion.index === index ? (
                      <div className="edicion-opcion">
                        <input
                          type="text"
                          value={editandoOpcion.texto}
                          onChange={(e) => setEditandoOpcion(prev => ({ ...prev, texto: e.target.value }))}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              guardarEdicion(dia, index);
                            } else if (e.key === 'Escape') {
                              cancelarEdicion();
                            }
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '0.3rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '0.9rem'
                          }}
                        />
                        <button 
                          className="guardar-edicion-btn"
                          onClick={() => guardarEdicion(dia, index)}
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.3rem 0.6rem',
                            marginLeft: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          ✓
                        </button>
                        <button 
                          className="cancelar-edicion-btn"
                          onClick={cancelarEdicion}
                          style={{
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.3rem 0.6rem',
                            marginLeft: '0.3rem',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <span>{opcion}</span>
                        <div className="opcion-buttons">
                          <button 
                            className="editar-btn"
                            onClick={() => iniciarEdicion(dia, index, opcion)}
                            title={opcion.trim().toUpperCase().includes('NO PEDIR') ? "Esta opción no se puede editar" : "Editar esta opción"}
                            disabled={opcion.trim().toUpperCase().includes('NO PEDIR')}
                            style={{
                              background: opcion.trim().toUpperCase().includes('NO PEDIR') ? '#9ca3af' : '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.2rem 0.4rem',
                              marginRight: '0.3rem',
                              cursor: opcion.trim().toUpperCase().includes('NO PEDIR') ? 'not-allowed' : 'pointer',
                              fontSize: '0.7rem',
                              opacity: opcion.trim().toUpperCase().includes('NO PEDIR') ? 0.5 : 1
                            }}
                          >
                            ✎
                          </button>
                          <button 
                            className="eliminar-btn"
                            onClick={() => eliminarOpcion(dia, opcion)}
                            title={opcion === "NO PEDIR" ? "Esta opción no se puede eliminar" : "Eliminar esta opción"}
                            disabled={opcion === "NO PEDIR"}
                            style={opcion === "NO PEDIR" ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                          >
                            ×
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="agregar-opcion">
              <h4>Agregar Nueva Opción</h4>
              <div className="input-group">
                <input
                  type="text"
                  value={nuevaOpcion[dia]}
                  onChange={(e) => handleNuevaOpcion(dia, e.target.value)}
                  placeholder="Nueva opción..."
                />
                <button 
                  className="agregar-btn"
                  onClick={() => agregarOpcion(dia)}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onClose={() => setModal({ ...modal, isOpen: false })}
      />
    </div>
  );
};

export default ConfiguracionOpciones; 