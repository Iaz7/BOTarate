# Chrome Extension con React, TypeScript y Vite

Este proyecto es una extensión de Chrome moderna construida con **React**, **TypeScript** y **Vite**. La extensión modifica dinámicamente páginas web específicas (https://egela.ehu.eus/*) inyectando componentes React interactivos. Incluye una arquitectura completa con background script, content script, popup y página de opciones.

## 🏗️ Estructura del Proyecto

```
chrome-extension-vite/
├── src/                          # Código fuente
│   ├── background/               # Background Service Worker
│   │   └── background.ts         # Lógica del service worker
│   ├── content/                  # Content Scripts
│   │   ├── content.tsx          # Componente React inyectado en la página
│   │   └── index.tsx            # Punto de entrada del content script
│   ├── popup/                    # Extensión Popup
│   │   ├── popup.html           # HTML del popup
│   │   ├── popup.tsx            # Componente React del popup
│   │   └── index.tsx            # Punto de entrada del popup
│   ├── options/                  # Página de Opciones
│   │   ├── options.html         # HTML de la página de opciones
│   │   ├── options.tsx          # Componente React de opciones
│   │   └── index.tsx            # Punto de entrada de opciones
│   └── types/                    # Definiciones TypeScript
│       └── index.ts             # Types compartidos
├── public/                       # Archivos estáticos
│   └── manifest.json            # Manifest V3 de Chrome Extension
├── dist/                         # Archivos construidos (generado)
│   ├── assets/                  # Assets compilados y optimizados
│   ├── src/                     # HTML files copiados
│   └── manifest.json            # Manifest procesado
├── package.json                  # Dependencias y scripts NPM
├── tsconfig.json                # Configuración TypeScript
├── vite.config.ts               # Configuración Vite con plugin CRX
└── README.md                    # Documentación del proyecto
```

## 🔧 Tecnologías Utilizadas

- **[React 18](https://reactjs.org/)** - Biblioteca para interfaces de usuario
- **[TypeScript](https://www.typescriptlang.org/)** - Tipado estático para JavaScript
- **[Vite](https://vitejs.dev/)** - Build tool y dev server ultrarrápido
- **[@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)** - Plugin especializado para Chrome Extensions
- **Chrome Extension Manifest V3** - Última versión del sistema de extensiones

## 📁 Descripción de Componentes

### Background Script (`src/background/`)
- **background.ts**: Service worker que se ejecuta en segundo plano
- Maneja eventos globales de la extensión
- Gestiona la comunicación entre diferentes partes de la extensión

### Content Script (`src/content/`)
- **content.tsx**: Componente React que se inyecta en las páginas web
- Se ejecuta en el contexto de la página visitada (https://egela.ehu.eus/*)
- Modifica dinámicamente el DOM de la página
- Incluye UI interactiva con botones y estados

### Popup (`src/popup/`)
- **popup.html**: Estructura HTML del popup
- **popup.tsx**: Interfaz React del popup de la extensión
- **index.tsx**: Punto de entrada que monta el componente React
- Se abre al hacer clic en el icono de la extensión

### Options (`src/options/`)
- **options.html**: Página HTML de configuración
- **options.tsx**: Interfaz React para configurar la extensión
- **index.tsx**: Punto de entrada de la página de opciones
- Accesible desde chrome://extensions/

### Types (`src/types/`)
- **index.ts**: Definiciones de tipos TypeScript compartidas
- Interfaces y tipos para mantener consistencia en el proyecto

## 🚀 Instalación y Configuración

### Prerrequisitos
- **Node.js** (versión 16 o superior)
- **npm** o **yarn**
- **Google Chrome** (para pruebas)

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
- Inicia el servidor de desarrollo con hot-reload
- Los cambios se reflejan automáticamente
- Ideal para desarrollo iterativo

### Construcción para Producción
```bash
npm run build
```
- Compila y optimiza todos los assets
- Genera la carpeta `dist/` lista para producción
- Utiliza el plugin CRX para crear bundles compatibles con Chrome

### Verificación de Tipos
```bash
npm run type-check
```
- Ejecuta verificación de tipos TypeScript
- No genera archivos, solo valida el código

## 📦 Instalación en Chrome

### Modo Desarrollador (Recomendado para desarrollo)
1. Abre Chrome y navega a `chrome://extensions/`
2. Activa el **"Modo de desarrollador"** (toggle en la esquina superior derecha)
3. Haz clic en **"Cargar descomprimida"**
4. Selecciona la carpeta `dist/` del proyecto
5. La extensión aparecerá en la lista y estará lista para usar

### Recarga de la Extensión
- Después de cada `npm run build`, haz clic en el botón de **recarga** (🔄) en `chrome://extensions/`
- Los content scripts se actualizarán automáticamente
- Para cambios en el background script, puede ser necesario recargar las pestañas activas

## 🎯 Funcionalidades

### Content Script
- **Inyección Automática**: Se ejecuta automáticamente en `https://egela.ehu.eus/*`
- **Componente React**: Interfaz interactiva superpuesta en la página
- **Estado Persistente**: Mantiene el estado durante la navegación
- **Diseño Responsivo**: Adaptable a diferentes tamaños de pantalla

### Popup de Extensión
- **Acceso Rápido**: Click en el icono de la extensión
- **Interfaz Intuitiva**: Controles para gestionar la extensión
- **Comunicación Bidireccional**: Interactúa con content scripts y background

### Página de Opciones
- **Configuración Avanzada**: Personalización detallada
- **Almacenamiento Persistente**: Configuraciones guardadas en Chrome Storage
- **Interfaz Familiar**: Integrada con el diseño de Chrome

## 🔧 Configuración Avanzada

### Manifest V3
El proyecto utiliza **Manifest V3**, la última versión del sistema de extensiones de Chrome:
- **Service Workers** en lugar de background pages
- **Declarative Net Request** para filtrado de red
- **Permisos granulares** para mayor seguridad

### Plugin CRX
Utilizamos `@crxjs/vite-plugin` que proporciona:
- **Hot Module Replacement** para development
- **Bundle splitting** optimizado para extensiones
- **Manejo automático** de assets y manifest
- **Soporte completo** para React y TypeScript

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
- **Content Script**: F12 en la página web → Console/Sources
- **Background Script**: `chrome://extensions/` → "Inspeccionar vistas" → "service worker"
- **Popup**: Click derecho en popup → "Inspeccionar"
- **Options**: F12 en la página de opciones

### Logs Comunes
```javascript
// En content script
console.log('Content script loaded:', window.location.href);

// En background script  
console.log('Background script initialized');

// En popup
console.log('Popup opened');
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
- **ESLint** para linting
- **Prettier** para formateo
- **TypeScript strict mode** habilitado
- **Conventional Commits** para mensajes

## 📝 Licencia

Este proyecto está bajo la **Licencia MIT**. Ver el archivo `LICENSE` para más detalles.

## 🔗 Enlaces Útiles

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/migrating/)
- [React Documentation](https://reactjs.org/docs)
- [Vite Documentation](https://vitejs.dev/guide/)
- [CRX Plugin Documentation](https://crxjs.dev/vite-plugin)