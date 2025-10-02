import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Componente que se renderiza en la página
const ExtensionContent: React.FC = () => {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 10000,
            backgroundColor: '#fff',
            border: '2px solid #007acc',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '300px',
            fontFamily: 'Arial, sans-serif'
        }}>
            <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#007acc' }}>Mi Extensión</h3>
                <button
                    onClick={() => setIsVisible(false)}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '18px',
                        cursor: 'pointer',
                        color: '#666'
                    }}
                >
                    ×
                </button>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#333' }}>
                ¡Hola! Este contenido se ha añadido dinámicamente a la página PHP usando React.
            </p>
            <button style={{
                backgroundColor: '#007acc',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
            }}>
                Acción de ejemplo
            </button>
        </div>
    );
};

// Componente principal que maneja la inyección
const ContentApp: React.FC = () => {
    useEffect(() => {
        console.log('Extensión de Chrome cargada en:', window.location.href);

        // Aquí puedes añadir lógica específica para detectar páginas PHP
        // o hacer modificaciones específicas al DOM de la página

        return () => {
            console.log('Extensión de Chrome descargada');
        };
    }, []);

    return <ExtensionContent />;
};

// Crear el punto de montaje para la extensión
const mountPoint = document.createElement('div');
mountPoint.id = 'chrome-extension-react-root';
document.body.appendChild(mountPoint);

// Renderizar la extensión usando React 18
const root = createRoot(mountPoint);
root.render(<ContentApp />);