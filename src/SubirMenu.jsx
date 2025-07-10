import React, { useState, useRef, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import * as pdfjsLib from 'pdfjs-dist';
import Modal from './components/Modal';
import Spinner from './components/Spinner';
import './SubirMenu.css';

// Configurar el worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

const SubirMenu = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [menuStructure, setMenuStructure] = useState(null);
  const [isNewMenu, setIsNewMenu] = useState(false);
  const [menuType, setMenuType] = useState('proxima');
  const [menuData, setMenuData] = useState({
    semana: '',
    temporada: '',
    dias: {
      lunes: { esFeriado: false },
      martes: { esFeriado: false },
      miercoles: { esFeriado: false },
      jueves: { esFeriado: false },
      viernes: { esFeriado: false }
    }
  });
  const [loading, setLoading] = useState(true);
  const [diasModificados, setDiasModificados] = useState([]);
  const menuOriginal = useRef(null);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    cargarEstructuraMenu();
    cargarMenuActual();
  }, []);

  useEffect(() => {
    if (menuStructure) {
      setMenuData(prevData => {
        const diasInicializados = {};
        ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].forEach(dia => {
          diasInicializados[dia] = {
            esFeriado: prevData.dias[dia]?.esFeriado || false,
            ...(menuStructure.opciones || []).reduce((acc, opcion) => ({
              ...acc,
              [opcion.toLowerCase().replace(/ /g, '')]: prevData.dias[dia]?.[opcion.toLowerCase().replace(/ /g, '')] || ''
            }), {})
          };
        });

        return {
          ...prevData,
          dias: diasInicializados
        };
      });
    }
  }, [menuStructure]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const cargarEstructuraMenu = async () => {
    try {
      const structureRef = doc(db, 'config', 'menuStructure');
      const structureSnap = await getDoc(structureRef);

      if (structureSnap.exists()) {
        const structure = structureSnap.data();
        // console.log('Estructura del menú cargada:', structure);
        setMenuStructure(structure);
      }
    } catch (error) {
      console.error('Error al cargar la estructura del menú:', error);
      setMessage({ type: 'error', text: 'Error al cargar la estructura del menú' });
    }
  };

  const cargarMenuActual = async () => {
    try {
      setLoading(true);
      const menuRef = doc(db, 'menus', 'menuActual');
      const menuSnap = await getDoc(menuRef);

      if (menuSnap.exists()) {
        const data = menuSnap.data();
        // Convertir las claves a minúsculas para mantener consistencia
        const menuFormateado = {
          semana: data.semana,
          temporada: data.temporada,
          dias: {
            lunes: data.dias.lunes || { esFeriado: false },
            martes: data.dias.martes || { esFeriado: false },
            miercoles: data.dias.miercoles || { esFeriado: false },
            jueves: data.dias.jueves || { esFeriado: false },
            viernes: data.dias.viernes || { esFeriado: false }
          }
        };
        setMenuData(menuFormateado);
        menuOriginal.current = JSON.stringify(menuFormateado);
        setMessage({ type: 'success', text: 'Menú actual cargado correctamente' });
      } else {
        setMessage({ type: 'info', text: 'No hay menú actual para cargar' });
      }
    } catch (error) {
      console.error('Error al cargar el menú:', error);
      setMessage({ type: 'error', text: 'Error al cargar el menú actual' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (dia, categoria, valor) => {
    setMenuData(prevData => ({
      ...prevData,
      dias: {
        ...prevData.dias,
        [dia]: {
          ...prevData.dias[dia],
          [categoria]: valor
        }
      }
    }));
  };

  const handleOpcionChange = (dia, opcion) => {
    setMenuData(prevData => ({
      ...prevData,
      dias: {
        ...prevData.dias,
        [dia]: {
          ...prevData.dias[dia],
          opciones: {
            ...prevData.dias[dia].opciones,
            [opcion]: !prevData.dias[dia].opciones[opcion]
          }
        }
      }
    }));
  };

  const handleEnsaladaChange = (dia, ensalada, valor) => {
    setMenuData(prevData => ({
      ...prevData,
      dias: {
        ...prevData.dias,
        [dia]: {
          ...prevData.dias[dia],
          ensaladas: {
            ...prevData.dias[dia].ensaladas,
            [ensalada]: valor
          }
        }
      }
    }));
  };

  const handleHeaderChange = (campo, valor) => {
    setMenuData(prevData => ({
      ...prevData,
      [campo]: valor
    }));
  };

  const handleSandwichChange = (dia, campo, valor) => {
    setMenuData(prevData => ({
      ...prevData,
      dias: {
        ...prevData.dias,
        [dia]: {
          ...prevData.dias[dia],
          sandwichMiga: {
            ...prevData.dias[dia].sandwichMiga,
            [campo]: valor
          }
        }
      }
    }));
  };

  const handlePostreChange = (dia, valor) => {
    setMenuData(prevData => ({
      ...prevData,
      dias: {
        ...prevData.dias,
        [dia]: {
          ...prevData.dias[dia],
          postre: valor
        }
      }
    }));
  };

  const handleFeriadoChange = (dia, esFeriado) => {
    setMenuData(prev => ({
      ...prev,
      dias: {
        ...prev.dias,
        [dia]: {
          ...prev.dias[dia],
          esFeriado,
          ...(esFeriado ? {
            ...menuStructure.opciones.reduce((acc, opcion) => ({ ...acc, [opcion.toLowerCase().replace(/ /g, '')]: '' }), {}),
            ...(menuStructure.extras?.sandwichmiga ? { sandwichMiga: { tipo: '', cantidad: 0 } } : {}),
            ...(menuStructure.extras?.ensalada ? { ensaladas: { ensalada1: '' } } : {}),
            ...(menuStructure.extras?.postre ? { postre: '' } : {})
          } : {})
        }
      }
    }));
  };

  const detectarCambios = () => {
    if (!menuOriginal.current) return [];
    
    const menuActual = JSON.stringify(menuData);
    if (menuActual === menuOriginal.current) return [];

    const diasModificados = [];
    const diasOriginales = JSON.parse(menuOriginal.current).dias;
    
    Object.keys(menuData.dias).forEach(dia => {
      const diaOriginal = diasOriginales[dia];
      const diaActual = menuData.dias[dia];
      
      if (JSON.stringify(diaOriginal) !== JSON.stringify(diaActual)) {
        diasModificados.push(dia);
      }
    });

    return diasModificados;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (isNewMenu) {
        // Crear un nuevo documento en la colección de menús
        const menuNuevo = {
          semana: menuData.semana,
          temporada: menuData.temporada,
          dias: menuData.dias,
          ultimaModificacion: serverTimestamp(),
          diasModificados: [],
          hayCambios: false,
          esNuevo: true,
          tipo: menuType
        };
        
        // Guardar el menú en la ubicación correcta según el tipo
        const menuRef = doc(db, 'menus', menuType === 'actual' ? 'menuActual' : 'menuProxima');
        await setDoc(menuRef, menuNuevo);

        // También guardar una copia en la colección general de menús
        const nuevoMenuRef = doc(collection(db, 'menus'));
        await setDoc(nuevoMenuRef, menuNuevo);

        // Actualizar el menú original después de guardar
        menuOriginal.current = JSON.stringify(menuNuevo);

        setModal({
          isOpen: true,
          title: 'Éxito',
          message: `Nuevo menú creado y establecido como menú ${menuType === 'actual' ? 'actual' : 'de próxima semana'} correctamente`,
          type: 'success'
        });
      } else {
        // Si es una edición, mantenemos la lógica original
        const diasModificados = detectarCambios();
        const menuRef = doc(db, 'menus', 'menuActual');
        
        await setDoc(menuRef, {
          ...menuData,
          ultimaModificacion: serverTimestamp(),
          diasModificados: diasModificados,
          hayCambios: diasModificados.length > 0
        }, { merge: true });

        setModal({
          isOpen: true,
          title: 'Éxito',
          message: diasModificados.length > 0 
            ? `Menú actualizado correctamente. Se modificaron los días: ${diasModificados.join(', ')}`
            : 'Menú actualizado correctamente',
          type: 'success'
        });

        // Actualizar el menú original después de guardar
        menuOriginal.current = JSON.stringify(menuData);
      }
      
      // Scroll al principio de la página
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    } catch (error) {
      console.error('Error al actualizar el menú:', error);
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al actualizar el menú: ' + error.message,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateGPTPrompt = (text) => {
    if (!menuStructure) return null;

    // Crear un objeto de ejemplo basado en la estructura actual
    const exampleDay = {
      // Opciones principales del menú
      ...(menuStructure.opciones || []).reduce((acc, opcion) => ({
        ...acc,
        [opcion.toLowerCase().replace(/ /g, '')]: "string"
      }), {})
    };

    // Crear la estructura completa del menú
    const menuStructureExample = {
      temporada: "string",
      semana: "string",
      dias: {
        lunes: exampleDay,
        martes: exampleDay,
        miercoles: exampleDay,
        jueves: exampleDay,
        viernes: exampleDay
      }
    };

    return `Analiza el siguiente menú semanal y extrae la información en formato JSON. 
    El menú debe tener la siguiente estructura:
    ${JSON.stringify(menuStructureExample, null, 2)}

    Texto del menú:
    ${text}

    Responde SOLO con el JSON, sin texto adicional.`;
  };

  const processMenuWithGPT = async (text) => {
    try {
      const prompt = generateGPTPrompt(text);
      if (!prompt) {
        throw new Error('No se pudo generar el prompt porque la estructura del menú no está disponible');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error('Error al procesar el menú con la API de OpenAI');
      }

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('Error al procesar el menú con GPT:', error);
      throw error;
    }
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Por favor, sube un archivo PDF',
        type: 'error'
      });
      return;
    }

    setIsPdfLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // Extraer texto de todas las páginas
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\\n';
      }

      // Procesar el texto con GPT
      const menuData = await processMenuWithGPT(fullText);
      
      // Actualizar el estado con los datos procesados
      setMenuData(prevData => ({
        ...prevData,
        temporada: menuData.temporada,
        semana: menuData.semana,
        dias: menuData.dias
      }));

      setModal({
        isOpen: true,
        title: 'Éxito',
        message: 'Menú procesado correctamente',
        type: 'success'
      });
    } catch (error) {
      console.error('Error al procesar el PDF:', error);
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al procesar el PDF. Por favor, inténtalo de nuevo.',
        type: 'error'
      });
    } finally {
      setIsPdfLoading(false);
    }
  };

  const renderDiaInputs = (dia) => {
    if (!menuStructure) return null;
    const diaData = menuData.dias[dia];

    return (
      <div className="dia-menu">
        <h3>{dia.charAt(0).toUpperCase() + dia.slice(1)}</h3>
        
        <div className="feriado-toggle">
          <label>
            <input
              type="checkbox"
              checked={diaData.esFeriado}
              onChange={(e) => handleFeriadoChange(dia, e.target.checked)}
            />
            Es feriado
          </label>
        </div>

        {!diaData.esFeriado && (
          <>
            {menuStructure.opciones.map((opcion) => (
              <div key={opcion} className="menu-input">
                <label>{opcion}:</label>
                <input
                  type="text"
                  value={diaData[opcion.toLowerCase().replace(/ /g, '')] || ''}
                  onChange={(e) => handleChange(dia, opcion.toLowerCase().replace(/ /g, ''), e.target.value)}
                  placeholder={`${opcion}...`}
                />
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="subir-menu-container">
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ isOpen: false, title: '', message: '', type: 'info' })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
      
      <h2 className="subir-menu-title">Subir/Editar Menú</h2>
      
      <div className="menu-type-selection">
        <label>
          <input
            type="checkbox"
            checked={isNewMenu}
            onChange={(e) => setIsNewMenu(e.target.checked)}
          />
          Subir nuevo menú
        </label>
        {isNewMenu && (
          <div className="menu-week-selection">
            <label>
              <input
                type="radio"
                value="actual"
                checked={menuType === 'actual'}
                onChange={(e) => setMenuType(e.target.value)}
              />
              Menú semana actual
            </label>
            <label>
              <input
                type="radio"
                value="proxima"
                checked={menuType === 'proxima'}
                onChange={(e) => setMenuType(e.target.value)}
              />
              Menú próxima semana
            </label>
          </div>
        )}
      </div>

      <div className="pdf-upload-section">
        <input
          type="file"
          accept=".pdf"
          onChange={handlePdfUpload}
          ref={fileInputRef}
          style={{ display: 'none' }}
        />
        <button 
          type="button"
          className="upload-button"
          onClick={() => fileInputRef.current.click()}
          disabled={isPdfLoading}
        >
          {isPdfLoading ? (
            <>
              <div className="button-spinner"></div>
              Procesando PDF...
            </>
          ) : (
            'Cargar PDF del Menú'
          )}
        </button>
      </div>
      
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <form className="menu-form" onSubmit={handleSubmit}>
        <div className="menu-header">
          <div className="form-group">
            <label>Semana:</label>
            <input
              type="text"
              value={menuData.semana}
              onChange={(e) => setMenuData({ ...menuData, semana: e.target.value })}
              placeholder="Ej: 4 al 8 de Marzo"
              required
            />
          </div>
          <div className="form-group">
            <label>Temporada:</label>
            <input
              type="text"
              value={menuData.temporada}
              onChange={(e) => setMenuData({ ...menuData, temporada: e.target.value })}
              placeholder="Ej: Verano 2024"
              required
            />
          </div>
        </div>

        {['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].map(dia => (
          <div key={dia}>
            {renderDiaInputs(dia)}
          </div>
        ))}

        <button type="submit" className="submit-button" disabled={isLoading}>
          {isLoading ? 'Guardando...' : 'Guardar Menú'}
        </button>
      </form>
    </div>
  );
};

export default SubirMenu; 