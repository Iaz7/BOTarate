# Chrome Extension with React, TypeScript and Vite

This project is a modern Chrome extension built with **React**, **TypeScript** and **Vite**. The extension dynamically modifies specific web pages (https://egela.ehu.eus/*) by injecting interactive React components. It includes a complete architecture with background script, content script, popup and options page.

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Development

1. **Start the development server** (keep this terminal open):

    ```bash
    npm run dev
    ```

2. **Load the extension in Chrome**:

    - Open Chrome and go to `chrome://extensions/`
    - Enable "Developer mode" (top right corner)
    - Click on "Load unpacked"
    - Select the `dist/` folder of the project

3. **Debugging from VS Code**:
    - Press `F5` in VS Code
    - Chrome will open with the extension loaded
    - Place breakpoints in your TypeScript/TSX code
    - Changes are reflected automatically (hot reload)

### Build for Production

```bash
npm run build
```

## 🏗️ Project Structure

```
chrome-extension-vite/
├── src/                          # Source code
│   ├── background/               # Background Service Worker
│   │   └── background.ts         # Service worker logic
│   ├── content/                  # Content Scripts
│   │   ├── content.tsx          # React component injected into the page
│   │   └── index.tsx            # Content script entry point
│   ├── popup/                    # Extension Popup
│   │   ├── popup.html           # Popup HTML
│   │   ├── popup.tsx            # Popup React component
│   │   └── index.tsx            # Popup entry point
│   ├── options/                  # Options Page
│   │   ├── options.html         # Options page HTML
│   │   ├── options.tsx          # Options React component
│   │   └── index.tsx            # Options entry point
│   └── types/                    # TypeScript definitions
│       └── index.ts             # Shared types
├── public/                       # Static files
│   └── manifest.json            # Chrome Extension Manifest V3
├── dist/                         # Built files (generated)
│   ├── assets/                  # Compiled and optimized assets
│   ├── src/                     # Copied HTML files
│   └── manifest.json            # Processed manifest
├── package.json                  # NPM dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite configuration with CRX plugin
└── README.md                    # Project documentation
```

## 🔧 Technologies Used

-   **[React 18](https://reactjs.org/)** - Library for user interfaces
-   **[TypeScript](https://www.typescriptlang.org/)** - Static typing for JavaScript
-   **[Vite](https://vitejs.dev/)** - Build tool and ultrafast dev server
-   **[@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)** - Specialized plugin for Chrome Extensions
-   **Chrome Extension Manifest V3** - Latest version of the extension system

## 📁 Component Description

### Background Script (`src/background/`)

-   **background.ts**: Service worker running in the background
-   Handles global extension events
-   Manages communication between different parts of the extension

### Content Script (`src/content/`)

-   **content.tsx**: React component injected into web pages
-   Runs in the context of the visited page (https://egela.ehu.eus/*)
-   Dynamically modifies the page DOM
-   Includes interactive UI with buttons and states

### Popup (`src/popup/`)

-   **popup.html**: Popup HTML structure
-   **popup.tsx**: React interface of the extension popup
-   **index.tsx**: Entry point that mounts the React component
-   Opens when clicking the extension icon

### Options (`src/options/`)

-   **options.html**: Configuration HTML page
-   **options.tsx**: React interface for configuring the extension
-   **index.tsx**: Options page entry point
-   Accesible desde chrome://extensions/

### Types (`src/types/`)

-   **index.ts**: Definiciones de tipos TypeScript compartidas
-   Interfaces y tipos para mantener consistencia en el proyecto

## 🚀 Instalación y Configuración

### Prerrequisitos

-   **Node.js** (versión 16 o superior)
-   **npm** o **yarn**
-   **Google Chrome** (para pruebas)

### Pasos de Instalación

1. **Clona el repositorio:**

    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd chrome-extension-vite
    ```

2. **Instala las dependencias:**

    ```bash
    npm install
    ```

3. **Variables de entorno (opcional):**
    ```bash
    # Crea un archivo .env si necesitas variables específicas
    cp .env.example .env
    ```

## 🛠️ Scripts de Desarrollo

### Desarrollo

```bash
npm run dev
```

-   Inicia el servidor de desarrollo con hot-reload
-   Los cambios se reflejan automáticamente
-   Ideal para desarrollo iterativo

### Construcción para Producción

```bash
npm run build
```

-   Compila y optimiza todos los assets
-   Genera la carpeta `dist/` lista para producción
-   Utiliza el plugin CRX para crear bundles compatibles con Chrome

### Verificación de Tipos

```bash
npm run type-check
```

-   Ejecuta verificación de tipos TypeScript
-   No genera archivos, solo valida el código

## 📦 Instalación en Chrome

### Modo Desarrollador (Recomendado para desarrollo)

1. Abre Chrome y navega a `chrome://extensions/`
2. Activa el **"Modo de desarrollador"** (toggle en la esquina superior derecha)
3. Haz clic en **"Cargar descomprimida"**
4. Selecciona la carpeta `dist/` del proyecto
5. La extensión aparecerá en la lista y estará lista para usar

### Recarga de la Extensión

-   Después de cada `npm run build`, haz clic en el botón de **recarga** (🔄) en `chrome://extensions/`
-   Los content scripts se actualizarán automáticamente
-   Para cambios en el background script, puede ser necesario recargar las pestañas activas

## 🎯 Funcionalidades

### Content Script

-   **Inyección Automática**: Se ejecuta automáticamente en `https://egela.ehu.eus/*`
-   **Componente React**: Interfaz interactiva superpuesta en la página
-   **Estado Persistente**: Mantiene el estado durante la navegación
-   **Diseño Responsivo**: Adaptable a diferentes tamaños de pantalla

### Popup de Extensión

-   **Acceso Rápido**: Click en el icono de la extensión
-   **Interfaz Intuitiva**: Controles para gestionar la extensión
-   **Comunicación Bidireccional**: Interactúa con content scripts y background

### Página de Opciones

-   **Configuración Avanzada**: Personalización detallada
-   **Almacenamiento Persistente**: Configuraciones guardadas en Chrome Storage
-   **Interfaz Familiar**: Integrada con el diseño de Chrome

## 🔧 Configuración Avanzada

### Manifest V3

El proyecto utiliza **Manifest V3**, la última versión del sistema de extensiones de Chrome:

-   **Service Workers** en lugar de background pages
-   **Declarative Net Request** para filtrado de red
-   **Permisos granulares** para mayor seguridad

### Plugin CRX

Utilizamos `@crxjs/vite-plugin` que proporciona:

-   **Hot Module Replacement** para development
-   **Bundle splitting** optimizado para extensiones
-   **Manejo automático** de assets y manifest
-   **Soporte completo** para React y TypeScript

### Estructura de Build

```
dist/
├── assets/                    # JS/CSS optimizados con hash
│   ├── content.tsx-loader-*.js    # Loader del content script
│   ├── content.tsx-*.js           # Bundle principal del content script
│   ├── background.ts-*.js         # Background service worker
│   └── *.js                       # Otros bundles (popup, options)
├── src/                       # HTML files
│   ├── popup/popup.html
│   └── options/options.html
├── service-worker-loader.js   # Loader del service worker
└── manifest.json              # Manifest procesado y optimizado
```

## 🐛 Debugging y Desarrollo

### DevTools

-   **Content Script**: F12 en la página web → Console/Sources
-   **Background Script**: `chrome://extensions/` → "Inspeccionar vistas" → "service worker"
-   **Popup**: Click derecho en popup → "Inspeccionar"
-   **Options**: F12 en la página de opciones

### Logs Comunes

```javascript
// En content script
console.log("Content script loaded:", window.location.href);

// En background script
console.log("Background script initialized");

// En popup
console.log("Popup opened");
```

### Problemas Comunes

1. **"Cannot use import statement"**: Resuelto con el plugin CRX
2. **Content script no se inyecta**: Verificar permisos en manifest.json
3. **Hot reload no funciona**: Recargar extensión manualmente

## 🤝 Contribución

### Workflow de Desarrollo

1. Fork del repositorio
2. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commits descriptivos: `git commit -m "feat: añadir nueva funcionalidad"`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abrir Pull Request

### Standards del Código

-   **ESLint** para linting
-   **Prettier** para formateo
-   **TypeScript strict mode** habilitado
-   **Conventional Commits** para mensajes

## 📝 Licencia

Este proyecto está bajo la **Licencia MIT**. Ver el archivo `LICENSE` para más detalles.

## 🔗 Enlaces Útiles

-   [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
-   [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/migrating/)
-   [React Documentation](https://reactjs.org/docs)
-   [Vite Documentation](https://vitejs.dev/guide/)
-   [CRX Plugin Documentation](https://crxjs.dev/vite-plugin)
