# Beti Jai - Gestión de Menús

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.
Aplicación web desarrollada con **React** y **Vite** para la administración y gestión de los menús del comedor "Beti Jai - Méndez". Permite a los usuarios autenticarse, realizar pedidos de comida y a los administradores gestionar menús, precios y usuarios.

Currently, two official plugins are available:

## Características principales

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh
- Autenticación mediante **Firebase Auth** utilizando correo electrónico o nombre de usuario.
- Panel de administración con las siguientes herramientas:
  - Creación y edición de usuarios con bonificaciones.
  - Carga y edición de menús semanales.
  - Importación de menús en PDF utilizando la API de **OpenAI** para interpretar el contenido.
  - Configuración de precios y opciones disponibles.
  - Visualización y exportación de pedidos a Excel.
  - Cierre semanal que archiva los pedidos y rota el menú.
- Formularios para que cada empleado seleccione su comida de la semana.

## Expanding the ESLint configuration

## Requisitos

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

- Node.js 18 o superior
- Una cuenta de Firebase con Firestore y Authentication habilitados.
- Clave de API de OpenAI (opcional, solo necesaria para procesar menús en PDF).

## Instalación

1. Clona este repositorio y entra en la carpeta del proyecto.
2. Ejecuta `npm install` para instalar las dependencias.
3. Crea un archivo `.env` en la raíz y define la variable `VITE_OPENAI_API_KEY` si vas a usar la carga de menús en PDF.
4. Inicia la aplicación en modo desarrollo con:

```bash
npm run dev
```

La aplicación estará disponible por defecto en [http://localhost:5173](http://localhost:5173).

## Comandos útiles

- `npm run dev` &mdash; Inicia el servidor de desarrollo.
- `npm run build` &mdash; Genera la versión de producción en la carpeta `dist`.
- `npm run preview` &mdash; Sirve la versión de producción generada con `build`.
- `npm run lint` &mdash; Ejecuta ESLint sobre todo el proyecto.

## Estructura del proyecto

- `src/` contiene el código fuente principal.
  - `firebase.js` configura la conexión a Firebase.
  - Componentes de React para el panel de administración y el formulario de pedidos se encuentran en `src/components`.
- `public/` incluye los archivos estáticos y el logo de la aplicación.
- `Instructivo Beti-Jai (Usuario).pdf` proporciona una guía de uso para los usuarios finales.

## Variables de entorno

Además de `VITE_OPENAI_API_KEY`, puedes adaptar el archivo `src/firebase.js` con los parámetros de tu proyecto de Firebase si fuese necesario.

## Licencia

Este proyecto se distribuye sin una licencia específica. Puedes adaptarlo según tus necesidades.
