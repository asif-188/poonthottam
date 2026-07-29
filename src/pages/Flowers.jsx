import React, { useState, useEffect, useRef, useContext } from 'react';
import { Plus, Edit2, Trash2, X, Flower2, Mic, MicOff } from 'lucide-react';
import { subscribeToCollection, saveProduct, deleteProduct, db } from '../utils/storage';
import { LangContext } from '../components/Layout';

const S = {
    page: {
        background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)', padding: '28px 32px',
        minHeight: '60vh', fontFamily: 'var(--font-sans)',
    },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' },
    title: { fontSize: '22px', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0 },
    btnAdd: {
        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px',
        borderRadius: '8px', border: '1.5px solid #16a34a', background: '#fff',
        color: '#16a34a', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
        fontFamily: 'var(--font-sans)', transition: 'all 0.18s',
    },
    th: {
        padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700,
        color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em',
        borderBottom: '1.5px solid #e5e7eb', background: '#fff', whiteSpace: 'nowrap',
    },
    td: { padding: '13px 14px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
    input: {
        width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0',
        background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b',
        outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
    },
};

const INPUT_S = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1.5px solid #cbd5e1',
  background: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  color: '#1e293b',
  outline: 'none',
  transition: 'all 0.2s',
  boxSizing: 'border-box',
};

const LABEL_S = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 800,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
};

