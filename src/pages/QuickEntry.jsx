import React, { useState, useEffect, useRef, useContext } from 'react';
import { db, saveFarmer, saveBuyer, savePayment, subscribeToCollection } from '../utils/storage';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import { Plus, User, Calendar, CheckCircle2, Mic, Settings } from 'lucide-react';
import VoiceEntryModal from '../components/VoiceEntryModal';

const S = {
    page: {
        background: '#fff',
        borderRadius: '24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        padding: '32px',
        minHeight: '75vh',
        fontFamily: 'var(--font-sans)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
        gap: '16px',
        flexWrap: 'wrap',
    },
    titleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    title: {
        fontSize: '24px',
        fontWeight: 900,
        color: '#1e293b',
        letterSpacing: '-0.02em',
        fontFamily: 'var(--font-display)',
        margin: 0,
    },
    label: {
        display: 'block',
        fontSize: '12px',
        fontWeight: 800,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: '8px',
    },
    input: {
        width: '100%',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1.5px solid #e2e8f0',
        background: '#fff',
        fontSize: '14px',
        fontWeight: 600,
        color: '#1e293b',
        outline: 'none',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box',
    },
    btnSubmit: {
        padding: '14px 28px',
        borderRadius: '12px',
        border: 'none',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        color: '#fff',
        fontWeight: 800,
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'transform 0.15s, opacity 0.15s',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        boxShadow: '0 4px 12px rgba(16,185,129,0.2)',
    },
    select: {
        padding: '12px 16px',
        borderRadius: '12px',
        border: '2px solid #10b981',
        background: '#fff',
        fontSize: '14px',
        fontWeight: 750,
        color: '#15803d',
        outline: 'none',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(16,185,129,0.08)',
    },
    alert: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '14px 20px',
        borderRadius: '12px',
        background: '#ecfdf5',
        border: '1px solid #a7f3d0',
        color: '#065f46',
        fontSize: '14px',
        fontWeight: 700,
        marginBottom: '24px',
        animation: 'fadeIn 0.3s ease',
    }
};

const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

