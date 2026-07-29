import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

const VoiceSearchButton = ({ onSpeechResult, langSetting = 'en' }) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    const handleClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isListening) {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
            setIsListening(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Web Speech API is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
            }
        } catch (err) {
            console.error('Search voice permission failed:', err);
            if (window.toast) {
                window.toast.error(langSetting === 'ta' ? 'மைக்ரோஃபோன் அனுமதி தேவை!' : 'Microphone permission required!');
            } else {
                alert(langSetting === 'ta' ? '❌ மைக்ரோஃபோன் அனுமதி தேவை!' : '❌ Microphone permission required!');
            }
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
            const alternative = event.results[0][0];
            const confidence = alternative.confidence;
            const resultText = alternative.transcript;

            if (confidence < 0.45) {
                console.log(`Search speech ignored due to low confidence (${confidence}): ${resultText}`);
                if (window.toast) {
                    window.toast.warning(langSetting === 'ta' ? 'குரல் தெளிவாக இல்லை. மீண்டும் முயற்சிக்கவும்.' : 'Speech was not clear. Please try again.');
                }
                return;
            }
            
            // Clean up queries (ignore leading filler words in English/Tamil)
            const cleanQuery = resultText
                .replace(/^(search for|find|look up|show|தேடு|காட்டு|please)\s+/i, '')
                .replace(/\.$/, '')
                .trim();
            
            onSpeechResult(cleanQuery);
        };

        rec.onerror = (err) => {
            console.error('Search speech error:', err.error);
            setIsListening(false);
        };

        rec.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = rec;
        rec.start();
    };

    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, []);

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
