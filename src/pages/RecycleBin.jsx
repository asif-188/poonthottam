import React, { useState, useEffect, useContext, useMemo } from 'react';
import { LangContext } from '../components/Layout';
import { db, subscribeToCollection, restoreDocument } from '../utils/storage';
import { RotateCcw, Trash2, Calendar, Search, AlertCircle } from 'lucide-react';

const RecycleBin = () => {
    const { lang, t } = useContext(LangContext);
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState('');
    const [isRestoring, setIsRestoring] = useState({});

    useEffect(() => {
        const unsub = subscribeToCollection('recycle_bin', (data) => {
            setItems(data);
        }, true);

        const handleGlobalSearch = (e) => {
            setSearch(e.detail);
        };
        window.addEventListener('global-voice-search', handleGlobalSearch);

        return () => {
            unsub();
            window.removeEventListener('global-voice-search', handleGlobalSearch);
        };
    }, []);

    // Filter in-memory to discard expired docs (>30 days) and apply search filter
    const activeItems = useMemo(() => {
        const now = new Date().getTime();
        const result = items.filter(item => {
            // Filter out expired items
            if (item.expiryDate) {
                const expTime = item.expiryDate.toDate ? item.expiryDate.toDate().getTime() : new Date(item.expiryDate).getTime();
                if (now > expTime) return false;
            }

            // Search filter
            if (search) {
                const queryStr = search.toLowerCase();
                const matchesDetails = (item.details || '').toLowerCase().includes(queryStr);
                const matchesId = (item.originalId || '').toLowerCase().includes(queryStr);
                if (!matchesDetails && !matchesId) return false;
            }

            return true;
        });

        // Sort chronologically timewise: newest first
        return result.sort((a, b) => {
            const timeA = a.deletedAt 
                ? (a.deletedAt.toDate ? a.deletedAt.toDate().getTime() : new Date(a.deletedAt).getTime())
                : 0;
            const timeB = b.deletedAt 
                ? (b.deletedAt.toDate ? b.deletedAt.toDate().getTime() : new Date(b.deletedAt).getTime())
                : 0;
            return timeB - timeA;
        });
    }, [items, search]);

    const handleRestore = async (id, details) => {
        if (!window.confirm(lang === 'ta' ? `இந்த பதிவை மீட்டமைக்க வேண்டுமா?\n"${details}"` : `Are you sure you want to restore this entry?\n"${details}"`)) {
            return;
        }

        setIsRestoring(prev => ({ ...prev, [id]: true }));
        try {
            await restoreDocument(id);
            alert(lang === 'ta' ? '✓ பதிவு வெற்றிகரமாக மீட்டமைக்கப்பட்டது!' : '✓ Entry successfully restored!');
        } catch (e) {
            alert('❌ Restore failed: ' + e.message);
        } finally {
            setIsRestoring(prev => ({ ...prev, [id]: false }));
        }
    };

    // Calculate remaining days
    const getDaysRemaining = (expiryDate) => {
        if (!expiryDate) return '';
        const expTime = expiryDate.toDate ? expiryDate.toDate().getTime() : new Date(expiryDate).getTime();
        const diffMs = expTime - new Date().getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 0) return lang === 'ta' ? 'காலாவதியானது' : 'Expired';
        return lang === 'ta' ? `${diffDays} நாட்கள் மீதமுள்ளன` : `${diffDays} days left`;
    };

    // Translate collection/module name to readable label
    const getModuleLabel = (colName) => {
        const mapping = {
            buyers: lang === 'ta' ? 'வாடிக்கையாளர்' : 'Customers',
            farmers: lang === 'ta' ? 'விவசாயி' : 'Farmers',
            vendors: lang === 'ta' ? 'விற்பனையாளர்' : 'Outside Vendors',
            salesmen: lang === 'ta' ? 'பணியாளர்' : 'Staff',
            sales: lang === 'ta' ? 'விற்பனை' : 'Sales',
            outside_purchases: lang === 'ta' ? 'கொள்முதல்' : 'Purchases',
            intakes: lang === 'ta' ? 'பூ உள்வருதல்' : 'Farmer Intakes',
            payments: lang === 'ta' ? 'பணம் செலுத்துதல்' : 'Payments',
            salesman_expenses: lang === 'ta' ? 'பணியாளர் செலவு' : 'Staff Expenses',
            salesman_transfers: lang === 'ta' ? 'பணியாளர் இடமாற்றம்' : 'Staff Transfers',
            products: lang === 'ta' ? 'பூ வகை' : 'Flower Types',
        };
        return mapping[colName] || colName;
    };

    const formatTimestamp = (ts) => {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(d.getTime())) return '';
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${day}/${month}/${year} ${timeStr}`;
    };

    const LABEL_S = { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' };
    const INPUT_S = { padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 600, color: '#334155', background: '#fff', outline: 'none', transition: 'border-color 0.2s', width: '100%' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-sans)', minHeight: '80vh' }}>
            
            {/* Warning Alert Banner */}
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertCircle style={{ color: '#d97706', flexShrink: 0 }} size={20} />
                <p style={{ margin: 0, fontSize: '13px', color: '#b45309', fontWeight: 650 }}>
                    ⚠️ {lang === 'ta' 
                        ? 'இங்கு நீக்கப்பட்ட பதிவுகள் 30 நாட்களுக்கு பாதுகாப்பாக வைக்கப்படும். 30 நாட்களுக்குப் பிறகு அவை நிரந்தரமாக நீக்கப்படும்.' 
                        : 'Deleted items will be stored here safely for 30 days before being permanently purged.'}
                </p>
            </div>

            {/* Filter Dashboard Card */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <div style={{ flex: '1 1 300px' }}>
                    <label style={LABEL_S}>{lang === 'ta' ? 'தேடல்' : 'Search Bin'}</label>
                    <input 
                        type="text" 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        placeholder={lang === 'ta' ? 'பெயர் அல்லது விவரம் மூலம் தேடுக...' : 'Search by name or details...'} 
                        style={INPUT_S}
                    />
                </div>
                {search && (
                    <button 
                        onClick={() => setSearch('')}
                        style={{
                            padding: '10px 16px', borderRadius: '8px', border: '1.5px solid #cbd5e1',
                            background: '#f8fafc', color: '#475569', fontSize: '13px', fontWeight: 800,
                            cursor: 'pointer', height: '38px', boxSizing: 'border-box'
                        }}
                    >
                        {lang === 'ta' ? 'தெளிவுபடுத்து' : 'Clear'}
                    </button>
                )}
            </div>

            {/* Bin Table Card */}
            <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #cbd5e1', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontWeight: 900, color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🗑️ {lang === 'ta' ? 'குப்பைத் தொட்டி பதிவுகள்' : 'Recycle Bin items'}
                    </h3>
                    <span style={{ fontSize: '12px', color: '#b45309', fontWeight: 800, background: '#fef3c7', padding: '4px 10px', borderRadius: '6px' }}>
                        {activeItems.length} {lang === 'ta' ? 'பதிவுகள்' : 'Items'}
                    </span>
                </div>
                
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {lang === 'ta' ? 'நீக்கப்பட்ட தேதி' : 'Deleted At'}
                                </th>
                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {lang === 'ta' ? 'பிரிவு' : 'Original Module'}
                                </th>
                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {lang === 'ta' ? 'விவரங்கள்' : 'Particulars/Description'}
                                </th>
                                <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', width: '150px' }}>
                                    {lang === 'ta' ? 'மீதமுள்ள நாட்கள்' : 'Days Left'}
                                </th>
                                <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', width: '120px' }}>
                                    {lang === 'ta' ? 'செயல்' : 'Restore'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeItems.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', fontStyle: 'italic', color: '#94a3b8', fontSize: '14px' }}>
                                        {lang === 'ta' ? 'குப்பைத் தொட்டி காலியாக உள்ளது.' : 'Recycle bin is empty.'}
                                    </td>
                                </tr>
                            ) : (
                                activeItems.map((item, idx) => {
                                    const daysText = getDaysRemaining(item.expiryDate);
                                    const isExpired = daysText.includes('Expired') || daysText.includes('காலாவதியானது');
                                    return (
                                        <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafcfd' }}>
                                            <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                                                {formatTimestamp(item.deletedAt)}
                                            </td>
                                            <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 750, color: '#334155' }}>
                                                {getModuleLabel(item.collectionName)}
                                            </td>
                                            <td style={{ padding: '14px 20px', fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
                                                {item.details || 'Deleted item'}
                                            </td>
                                            <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                                <span style={{ 
                                                    display: 'inline-block', padding: '2px 8px', borderRadius: '6px', 
                                                    fontSize: '11px', fontWeight: 900,
                                                    background: isExpired ? '#fee2e2' : '#fef3c7',
                                                    color: isExpired ? '#b91c1c' : '#b45309',
                                                }}>
                                                    {daysText}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleRestore(item.id, item.details)}
                                                    disabled={isRestoring[item.id] || isExpired}
                                                    style={{
                                                        padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #10b981',
                                                        background: '#ecfdf5', color: '#047857', fontSize: '12px', fontWeight: 800,
                                                        cursor: (isRestoring[item.id] || isExpired) ? 'not-allowed' : 'pointer',
                                                        opacity: (isRestoring[item.id] || isExpired) ? 0.6 : 1,
                                                        transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '4px'
                                                    }}
                                                >
                                                    <RotateCcw size={12} />
                                                    {isRestoring[item.id] ? '...' : (lang === 'ta' ? 'மீட்டமை' : 'Restore')}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default RecycleBin;
