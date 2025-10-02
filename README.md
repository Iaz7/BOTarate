# Chrome Extension with React and TypeScript

Este proyecto es una extensión de Chrome que utiliza TypeScript y React para modificar dinámicamente una página web específica. La extensión incluye una ventana emergente y una página de opciones para la configuración.

## Estructura del Proyecto

```
chrome-extension-vite
├── src
│   ├── background
│   │   └── background.ts
│   ├── content
│   │   └── content.tsx
│   ├── popup
│   │   ├── popup.tsx
│   │   └── popup.html
│   ├── options
│   │   ├── options.tsx
│   │   └── options.html
│   └── types
│       └── index.ts
├── public
│   └── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Instalación

1. Clona el repositorio:
   ```
   git clone <URL_DEL_REPOSITORIO>
   cd chrome-extension-vite
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

## Desarrollo

Para iniciar el entorno de desarrollo, ejecuta:
```
npm run dev
```

Esto iniciará el servidor de desarrollo y podrás ver los cambios en tiempo real.

## Construcción

Para construir la extensión para producción, ejecuta:
```
npm run build
```

Los archivos generados se encontrarán en la carpeta `dist`.

## Carga de la Extensión en Chrome

1. Abre Chrome y ve a `chrome://extensions/`.
2. Activa el "Modo de desarrollador" en la esquina superior derecha.
3. Haz clic en "Cargar descomprimida" y selecciona la carpeta `dist`.

## Uso

- Haz clic en el icono de la extensión para abrir la ventana emergente.
- Accede a la página de opciones para configurar la extensión según tus necesidades.

## Contribuciones

Las contribuciones son bienvenidas. Si deseas contribuir, por favor abre un issue o envía un pull request.

## Licencia

Este proyecto está bajo la licencia MIT.