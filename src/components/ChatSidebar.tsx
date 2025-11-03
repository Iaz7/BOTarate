import React, { useState } from 'react';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    id: string;
}

interface ChatSidebarProps {
    courseName: string;
    providerName: string;
    modelName: string;
    onClose: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ 
    courseName, 
    providerName, 
    modelName, 
    onClose 
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState<boolean>(false);

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isGenerating) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: inputValue,
            id: `user-${Date.now()}`
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsGenerating(true);

        try {
            const response = await chrome.runtime.sendMessage({ 
                action: "generateResponse",
                userMessage: inputValue,
                resetHistory: messages.length === 0
            });

            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: response,
                id: `assistant-${Date.now()}`
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error generating response:', error);
            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: 'Error al generar la respuesta. Por favor, inténtalo de nuevo.',
                id: `error-${Date.now()}`
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

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

            {/* Header */}
            <div className="card-header bg-light border-bottom">
                <h3 className="h5 mb-2">💬 Asistente IA</h3>
                <p className="small text-muted mb-1">
                    <strong>Curso:</strong> {courseName}
                </p>
                <p className="small text-muted mb-0">
                    <strong>Proveedor:</strong> {providerName} | <strong>Modelo:</strong> {modelName}
                </p>
            </div>

            {/* Área de chat */}
            <div
                style={{
                    flex: '1',
                    overflowY: 'auto',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}
            >
                {messages.length === 0 ? (
                    <div className="alert alert-info" role="alert">
                        👋 ¡Hola! Pregúntame sobre el curso y te ayudaré.
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`card ${message.role === 'user' ? 'bg-primary text-white' : ''}`}
                        >
                            <div className="card-body p-2">
                                <div className="small mb-1">
                                    <strong>{message.role === 'user' ? '👤 Tú' : '🤖 Asistente'}</strong>
                                </div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
                            </div>
                        </div>
                    ))
                )}

                {isGenerating && (
                    <div className="card border-secondary">
                        <div className="card-body p-2">
                            <div className="d-flex align-items-center">
                                <div className="spinner-border spinner-border-sm me-2" aria-label="Generando respuesta">
                                    <span className="visually-hidden">Cargando...</span>
                                </div>
                                <span className="small">Generando respuesta...</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input de chat */}
            <div className="card-footer bg-light border-top">
                <div className="input-group">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Escribe tu pregunta..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isGenerating}
                    />
                    <button
                        className="btn btn-primary"
                        type="button"
                        onClick={handleSendMessage}
                        disabled={isGenerating || !inputValue.trim()}
                    >
                        Enviar
                    </button>
                </div>
                <button
                    onClick={onClose}
                    className="btn btn-outline-danger btn-sm w-100 mt-2"
                >
                    Cerrar extensión
                </button>
            </div>
        </div>
    );
};

export default ChatSidebar;
