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
    // cargarMenuActual();
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
    } finally {
      setLoading(false); // ✅ CLAVE
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
        // setMenuData(menuFormateado);
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

  // const handlePostreChange = (dia, valor) => {
  //   setMenuData(prevData => ({
  //     ...prevData,
  //     dias: {
  //       ...prevData.dias,
  //       [dia]: {
  //         ...prevData.dias[dia],
  //         postre: valor
  //       }
  //     }
  //   }));
  // };

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

    console.log(text);

    return `Analiza el siguiente menú semanal y extrae la información en formato JSON.
    Responde SOLO con el JSON, sin texto adicional.
    
    INFORMACIÓN SOBRE EL FORMATO DEL TEXTO:
    El texto ha sido extraído intentando preservar el LAYOUT VISUAL del PDF original.
    - Se han insertado separadores ' | ' para indicar espacios horizontales grandes (probables columnas).
    - El texto respeta el orden visual: arriba a abajo, izquierda a derecha.
    
    ESTRATEGIA DE PARSEO PRIORITARIA (POR COLUMNAS):
    1. Interpreta el texto como una TABLA o GRILLA visual.
    2. Si ves una estructura columnar (elementos separados por |), ASUME que corresponden a los días de la semana en orden:
       [ Columna 1 = LUNES ] | [ Columna 2 = MARTES ] | [ Columna 3 = MIÉRCOLES ] | [ Columna 4 = JUEVES ] | [ Columna 5 = VIERNES ]
    3. Si los nombres de los días("LUNES", "MARTES", etc.) aparecen alineados en una fila superior, usa esa alineación para guiarte.
    4. Ignora "Viernes antes de Jueves" si es un error de lectura secuencial, fíjate en la posición VISUAL (Columna 4 vs Columna 5).
    
    SI NO HAY COLUMNAS CLARAS:
    - Busca palabras clave 'BETI JAI' o los nombres de los días para separar los bloques.

    ⚠️ INSTRUCCIONES IMPORTANTES:
    - IGNORÁ COMPLETAMENTE cualquier sección de POSTRES.
    - NO incluyas postres en ningún campo (por ejemplo: dieta blanda, menú general, etc).
    - Si un texto corresponde a postres, DESCARTALO.
    - Solo extraé información de comidas principales.
    
    REGLAS DE EXTRACCIÓN Y VALORES POR DEFECTO:
    - No inventes información.
    - No mezcles categorías.
    
    CASOS ESPECIALES DE CONTENIDO:
    1. Si una categoría (como "DIETA BLANDA" o "LIGHT") aparece en el menú pero NO tiene descripción específica (o solo aparece el título), USA EL NOMBRE DE LA CATEGORÍA COMO VALOR.
       Ejemplo: Si dice "DIETA BLANDA" y luego pasa a Postres, el valor debe ser "Dieta Blanda".
    2. REGLA DE CANTIDADES DINÁMICAS:
       - Si detectas CUALQUIER indicador de cantidad (como "(X2)", "(X3)", "X2", "2 u.", etc.) asociado a un ítem del menú (ya sea en el título de la categoría o en la descripción):
       - INCLÚYELO SIEMPRE al principio del texto extraído.
       - No importa si es pebete, sandwich o cualquier otro plato. Si el PDF dice "X2", el JSON debe decir "X2".
       - Ejemplo: Si el texto dice "OPCIÓN (X3) ...", el resultado debe ser "(X3) ...".
    3. Si el campo queda totalmente vacío y no se menciona en el día, déjalo como string vacío "". PERO si se menciona el título, repite el título como contenido.

    El menú debe tener EXACTAMENTE la siguiente estructura:
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
      // Extraer texto de todas las páginas con ordenamiento visual (Geometric Sorting)
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Obtenemos los items y los ordenamos por posición Y (descendente) y luego X (ascendente)
        const items = textContent.items;

        items.sort((a, b) => {
          const yA = a.transform[5];
          const yB = b.transform[5];
          // Tolerancia vertical para considerar que están en la "misma línea" visual
          if (Math.abs(yA - yB) < 8) {
            return a.transform[4] - b.transform[4]; // X ascendente
          }
          return yB - yA; // Y descendente (los valores mayores están arriba en PDF)
        });

        let lastY = null;
        let lastX = null;
        let lastWidth = 0;
        let pageText = '';

        items.forEach(item => {
          const y = item.transform[5];
          const x = item.transform[4];
          const width = item.width || 0; // width puede venir en el item

          // Detectar nueva línea visual
          if (lastY !== null && Math.abs(y - lastY) > 10) {
            pageText += '\n';
            lastX = null; // Reset X tracking en nueva línea actual
          }

          if (lastX !== null) {
            // Calcular espacio desde el final del item anterior
            const gap = x - (lastX + lastWidth);

            // Si el espacio es significativo (ej. > 15px), insertar separador de columna visual
            if (gap > 15) {
              pageText += ' | ';
            } else if (gap > 2) {
              // Espacio normal de palabra
              pageText += ' '; // Espacio simple
            }
            // Si el gap es muy pequeño o negativo, no agregamos espacio (kerning o unión)
          }

          pageText += item.str;

          lastY = y;
          lastX = x;
          lastWidth = width;
        });

        fullText += pageText + '\n\n-------------------\n\n';
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