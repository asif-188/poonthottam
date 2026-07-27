import React, { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

const VoiceSearchButton = ({ onSpeechResult, langSetting = 'en' }) => {
    const [isListening, setIsListening] = useState(false);

    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isListening) {
            setIsListening(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Web Speech API is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = langSetting === 'ta' ? 'ta-IN' : 'en-IN';

        rec.onstart = () => {
            setIsListening(true);
        };

        rec.onresult = (event) => {
            let resultText = event.results[0][0].transcript;
            
            // Clean up queries (ignore leading filler words in English/Tamil)
            const cleanQuery = resultText
                .replace(/^(search for|find|look up|show|தேடு|காட்டு|please)\s+/i, '')
                .replace(/\.$/, '')
                .trim();
            
            onSpeechResult(cleanQuery);
        };

        rec.onerror = (err) => {
            console.error('Search speech error:', err.error);
        };

        rec.onend = () => {
            setIsListening(false);
        };

        rec.start();
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                color: isListening ? '#ef4444' : '#9ca3af',
                borderRadius: '50%',
                transition: 'all 0.2s',
                outline: 'none',
                boxSizing: 'border-box'
            }}
            title={langSetting === 'ta' ? 'குரல் மூலம் தேடு' : 'Search by Voice'}
        >
            {isListening ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MicOff size={16} style={{ animation: 'micPulse 1.2s infinite' }} />
                    <style>{`
                        @keyframes micPulse {
                            0% { transform: scale(1); opacity: 1; }
                            50% { transform: scale(1.2); opacity: 0.7; color: #dc2626; }
                            100% { transform: scale(1); opacity: 1; }
                        }
                    `}</style>
                </div>
            ) : (
                <Mic size={16} />
            )}
        </button>
    );
};

export default VoiceSearchButton;
