import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import "./bootstrap.css";
import { Course } from '../util/egela/Course';

const COURSE_VIEW_HREF = "https://egela.ehu.eus/course/view.php?id=";

// Componente que se renderiza en la página
const ExtensionContent: React.FC = () => {
    const [isVisible, setIsVisible] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(false);

    if (!window.location.href.includes(COURSE_VIEW_HREF)) return null;
    let courseId: string = window.location.href.replace(COURSE_VIEW_HREF, "");
    courseId = courseId.substring(0, courseId.includes("&") ? courseId.indexOf("&") : undefined);
    let courseData = JSON.parse(sessionStorage.getItem("-651322457/course/" + courseId + "/staticState") || "");
    let course: Course;
    chrome.runtime.sendMessage({ action: "getCourseData", courseData: courseData }).then(res => course = res);
    //chrome.runtime.sendMessage({ action: "getModelList" }, (response) => { console.log(response) });
    //chrome.runtime.sendMessage({ action: "generateSimpleResponse", prompt: "Hola! ¿Cómo te llamas?" }, (response) => { console.log(response) });

    if (!isVisible) return null;

    return (
        <div
            className="extension-sidebar"
            style={{
                position: 'fixed',
                top: '0',
                right: isCollapsed ? '-580px' : '0',
                width: '600px',
                height: '100vh',
                backgroundColor: '#ffffff',
                borderLeft: '1px solid #dee2e6',
                boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
                zIndex: '9999',
                transition: 'right 0.3s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'Inter, sans-serif'
            }}
        >
            {/* Botón para colapsar/expandir */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{
                    position: 'absolute',
                    left: '-40px',
                    top: '20px',
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px 0 0 4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    boxShadow: '-2px 0 8px rgba(0,0,0,0.1)'
                }}
                title={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            >
                {isCollapsed ? '◀' : '▶'}
            </button>

            {/* Header de la barra lateral */}
            <div
                style={{
                    padding: '16px',
                    borderBottom: '1px solid #dee2e6',
                    backgroundColor: '#f8f9fa'
                }}
            >
                <h3 style={{ margin: '0', fontSize: '18px', fontWeight: '600', color: '#212529' }}>
                    Asistente IA
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6c757d' }}>
                    Curso ID: {courseId}
                </p>
            </div>

            {/* Contenido principal de la barra lateral */}
            <div
                style={{
                    flex: '1',
                    padding: '16px',
                    overflowY: 'auto'
                }}
            >
                <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '500', color: '#212529' }}>
                        Herramientas
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                            className="btn btn-outline-primary btn-sm"
                            style={{ textAlign: 'left' }}
                            onClick={e => chrome.runtime.sendMessage({ action: "generateSimpleResponse", prompt: "Eres un asistente en una extensión de Chrome cuyo objetivo es resumir el contenido de la página para estudiantes de una universidad. A continuación tienes la estructura del curso para el que tienes que hacer un resumen para el estudiante. Haz el resumen directamente, sin saludar al usuari ni decir nada más.\n" + JSON.stringify(course) }).then((response) => { console.log(response) })}
                        >
                            📝 Resumir contenido
                        </button>
                        <button
                            className="btn btn-outline-secondary btn-sm"
                            style={{ textAlign: 'left' }}
                        >
                            💬 Hacer pregunta
                        </button>
                        <button
                            className="btn btn-outline-success btn-sm"
                            style={{ textAlign: 'left' }}
                        >
                            🔍 Analizar recursos
                        </button>
                    </div>
                </div>

                <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '500', color: '#212529' }}>
                        Estado
                    </h4>
                    <div
                        style={{
                            padding: '12px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            fontSize: '14px',
                            color: '#6c757d'
                        }}
                    >
                        Extensión cargada correctamente
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div
                style={{
                    padding: '16px',
                    borderTop: '1px solid #dee2e6',
                    backgroundColor: '#f8f9fa'
                }}
            >
                <button
                    onClick={() => setIsVisible(false)}
                    className="btn btn-outline-danger btn-sm"
                    style={{ width: '100%' }}
                >
                    Cerrar extensión
                </button>
            </div>
        </div>
    );
};

// Componente principal que maneja la inyección
const ContentApp: React.FC = () => {
    useEffect(() => {
        console.log('Extensión de Chrome cargada en:', window.location.href);

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