const QuickEntry = () => {
    const { t, lang } = useContext(LangContext);
    const [entryType, setEntryType] = useState('farmer'); // 'farmer', 'buyer', 'cash_pay', 'cash_receive'
    
    // Subscribed collections
    const [farmers, setFarmers] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const u1 = subscribeToCollection('farmers', setFarmers);
        const u2 = subscribeToCollection('buyers', setBuyers);
        return () => { u1(); u2(); };
    }, []);

    // Form states
    const [farmerForm, setFarmerForm] = useState({ name: '', contact: '', balance: '0' });
    const [customerForm, setCustomerForm] = useState({ name: '', nameTa: '', contact: '', place: '', placeTa: '', balance: '0', balanceDate: toDateStr(new Date()) });
    const [payForm, setPayForm] = useState({ entityId: '', amount: '', cashLess: '', method: 'Cash', note: '', date: toDateStr(new Date()) });
    const [receiveForm, setReceiveForm] = useState({ entityId: '', amount: '', cashLess: '', method: 'Cash', note: '', date: toDateStr(new Date()) });

    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
    const getVoiceModalType = () => {
        if (entryType === 'cash_pay') return 'cash_pay';
        if (entryType === 'cash_receive') return 'cash_receive';
        return 'cash_receive';
    };
    
    const getVoiceModalEntities = () => {
        if (entryType === 'cash_pay') return farmers;
        if (entryType === 'cash_receive') return buyers;
        return [];
    };

    const handleVoiceConfirm = (payload) => {
        const vType = getVoiceModalType();
        if (vType === 'cash_pay') {
            const { entity, amount, cashLess, note, method } = payload;
            setPayForm(prev => ({
                ...prev,
                entityId: entity?.id || '',
                amount: amount ? String(amount) : '',
                cashLess: cashLess ? String(cashLess) : '',
                note: note || '',
                method: method || 'Cash'
            }));
            if (entity) setFarmerSearch(entity.name);
        } else if (vType === 'cash_receive') {
            const { entity, amount, cashLess, note, method } = payload;
            setReceiveForm(prev => ({
                ...prev,
                entityId: entity?.id || '',
                amount: amount ? String(amount) : '',
                cashLess: cashLess ? String(cashLess) : '',
                note: note || '',
                method: method || 'Cash'
            }));
            if (entity) setCustomerSearch(entity.name);
        }
    };

    // Dropdown search states
    const [farmerSearch, setFarmerSearch] = useState('');
    const [isFarmerDropdownOpen, setIsFarmerDropdownOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

    // Auto translate timers/refs
    const transTimeout = useRef(null);

    const translate = async (text, from, to) => {
        if (!text || text.length < 2) return '';
        try {
            const resp = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
            const data = await resp.json();
            return data[0][0][0];
        } catch { return ''; }
    };

    const handleAutoTranslate = (val, source) => {
        let target, fromLang, toLang;
        if (source === 'name' || source === 'nameTa') {
            target = source === 'name' ? 'nameTa' : 'name';
            fromLang = source === 'name' ? 'en' : 'ta';
            toLang = source === 'name' ? 'ta' : 'en';
        } else if (source === 'place' || source === 'placeTa') {
            target = source === 'place' ? 'placeTa' : 'place';
            fromLang = source === 'place' ? 'en' : 'ta';
            toLang = source === 'place' ? 'ta' : 'en';
        }

        setCustomerForm(prev => ({ ...prev, [source]: val }));

        if (transTimeout.current) clearTimeout(transTimeout.current);
        transTimeout.current = setTimeout(async () => {
            const translated = await translate(val, fromLang, toLang);
            if (translated) {
                setCustomerForm(prev => ({ ...prev, [target]: translated }));
            }
        }, 600);
    };

    const showNotification = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 4000);
    };

    // Farmer Form submit
    const handleSubmitFarmer = async (e) => {
        e.preventDefault();
        if (isSaving || !farmerForm.name.trim()) return;
        setIsSaving(true);
        try {
            await saveFarmer({
                name: farmerForm.name.trim(),
                contact: farmerForm.contact.trim() || '',
                balance: parseFloat(farmerForm.balance) || 0
            });
            showNotification(lang === 'ta' ? 'விவசாயி வெற்றிகரமாகச் சேர்க்கப்பட்டார்!' : 'Farmer added successfully!');
            setFarmerForm({ name: '', contact: '', balance: '0' });
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Customer Form submit
    const handleSubmitCustomer = async (e) => {
        e.preventDefault();
        if (isSaving || !customerForm.name.trim()) return;
        setIsSaving(true);
        try {
            const nextId = buyers.length > 0 ? Math.max(...buyers.map(b => parseInt(b.displayId) || 0)) + 1 : 101;
            const buyerToSave = {
                name: customerForm.name.trim(),
                nameTa: customerForm.nameTa.trim() || customerForm.name.trim(),
                contact: customerForm.contact.trim() || '',
                place: customerForm.place.trim() || '',
                placeTa: customerForm.placeTa.trim() || customerForm.place.trim(),
                balance: parseFloat(customerForm.balance) || 0,
                balanceDate: customerForm.balance ? (customerForm.balanceDate || toDateStr(new Date())) : '',
                displayId: nextId
            };
            await saveBuyer(buyerToSave);
            showNotification(lang === 'ta' ? 'வாடிக்கையாளர் வெற்றிகரமாகச் சேர்க்கப்பட்டார்!' : 'Customer added successfully!');
            setCustomerForm({ name: '', nameTa: '', contact: '', place: '', placeTa: '', balance: '0', balanceDate: toDateStr(new Date()) });
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Cash Pay Form submit
    const handleSubmitCashPay = async (e) => {
        e.preventDefault();
        if (isSaving || !payForm.entityId || !payForm.amount) return;
        setIsSaving(true);
        try {
            const amountNum = parseFloat(payForm.amount || 0);
            const cashLessNum = parseFloat(payForm.cashLess || 0);
            const entityRef = doc(db, 'farmers', payForm.entityId);
            
            await savePayment({
                entityId: payForm.entityId,
                amount: amountNum,
                cashLess: cashLessNum,
                method: payForm.method,
                note: payForm.note || '',
                date: payForm.date,
                type: 'farmer',
                timestamp: new Date(payForm.date).toISOString()
            });
            await updateDoc(entityRef, { balance: increment(-(amountNum + cashLessNum)) });
            
            showNotification(lang === 'ta' ? 'பணப்பட்டுவாடா வெற்றிகரமாகப் பதிவு செய்யப்பட்டது!' : 'Cash Payment logged successfully!');
            setPayForm({ entityId: '', amount: '', cashLess: '', method: 'Cash', note: '', date: toDateStr(new Date()) });
            setFarmerSearch('');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Cash Receive Form submit
    const handleSubmitCashReceive = async (e) => {
        e.preventDefault();
        if (isSaving || !receiveForm.entityId || !receiveForm.amount) return;
        setIsSaving(true);
        try {
            const amountNum = parseFloat(receiveForm.amount || 0);
            const cashLessNum = parseFloat(receiveForm.cashLess || 0);
            const entityRef = doc(db, 'buyers', receiveForm.entityId);
            
            await savePayment({
                entityId: receiveForm.entityId,
                amount: amountNum,
                cashLess: cashLessNum,
                method: receiveForm.method,
                note: receiveForm.note || '',
                date: receiveForm.date,
                type: 'buyer',
                timestamp: new Date(receiveForm.date).toISOString()
            });
            await updateDoc(entityRef, { balance: increment(-(amountNum + cashLessNum)) });
            
            showNotification(lang === 'ta' ? 'பண வரவு வெற்றிகரமாகப் பதிவு செய்யப்பட்டது!' : 'Cash Receive logged successfully!');
            setReceiveForm({ entityId: '', amount: '', cashLess: '', method: 'Cash', note: '', date: toDateStr(new Date()) });
            setCustomerSearch('');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Search drop selections
    const filteredFarmers = farmers.filter(f =>
        f.name.toLowerCase().includes(farmerSearch.toLowerCase())
    );

    const filteredBuyers = buyers.filter(b =>
        b.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        b.displayId?.toString().includes(customerSearch)
    );

    return (
        <div style={S.page} className="animate-in fade-in duration-300">
            {/* Header */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <div style={{ width: '48px', height: '48px', bg: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ecfdf5', color: '#10b981', fontSize: '24px' }}>
                        ⚡
                    </div>
                    <div>
                        <h2 style={S.title}>{lang === 'ta' ? 'விரைவு பதிவு' : 'Quick Entry'}</h2>
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>{lang === 'ta' ? 'அனைத்து முக்கிய பதிவுகளையும் ஒரே இடத்தில் வேகமாகப் பதிவு செய்ய' : 'Consolidated panel for fast transactions entry.'}</span>
                    </div>
                </div>

                <div>
                    <select 
                        value={entryType} 
                        onChange={e => {
                            setEntryType(e.target.value);
                            setMessage('');
                        }} 
                        style={S.select}
                    >
                        <option value="farmer">👨🌾 {lang === 'ta' ? 'விவசாயி சேர்' : 'Add Farmer'}</option>
                        <option value="buyer">👥 {lang === 'ta' ? 'வாடிக்கையாளர் சேர்' : 'Add Customer'}</option>
                        <option value="cash_pay">💸 {lang === 'ta' ? 'விவசாயிக்கு பணம் (Cash Pay)' : 'Cash Pay (Farmer)'}</option>
                        <option value="cash_receive">📥 {lang === 'ta' ? 'வாடிக்கையாளர் வரவு (Cash Rec)' : 'Cash Receive (Customer)'}</option>
                    </select>
                </div>
            </div>

            {/* Notification alert */}
            {message && (
                <div style={S.alert}>
                    <CheckCircle2 size={18} />
                    <span>{message}</span>
                </div>
            )}

            <div style={{ maxWidth: '600px', background: '#f8fafc', padding: '32px', borderRadius: '20px', border: '1.5px solid #f1f5f9' }}>
                
                {/* ────────────────── ADD FARMER ────────────────── */}
                {entryType === 'farmer' && (
                    <form onSubmit={handleSubmitFarmer} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            👨🌾 {lang === 'ta' ? 'புதிய விவசாயி பதிவு' : 'Add New Farmer'}
                        </h3>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'விவசாயி பெயர்' : 'Farmer Name'}</label>
                            <input 
                                type="text"
                                style={S.input}
                                placeholder="Full Name"
                                value={farmerForm.name}
                                onChange={e => setFarmerForm({ ...farmerForm, name: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'தொடர்பு எண்' : 'Contact Number'}</label>
                            <input 
                                type="text"
                                style={S.input}
                                placeholder="Mobile number"
                                value={farmerForm.contact}
                                onChange={e => setFarmerForm({ ...farmerForm, contact: e.target.value })}
                            />
                        </div>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'ஆரம்ப நிலுவை தொகை (₹)' : 'Initial Balance (Old Dues)'}</label>
                            <input 
                                type="number"
                                style={S.input}
                                placeholder="0.00"
                                value={farmerForm.balance}
                                onChange={e => setFarmerForm({ ...farmerForm, balance: e.target.value })}
                            />
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            <button type="submit" style={S.btnSubmit} disabled={isSaving}>
                                {isSaving ? 'Saving...' : (lang === 'ta' ? 'விவசாயி சேமி' : 'Save Farmer')}
                            </button>
                        </div>
                    </form>
                )}

                {/* ────────────────── ADD CUSTOMER ────────────────── */}
                {entryType === 'buyer' && (
                    <form onSubmit={handleSubmitCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            👥 {lang === 'ta' ? 'புதிய வாடிக்கையாளர் பதிவு' : 'Add New Customer'}
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'ஆனகில பெயர்' : 'Customer Name (EN)'}</label>
                                <input 
                                    type="text"
                                    style={S.input}
                                    placeholder="English Name"
                                    value={customerForm.name}
                                    onChange={e => handleAutoTranslate(e.target.value, 'name')}
                                    required
                                />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'தமிழ் பெயர்' : 'Customer Name (TA)'}</label>
                                <input 
                                    type="text"
                                    style={S.input}
                                    placeholder="தமிழ் பெயர்"
                                    value={customerForm.nameTa}
                                    onChange={e => setCustomerForm({ ...customerForm, nameTa: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'தொடர்பு எண்' : 'Contact Number'}</label>
                            <input 
                                type="text"
                                style={S.input}
                                placeholder="Mobile number"
                                value={customerForm.contact}
                                onChange={e => setCustomerForm({ ...customerForm, contact: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'ஊர் (ஆங்கிலம்)' : 'Place (EN)'}</label>
                                <input 
                                    type="text"
                                    style={S.input}
                                    placeholder="Place name"
                                    value={customerForm.place}
                                    onChange={e => handleAutoTranslate(e.target.value, 'place')}
                                />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'ஊர் (தமிழ்)' : 'Place (TA)'}</label>
                                <input 
                                    type="text"
                                    style={S.input}
                                    placeholder="ஊர் பெயர்"
                                    value={customerForm.placeTa}
                                    onChange={e => setCustomerForm({ ...customerForm, placeTa: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'பழைய நிலுவை தொகை (₹)' : 'Old Balance (₹)'}</label>
                                <input 
                                    type="number"
                                    style={S.input}
                                    placeholder="0"
                                    value={customerForm.balance}
                                    onChange={e => setCustomerForm({ ...customerForm, balance: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'நிலுவை தேதி' : 'Balance Date'}</label>
                                <input 
                                    type="date"
                                    style={S.input}
                                    value={customerForm.balanceDate}
                                    onChange={e => setCustomerForm({ ...customerForm, balanceDate: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: '10px' }}>
                            <button type="submit" style={S.btnSubmit} disabled={isSaving}>
                                {isSaving ? 'Saving...' : (lang === 'ta' ? 'வாடிக்கையாளர் சேமி' : 'Save Customer')}
                            </button>
                        </div>
                    </form>
                )}

                {/* ────────────────── CASH PAY (FARMER) ────────────────── */}
                {entryType === 'cash_pay' && (
                    <form onSubmit={handleSubmitCashPay} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>💸 {lang === 'ta' ? 'விவசாயிக்கு பணம் வழங்குதல்' : 'Record Farmer Cash Payment'}</span>
                            <button
                                type="button"
                                onClick={() => setIsVoiceModalOpen(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#ecfdf5',
                                    color: '#059669',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Mic size={14} /> {lang === 'ta' ? 'குரல் உள்ளீடு' : 'Voice Input'}
                            </button>
                        </h3>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'தேதி' : 'Date'}</label>
                            <input 
                                type="date"
                                style={S.input}
                                value={payForm.date}
                                onChange={e => setPayForm({ ...payForm, date: e.target.value })}
                                required
                            />
                        </div>

                        {/* Searchable dropdown for farmer selection */}
                        <div style={{ position: 'relative' }}>
                            <label style={S.label}>{lang === 'ta' ? 'விவசாயி தேர்ந்தெடுக்கவும்' : 'Select Farmer'}</label>
                            <input 
                                type="text"
                                style={S.input}
                                placeholder={payForm.entityId ? farmers.find(f => f.id === payForm.entityId)?.name || '' : 'Type to search farmer...'}
                                value={payForm.entityId ? '' : farmerSearch}
                                onChange={e => {
                                    setFarmerSearch(e.target.value);
                                    setPayForm({ ...payForm, entityId: '' });
                                    setIsFarmerDropdownOpen(true);
                                }}
                                onFocus={() => setIsFarmerDropdownOpen(true)}
                            />
                            {isFarmerDropdownOpen && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 110, background: '#fff', borderRadius: '10px', border: '1.5px solid #e2e8f0', marginTop: '4px', maxHeight: '180px', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                                    {filteredFarmers.length > 0 ? (
                                        filteredFarmers.map(f => (
                                            <div 
                                                key={f.id}
                                                onClick={() => {
                                                    setPayForm({ ...payForm, entityId: f.id });
                                                    setIsFarmerDropdownOpen(false);
                                                    setFarmerSearch('');
                                                }}
                                                style={{ padding: '10px 14px', cursor: 'pointer', fontWeight: 600, borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                            >
                                                {f.name} (Dues: ₹{f.balance || 0})
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ padding: '10px 14px', color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>No matching farmers.</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'செலுத்திய தொகை (₹)' : 'Amount Paid (₹)'}</label>
                                <input 
                                    type="number"
                                    style={S.input}
                                    placeholder="0"
                                    value={payForm.amount}
                                    onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'தள்ளுபடி (Cash Less)' : 'Discount / Cash Less (₹)'}</label>
                                <input 
                                    type="number"
                                    style={S.input}
                                    placeholder="0"
                                    value={payForm.cashLess}
                                    onChange={e => setPayForm({ ...payForm, cashLess: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'செலுத்தும் வழி' : 'Payment Method'}</label>
                                <select 
                                    value={payForm.method} 
                                    onChange={e => setPayForm({ ...payForm, method: e.target.value })}
                                    style={S.input}
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="GPay">GPay</option>
                                    <option value="PhonePe">PhonePe</option>
                                    <option value="Paytm">Paytm</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'குறிப்பு' : 'Short Note'}</label>
                                <input 
                                    type="text"
                                    style={S.input}
                                    placeholder="e.g. advance, weekly pay"
                                    value={payForm.note}
                                    onChange={e => setPayForm({ ...payForm, note: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: '10px' }}>
                            <button type="submit" style={S.btnSubmit} disabled={isSaving || !payForm.entityId}>
                                {isSaving ? 'Saving...' : (lang === 'ta' ? 'பதிவு செய்' : 'Log Payment')}
                            </button>
                        </div>
                    </form>
                )}

                {/* ────────────────── CASH RECEIVE (CUSTOMER) ────────────────── */}
                {entryType === 'cash_receive' && (
                    <form onSubmit={handleSubmitCashReceive} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>📥 {lang === 'ta' ? 'வாடிக்கையாளரிடமிருந்து பண வரவு' : 'Record Customer Cash Receive'}</span>
                            <button
                                type="button"
                                onClick={() => setIsVoiceModalOpen(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#ecfdf5',
                                    color: '#059669',
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Mic size={14} /> {lang === 'ta' ? 'குரல் உள்ளீடு' : 'Voice Input'}
                            </button>
                        </h3>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'தேதி' : 'Date'}</label>
                            <input 
                                type="date"
                                style={S.input}
                                value={receiveForm.date}
                                onChange={e => setReceiveForm({ ...receiveForm, date: e.target.value })}
                                required
                            />
                        </div>

                        {/* Searchable dropdown for buyer selection */}
                        <div style={{ position: 'relative' }}>
                            <label style={S.label}>{lang === 'ta' ? 'வாடிக்கையாளர் தேர்ந்தெடுக்கவும்' : 'Select Customer'}</label>
                            <input 
                                type="text"
                                style={S.input}
                                placeholder={receiveForm.entityId ? buyers.find(b => b.id === receiveForm.entityId)?.name || '' : 'Type to search customer...'}
                                value={receiveForm.entityId ? '' : customerSearch}
                                onChange={e => {
                                    setCustomerSearch(e.target.value);
                                    setReceiveForm({ ...receiveForm, entityId: '' });
                                    setIsCustomerDropdownOpen(true);
                                }}
                                onFocus={() => setIsCustomerDropdownOpen(true)}
                            />
                            {isCustomerDropdownOpen && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 110, background: '#fff', borderRadius: '10px', border: '1.5px solid #e2e8f0', marginTop: '4px', maxHeight: '180px', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                                    {filteredBuyers.length > 0 ? (
                                        filteredBuyers.map(b => (
                                            <div 
                                                key={b.id}
                                                onClick={() => {
                                                    setReceiveForm({ ...receiveForm, entityId: b.id });
                                                    setIsCustomerDropdownOpen(false);
                                                    setCustomerSearch('');
                                                }}
                                                style={{ padding: '10px 14px', cursor: 'pointer', fontWeight: 600, borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                                            >
                                                #{b.displayId} - {b.name} (Ta: {b.nameTa || '---'})
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ padding: '10px 14px', color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>No matching customers.</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'வரவு தொகை (₹)' : 'Amount Received (₹)'}</label>
                                <input 
                                    type="number"
                                    style={S.input}
                                    placeholder="0"
                                    value={receiveForm.amount}
                                    onChange={e => setReceiveForm({ ...receiveForm, amount: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'தள்ளுபடி (Cash Less)' : 'Discount / Cash Less (₹)'}</label>
                                <input 
                                    type="number"
                                    style={S.input}
                                    placeholder="0"
                                    value={receiveForm.cashLess}
                                    onChange={e => setReceiveForm({ ...receiveForm, cashLess: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'பெற்ற வழி' : 'Payment Method'}</label>
                                <select 
                                    value={receiveForm.method} 
                                    onChange={e => setReceiveForm({ ...receiveForm, method: e.target.value })}
                                    style={S.input}
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="GPay">GPay</option>
                                    <option value="PhonePe">PhonePe</option>
                                    <option value="Paytm">Paytm</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'குறிப்பு' : 'Short Note'}</label>
                                <input 
                                    type="text"
                                    style={S.input}
                                    placeholder="e.g. partial pay, diwali bonus"
                                    value={receiveForm.note}
                                    onChange={e => setReceiveForm({ ...receiveForm, note: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: '10px' }}>
                            <button type="submit" style={S.btnSubmit} disabled={isSaving || !receiveForm.entityId}>
                                {isSaving ? 'Saving...' : (lang === 'ta' ? 'வரவு பதிவு செய்' : 'Log Receive')}
                            </button>
                        </div>
                    </form>
                )}

            <VoiceEntryModal
                isOpen={isVoiceModalOpen}
                onClose={() => setIsVoiceModalOpen(false)}
                onConfirm={handleVoiceConfirm}
                entities={getVoiceModalEntities()}
                type={getVoiceModalType()}
                langSetting={lang}
            />
            </div>
        </div>
    );
};

export default QuickEntry;