const Flowers = () => {
    const { t, lang } = useContext(LangContext);
    const [flowers, setFlowers]       = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing]        = useState(null);   // null = add, else flower object
    const [form, setForm]              = useState({ name: '', taName: '', unit: 'kg' });
    const [isSaving, setIsSaving]      = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const transTimeout = useRef(null);
    const [touched, setTouched] = useState({ name: false, taName: false });
    const nameRef = useRef(null);

    const [listeningField, setListeningField] = useState(null); // null, 'name', or 'taName'
    const recognitionRef = useRef(null);

    // Speech Recognition setup
    useEffect(() => {
        if (!isModalOpen) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        if (!listeningField) {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
            return;
        }

        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = listeningField === 'name' ? 'en-IN' : 'ta-IN';

        rec.onstart = () => {
            // Speech started
        };

        rec.onresult = (e) => {
            const alternative = e.results[0][0];
            const confidence = alternative.confidence;
            const resultText = alternative.transcript;

            if (confidence < 0.45) {
                console.log(`Speech ignored due to low confidence (${confidence}): ${resultText}`);
                setListeningField(null);
                if (window.toast) {
                    window.toast.warning(lang === 'ta' ? 'குரல் தெளிவாக இல்லை. மீண்டும் முயற்சிக்கவும்.' : 'Speech was not clear. Please try again.');
                } else {
                    alert(lang === 'ta' ? '❌ குரல் தெளிவாக இல்லை. மீண்டும் முயற்சிக்கவும்.' : '❌ Speech was not clear. Please try again.');
                }
                return;
            }

            const activeField = listeningField;
            setListeningField(null);
            handleVoiceInput(resultText, activeField);
        };

        rec.onerror = (e) => {
            console.error('Speech recognition error:', e.error);
            setListeningField(null);
            if (e.error === 'not-allowed') {
                alert(lang === 'ta' ? '❌ மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது!' : '❌ Microphone permission denied!');
            } else if (e.error === 'no-speech') {
                alert(lang === 'ta' ? '❌ பேச்சு எதுவும் கண்டறியப்படவில்லை' : '❌ No speech detected');
            } else {
                alert((lang === 'ta' ? '❌ பிழை: ' : '❌ Error: ') + e.error);
            }
        };

        rec.onend = () => {
            setListeningField(null);
        };

        recognitionRef.current = rec;

        try {
            rec.start();
        } catch (err) {
            console.error('Failed to start speech recognition:', err);
            setListeningField(null);
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, [isModalOpen, listeningField, lang]);

    const toggleListening = async (field) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert(lang === 'ta' ? '❌ உங்கள் உலாவியில் குரல் அங்கீகாரம் ஆதரிக்கப்படவில்லை' : '❌ Speech recognition is not supported in this browser.');
            return;
        }

        const isActivating = listeningField !== field;
        if (isActivating) {
            try {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(track => track.stop());
                }
            } catch (err) {
                console.error('Microphone access failed:', err);
                alert(lang === 'ta' ? '❌ மைக்ரோஃபோன் அனுமதி தேவை!' : '❌ Microphone permission required!');
                return;
            }
        }

        setListeningField(prev => prev === field ? null : field);
    };

    const triggerAutoTranslate = (val, source) => {
        const target = source === 'name' ? 'taName' : 'name';
        const fromLang = source === 'name' ? 'en' : 'ta';
        const toLang = source === 'name' ? 'ta' : 'en';

        if (!touched[target] && val.trim().length > 2) {
            if (transTimeout.current) clearTimeout(transTimeout.current);
            transTimeout.current = setTimeout(async () => {
                setIsTranslating(true);
                const translated = await translate(val, fromLang, toLang);
                if (translated && !touched[target]) {
                    setForm(prev => ({ ...prev, [target]: translated }));
                }
                setIsTranslating(false);
            }, 800);
        }
    };

    const handleAutoTranslate = (val, source) => {
        setForm(prev => ({ ...prev, [source]: val }));
        triggerAutoTranslate(val, source);
    };

    const handleVoiceInput = (text, field) => {
        if (!text) return;
        let cleanName = text.replace(/\s+/g, ' ').trim();

        if (field === 'name') {
            // Capitalize English flower names properly (e.g., "rose" → "Rose")
            cleanName = cleanName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

            setTouched(prev => ({ ...prev, name: true }));
            setForm(prev => ({
                ...prev,
                name: cleanName
            }));
            triggerAutoTranslate(cleanName, 'name');
        } else if (field === 'taName') {
            setTouched(prev => ({ ...prev, taName: true }));
            setForm(prev => ({
                ...prev,
                taName: cleanName
            }));
            triggerAutoTranslate(cleanName, 'taName');
        }
    };

    useEffect(() => {
        const unsub = subscribeToCollection('products', setFlowers);
        return () => unsub();
    }, []);

    const translate = async (text, from, to) => {
        if (!text || text.length < 2) return '';
        try {
            const resp = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
            const data = await resp.json();
            return data[0][0][0];
        } catch { return ''; }
    };


    const openModal = (flower = null) => {
        setTouched({ name: false, taName: false });
        if (flower) {
            setEditing(flower);
            setForm({ name: flower.name || '', taName: flower.taName || '', unit: flower.unit || 'kg' });
        } else {
            setEditing(null);
            setForm({ name: '', taName: '', unit: 'kg' });
        }
        setIsModalOpen(true);
        setTimeout(() => nameRef.current?.focus(), 80);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || isSaving) return;

        const nameLower = form.name.trim().toLowerCase();
        const taNameLower = form.taName.trim().toLowerCase();

        // Check for duplicates in English or Tamil names (ignoring self if editing)
        const isDuplicate = flowers.some(f => {
            if (editing && f.id === editing.id) return false;
            const matchEn = f.name?.trim().toLowerCase() === nameLower;
            const matchTa = taNameLower && f.taName?.trim().toLowerCase() === taNameLower;
            return matchEn || matchTa;
        });

        if (isDuplicate) {
            alert(lang === 'ta' ? '❌ இந்தப் பூவின் பெயர் ஏற்கனவே உள்ளது!' : '❌ A flower with this name already exists!');
            return;
        }

        setIsSaving(true);
        try {
            await saveProduct({
                id: editing?.id,
                name: form.name.trim(),
                taName: form.taName.trim(),
                unit: form.unit,
            });
            setIsModalOpen(false);
        } catch (err) {
            alert('❌ Failed: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        console.log("handleDelete called for flower ID:", id);
        if (!window.confirm('Delete this flower variety?')) {
            console.log("Deletion cancelled by user.");
            return;
        }
        try {
            console.log("Triggering database delete for ID:", id);
            await deleteProduct(id);
            console.log("Database delete completed successfully.");
        }
        catch (err) {
            console.error("Database delete failed with error:", err);
            alert('❌ Delete failed: ' + err.message);
        }
    };

    return (
        <div style={S.page}>
            {/* Header */}
            <div style={S.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>🌸</span>
                    <h2 style={S.title}>{lang === 'ta' ? 'பூக்கள் மாஸ்டர்' : 'Flower Master'}</h2>
                </div>
                <button style={S.btnAdd} onClick={() => openModal()}
                    onMouseEnter={e => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#16a34a'; }}
                >
                    <Plus size={14} /> {lang === 'ta' ? 'பூச் சேர்க்க' : 'Add Flower'}
                </button>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={S.th}>#</th>
                            <th style={S.th}>{lang === 'ta' ? 'பூவின் பெயர்' : 'Flower Name'}</th>
                            <th style={S.th}>{lang === 'ta' ? 'தமிழ் பெயர்' : 'Tamil Name'}</th>
                            <th style={S.th}>{lang === 'ta' ? 'அலகு' : 'Unit'}</th>
                            <th style={{ ...S.th, textAlign: 'center' }}>{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {flowers.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '60px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '14px' }}>
                                    No flower varieties added yet. Click "Add Flower" to get started.
                                </td>
                            </tr>
                        ) : (
                            flowers.map((f, idx) => (
                                <tr key={f.id}
                                    style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa'}
                                >
                                    <td style={{ ...S.td, color: '#9ca3af', fontWeight: 600, width: '48px' }}>{idx + 1}</td>
                                    <td style={{ ...S.td, fontWeight: 700, color: '#1e293b' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '16px' }}>🌸</span> {f.name}
                                        </div>
                                    </td>
                                    <td style={{ ...S.td, color: '#64748b' }}>{f.taName || '—'}</td>
                                    <td style={S.td}>
                                        <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '100px' }}>
                                            {f.unit || 'kg'}
                                        </span>
                                    </td>
                                    <td style={{ ...S.td, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                            <button onClick={() => openModal(f)}
                                                style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#eff6ff', color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#3b82f6'; }}
                                            ><Edit2 size={13} /></button>
                                            <button onClick={() => handleDelete(f.id)}
                                                style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#fff1f2', color: '#f43f5e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#f43f5e'; e.currentTarget.style.color = '#fff'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#f43f5e'; }}
                                            ><Trash2 size={13} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Tip */}
            {flowers.length > 0 && (
                <div style={{ marginTop: '20px', padding: '12px 16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', fontSize: '12px', color: '#15803d', fontWeight: 600 }}>
                    ✅ {flowers.length} flower {flowers.length === 1 ? 'variety' : 'varieties'} available — these appear in the Sales entry dropdown automatically.
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <form
                        onSubmit={handleSave}
                        style={{
                            background: '#ffffff',
                            borderRadius: '24px',
                            width: '100%',
                            maxWidth: '440px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            border: '1px solid #e2e8f0',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxSizing: 'border-box'
                        }}
                    >
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid #f1f5f9',
                            background: '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxSizing: 'border-box'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '18px' }}>🌸</span>
                                <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', margin: 0, fontFamily: 'var(--font-display)' }}>
                                    {editing ? (lang === 'ta' ? 'பூவைத் திருத்து' : 'Edit Flower Master') : (lang === 'ta' ? 'பூச் சேர்க்க' : 'Add New Flower')}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                style={{
                                    border: 'none',
                                    background: 'none',
                                    padding: '6px',
                                    borderRadius: '8px',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#334155'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{
                            padding: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            boxSizing: 'border-box'
                        }}>
                            {/* Name */}
                            <div>
                                <label style={LABEL_S}>
                                    {lang === 'ta' ? 'பூவின் பெயர் (ஆங்கிலத்தில்) *' : 'Flower Name (English) *'}
                                    {listeningField === 'name' && (
                                        <span style={{ marginLeft: '8px', color: '#ef4444', textTransform: 'none', fontSize: '10px', fontWeight: 'bold' }} className="animate-pulse">
                                            🎙️ {lang === 'ta' ? 'கேட்கிறது...' : 'Listening...'}
                                        </span>
                                    )}
                                </label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        ref={nameRef}
                                        type="text"
                                        required
                                        placeholder={lang === 'ta' ? 'எ.கா. Rose, Jasmine...' : 'e.g. Rose, Jasmine...'}
                                        value={form.name}
                                        onChange={e => {
                                            setTouched(p => ({ ...p, name: true }));
                                            handleAutoTranslate(e.target.value, 'name');
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                                        style={{ ...INPUT_S, paddingRight: '40px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleListening('name')}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            border: 'none',
                                            background: listeningField === 'name' ? '#fef2f2' : 'none',
                                            padding: '6px',
                                            borderRadius: '8px',
                                            color: listeningField === 'name' ? '#ef4444' : '#94a3b8',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                        title={lang === 'ta' ? 'குரல் உள்ளீடு' : 'Voice Input'}
                                    >
                                        {listeningField === 'name' ? <MicOff size={16} className="animate-pulse" /> : <Mic size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Tamil Name */}
                            <div>
                                <label style={LABEL_S}>
                                    {lang === 'ta' ? 'தமிழ் பெயர் (விருப்பமானது)' : 'Tamil Name (optional)'}
                                    {listeningField === 'taName' && (
                                        <span style={{ marginLeft: '8px', color: '#ef4444', textTransform: 'none', fontSize: '10px', fontWeight: 'bold' }} className="animate-pulse">
                                            🎙️ {lang === 'ta' ? 'கேட்கிறது...' : 'Listening...'}
                                        </span>
                                    )}
                                </label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        placeholder={lang === 'ta' ? 'எ.கா. ரோஜா, மல்லி...' : 'e.g. ரோஜா, மல்லி...'}
                                        value={form.taName}
                                        onChange={e => {
                                            setTouched(p => ({ ...p, taName: true }));
                                            handleAutoTranslate(e.target.value, 'taName');
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                                        style={{ ...INPUT_S, paddingRight: '40px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleListening('taName')}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            border: 'none',
                                            background: listeningField === 'taName' ? '#fef2f2' : 'none',
                                            padding: '6px',
                                            borderRadius: '8px',
                                            color: listeningField === 'taName' ? '#ef4444' : '#94a3b8',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                        title={lang === 'ta' ? 'குரல் உள்ளீடு' : 'Voice Input'}
                                    >
                                        {listeningField === 'taName' ? <MicOff size={16} className="animate-pulse" /> : <Mic size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Unit */}
                            <div>
                                <label style={LABEL_S}>
                                    {lang === 'ta' ? 'அளவீட்டு அலகு' : 'Unit of Measurement'}
                                </label>
                                <select
                                    value={form.unit}
                                    onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                                    style={INPUT_S}
                                >
                                    <option value="kg">{lang === 'ta' ? 'கிலோ (kg)' : 'kg'}</option>
                                    <option value="g">{lang === 'ta' ? 'கிராம் (g)' : 'grams'}</option>
                                    <option value="bunch">{lang === 'ta' ? 'கட்டு' : 'bunch'}</option>
                                    <option value="piece">{lang === 'ta' ? 'பீஸ்' : 'piece'}</option>
                                    <option value="dozen">{lang === 'ta' ? 'டஜன்' : 'dozen'}</option>
                                    <option value="meter">{lang === 'ta' ? 'மீட்டர்' : 'meter'}</option>
                                </select>
                            </div>
                            {isTranslating && <div style={{ fontSize: '11px', color: '#16a34a', fontStyle: 'italic' }}>🌐 Translating...</div>}
                        </div>

                        <div style={{
                            padding: '16px 24px',
                            borderTop: '1px solid #f1f5f9',
                            background: '#f8fafc',
                            display: 'flex',
                            justifyContent: 'end',
                            gap: '10px',
                            boxSizing: 'border-box'
                        }}>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                style={{
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    color: '#475569',
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-sans)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; }}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                style={{
                                    background: '#10b981',
                                    border: 'none',
                                    color: '#ffffff',
                                    padding: '10px 24px',
                                    borderRadius: '12px',
                                    fontWeight: 800,
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-sans)',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#059669'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#10b981'; }}
                            >
                                {isSaving ? (lang === 'ta' ? 'சேமிக்கிறது...' : 'Saving...') : (editing ? t('update') : (lang === 'ta' ? 'பூச் சேர்க்க' : 'Add Flower'))}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Flowers;
