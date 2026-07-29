import React, { useState, useEffect, useContext, useMemo } from 'react';
import { LangContext } from '../components/Layout';
import { db, subscribeToCollection } from '../utils/storage';
import { Search, Calendar, Filter, Clock, Eye } from 'lucide-react';

// Helper to format date display: DD/MM/YYYY HH:MM:SS
const formatTimestamp = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${day}/${month}/${year} ${timeStr}`;
};

const History = () => {
    const { lang } = useContext(LangContext);
    const [logs, setLogs] = useState([]);
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState('ALL');
    const [moduleFilter, setModuleFilter] = useState('ALL');
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7); // Default to last 7 days
        return d.toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedLog, setSelectedLog] = useState(null);

    useEffect(() => {
        // Subscribe to audit logs (history collection)
        // Since we order by timestamp desc, let's pass null for range limits locally to avoid complex composite indexes on Firestore
        const unsub = subscribeToCollection('history', (data) => {
            setLogs(data);
        }, true);
        return () => unsub();
    }, []);

    // Filter logs in memory to be dynamic and avoid complex composite index errors
    const filteredLogs = useMemo(() => {
        const result = logs.filter(log => {
            // Search filter
            if (search) {
                const queryStr = search.toLowerCase();
                const matchesDetails = (log.details || '').toLowerCase().includes(queryStr);
                const matchesId = (log.docId || '').toLowerCase().includes(queryStr);
                if (!matchesDetails && !matchesId) return false;
            }

            // Action type filter
            if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;

            // Module filter
            if (moduleFilter !== 'ALL' && log.collectionName !== moduleFilter) return false;

            // Date filters
            const dateStr = log.timestamp 
                ? (log.timestamp.toDate ? log.timestamp.toDate().toISOString().split('T')[0] : new Date(log.timestamp).toISOString().split('T')[0])
                : '';
            
            if (fromDate && dateStr < fromDate) return false;
            if (toDate && dateStr > toDate) return false;

            return true;
        });

        // Sort chronologically timewise: newest first
        return result.sort((a, b) => {
            const timeA = a.timestamp 
                ? (a.timestamp.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime())
                : 0;
            const timeB = b.timestamp 
                ? (b.timestamp.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime())
                : 0;
            return timeB - timeA;
        });
    }, [logs, search, actionFilter, moduleFilter, fromDate, toDate]);

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

    const getActionStyle = (action) => {
        switch (action) {
            case 'CREATE':
                return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
            case 'UPDATE':
                return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' };
            case 'DELETE':
                return { bg: '#fee2e2', text: '#b91c1c', border: '#fecdd3' };
            case 'RESTORE':
                return { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff' };
            default:
                return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
        }
    };

    const LABEL_S = { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' };
    const INPUT_S = { padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 600, color: '#334155', background: '#fff', outline: 'none', transition: 'border-color 0.2s', width: '100%' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-sans)', minHeight: '80vh' }}>
            
            {/* Filter Dashboard Card */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <div style={{ flex: '1 1 200px' }}>
                    <label style={LABEL_S}>{lang === 'ta' ? 'தேடல்' : 'Search Details'}</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input 
                            type="text" 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                            placeholder={lang === 'ta' ? 'பெயர் அல்லது விவரம் மூலம் தேடுக...' : 'Search by name or details...'} 
                            style={INPUT_S}
                        />
                    </div>
                </div>
                
                <div style={{ width: '150px' }}>
                    <label style={LABEL_S}>{lang === 'ta' ? 'பிரிவு' : 'Module'}</label>
                    <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} style={INPUT_S}>
                        <option value="ALL">{lang === 'ta' ? 'அனைத்தும்' : 'All Modules'}</option>
                        <option value="buyers">{lang === 'ta' ? 'வாடிக்கையாளர்' : 'Customers'}</option>
                        <option value="farmers">{lang === 'ta' ? 'விவசாயி' : 'Farmers'}</option>
                        <option value="vendors">{lang === 'ta' ? 'விற்பனையாளர்' : 'Outside Vendors'}</option>
                        <option value="salesmen">{lang === 'ta' ? 'பணியாளர்' : 'Staff'}</option>
                        <option value="sales">{lang === 'ta' ? 'விற்பனை' : 'Sales'}</option>
                        <option value="outside_purchases">{lang === 'ta' ? 'கொள்முதல்' : 'Purchases'}</option>
                        <option value="intakes">{lang === 'ta' ? 'பூ உள்வருதல்' : 'Farmer Intakes'}</option>
                        <option value="payments">{lang === 'ta' ? 'பணம் செலுத்துதல்' : 'Payments'}</option>
                        <option value="salesman_expenses">{lang === 'ta' ? 'பணியாளர் செலவு' : 'Staff Expenses'}</option>
                        <option value="salesman_transfers">{lang === 'ta' ? 'பணியாளர் இடமாற்றம்' : 'Staff Transfers'}</option>
                        <option value="products">{lang === 'ta' ? 'பூ வகை' : 'Flower Types'}</option>
                    </select>
                </div>

                <div style={{ width: '140px' }}>
                    <label style={LABEL_S}>{lang === 'ta' ? 'செயல்பாடு' : 'Action'}</label>
                    <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={INPUT_S}>
                        <option value="ALL">{lang === 'ta' ? 'அனைத்தும்' : 'All Actions'}</option>
                        <option value="CREATE">{lang === 'ta' ? 'உருவாக்கப்பட்டது' : 'Create'}</option>
                        <option value="UPDATE">{lang === 'ta' ? 'மாற்றப்பட்டது' : 'Update'}</option>
                        <option value="DELETE">{lang === 'ta' ? 'நீக்கப்பட்டது' : 'Delete'}</option>
                        <option value="RESTORE">{lang === 'ta' ? 'மீட்டமைக்கப்பட்டது' : 'Restore'}</option>
                    </select>
                </div>

                <div style={{ width: '140px' }}>
                    <label style={LABEL_S}>{lang === 'ta' ? 'தொடக்க தேதி' : 'From Date'}</label>
                    <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={INPUT_S} />
                </div>

                <div style={{ width: '140px' }}>
                    <label style={LABEL_S}>{lang === 'ta' ? 'முடிவு தேதி' : 'To Date'}</label>
                    <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={INPUT_S} />
                </div>

                <button 
                    onClick={() => {
                        setSearch('');
                        setActionFilter('ALL');
                        setModuleFilter('ALL');
                        setFromDate('');
                        setToDate('');
                    }}
                    style={{
                        padding: '10px 16px', borderRadius: '8px', border: '1.5px solid #cbd5e1',
                        background: '#f8fafc', color: '#475569', fontSize: '13px', fontWeight: 800,
                        cursor: 'pointer', transition: 'all 0.2s', alignSelf: 'flex-end', height: '38px',
                        boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    {lang === 'ta' ? 'தெளிவுபடுத்து' : 'Clear Filters'}
                </button>
            </div>

            {/* Logs Table Card */}
            <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #cbd5e1', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1.5px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontWeight: 900, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📋 {lang === 'ta' ? 'அனைத்து செயல்பாடுகளின் பதிவுகள்' : 'Activity Logs History'}
                    </h3>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 800, background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px' }}>
                        {filteredLogs.length} {lang === 'ta' ? 'பதிவுகள்' : 'Entries'}
                    </span>
                </div>
                
                <div style={{ overflowX: 'auto', maxHeight: '60vh' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {lang === 'ta' ? 'தேதி மற்றும் நேரம்' : 'Date & Time'}
                                </th>
                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {lang === 'ta' ? 'பிரிவு' : 'Module'}
                                </th>
                                <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', width: '120px' }}>
                                    {lang === 'ta' ? 'செயல்' : 'Action'}
                                </th>
                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {lang === 'ta' ? 'விவரங்கள்' : 'Particulars/Description'}
                                </th>
                                <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', width: '80px' }}>
                                    {lang === 'ta' ? 'விவரம்' : 'Details'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', fontStyle: 'italic', color: '#94a3b8', fontSize: '14px' }}>
                                        {lang === 'ta' ? 'பதிவுகள் எதுவும் இல்லை.' : 'No audit log records matching the filters.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log, idx) => {
                                    const actionStyle = getActionStyle(log.action);
                                    return (
                                        <tr key={log.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafcfd' }}>
                                            <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Clock size={13} style={{ color: '#94a3b8' }} />
                                                    {formatTimestamp(log.timestamp)}
                                                </div>
                                            </td>
                                            <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 750, color: '#334155' }}>
                                                {getModuleLabel(log.collectionName)}
                                            </td>
                                            <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                                <span style={{ 
                                                    display: 'inline-block', padding: '2px 8px', borderRadius: '6px', 
                                                    fontSize: '11px', fontWeight: 900, textTransform: 'uppercase',
                                                    background: actionStyle.bg, color: actionStyle.text, 
                                                    border: `1px solid ${actionStyle.border}` 
                                                }}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 20px', fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
                                                {log.details}
                                            </td>
                                            <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    style={{
                                                        background: 'none', border: 'none', color: '#10b981', cursor: 'pointer',
                                                        padding: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'transform 0.2s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                    title={lang === 'ta' ? 'தரவை பார்க்கவும்' : 'View logged data'}
                                                >
                                                    <Eye size={16} />
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

            {/* View Details Modal */}
            {selectedLog && (
                <DetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} lang={lang} />
            )}

        </div>
    );
};

/* ── Log details viewer Modal ── */
const DetailsModal = ({ log, onClose, lang }) => {
    if (!log) return null;

    const data = log.data || {};
    
    const formatKey = (key) => {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
    };

    const formatValue = (key, val) => {
        if (val === null || val === undefined) return '—';
        if (Array.isArray(val)) {
            if (val.length === 0) return '—';
            if (typeof val[0] === 'object' && val[0] !== null) {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {val.map((item, index) => {
                            const name = lang === 'ta' ? (item.flowerTypeTa || item.flowerType) : (item.flowerType || item.flowerTypeTa);
                            const qty = item.quantity;
                            const rate = item.price || item.rate;
                            const total = item.total;
                            
                            const formattedQty = qty ? `${qty} kg` : '';
                            const formattedRate = rate ? ` @ ₹${parseFloat(rate).toLocaleString('en-IN')}` : '';
                            const formattedTotal = total ? ` = ₹${parseFloat(total).toLocaleString('en-IN')}` : '';
                            
                            return (
                                <div key={index} style={{ fontSize: '12.5px', color: '#1e293b' }}>
                                    <strong style={{ color: '#0f172a' }}>{name}</strong>: {formattedQty}{formattedRate}{formattedTotal}
                                </div>
                            );
                        })}
                    </div>
                );
            }
            return val.join(', ');
        }
        if (typeof val === 'object') {
            if (val.seconds) {
                return new Date(val.seconds * 1000).toLocaleString();
            }
            return JSON.stringify(val);
        }
        if (typeof val === 'boolean') {
            return val ? 'Yes' : 'No';
        }
        if (key === 'price' || key === 'rate' || key === 'cashLess' || key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('balance')) {
            if (!isNaN(val)) {
                return `₹${parseFloat(val).toLocaleString('en-IN')}`;
            }
        }
        return String(val);
    };

    const excludedKeys = ['tenantId', 'createdAt', 'updatedAt', 'timestamp', 'id'];
    const shouldExcludeKey = (key) => {
        if (excludedKeys.includes(key)) return true;
        const lowerKey = key.toLowerCase();
        if (lowerKey.endsWith('id') && lowerKey !== 'displayid') return true;
        return false;
    };

    const oldData = log.oldData;
    const isUpdate = log.action === 'UPDATE';

    const getDisplayFields = () => {
        if (isUpdate && oldData) {
            const changes = [];
            const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(data)]));
            
            allKeys.forEach(k => {
                if (shouldExcludeKey(k)) return;
                
                const oldVal = oldData[k];
                const newVal = data[k];
                
                const strOld = oldVal === undefined ? '' : JSON.stringify(oldVal);
                const strNew = newVal === undefined ? '' : JSON.stringify(newVal);
                
                if (strOld !== strNew) {
                    changes.push({
                        key: k,
                        oldVal,
                        newVal,
                        hasChange: true
                    });
                }
            });
            return changes;
        }

        return Object.entries(data)
            .filter(([k]) => !shouldExcludeKey(k))
            .map(([k, v]) => ({
                key: k,
                newVal: v,
                hasChange: false
            }));
    };

    const fieldsToDisplay = getDisplayFields();

    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
            zIndex: 1000, padding: '40px 20px', minHeight: '100%'
        }}>
            <div style={{
                background: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '550px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', boxSizing: 'border-box', position: 'sticky', top: '40px',
                maxHeight: 'calc(100vh - 80px)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexShrink: 0
                }}>
                    <h3 style={{ margin: 0, fontWeight: 900, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        👁️ {lang === 'ta' ? 'பதிவு தரவு விவரங்கள்' : 'Action Data Details'}
                    </h3>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                        width: '30px', height: '30px', color: '#fff', fontSize: '16px', fontWeight: 800,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s'
                    }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                       onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}>
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {lang === 'ta' ? 'விளக்கம்' : 'Summary Description'}
                            </span>
                            <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                                {log.details}
                            </div>
                        </div>
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {lang === 'ta' ? 'தேதி & நேரம்' : 'Date & Time'}
                                </span>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginTop: '2px' }}>
                                    ⏰ {formatTimestamp(log.timestamp)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                        <tbody>
                            {fieldsToDisplay.length === 0 ? (
                                <tr>
                                    <td colSpan={2} style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                                        {lang === 'ta' ? 'மாற்றங்கள் எதுவும் கண்டறியப்படவில்லை.' : 'No changes detected.'}
                                    </td>
                                </tr>
                            ) : (
                                fieldsToDisplay.map((field) => (
                                    <tr key={field.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '10px 0', fontWeight: 800, color: '#475569', width: '40%' }}>
                                            {formatKey(field.key)}
                                        </td>
                                        <td style={{ padding: '10px 0', width: '60%', wordBreak: 'break-all' }}>
                                            {field.hasChange ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ color: '#ef4444', textDecoration: 'line-through', fontSize: '12.5px', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px' }}>
                                                        {formatValue(field.key, field.oldVal)}
                                                    </span>
                                                    <span style={{ color: '#64748b', fontWeight: 800 }}>➔</span>
                                                    <span style={{ color: '#16a34a', fontWeight: 800, background: '#f0fdf4', padding: '2px 6px', borderRadius: '4px' }}>
                                                        {formatValue(field.key, field.newVal)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span style={{ fontWeight: 650, color: '#0f172a' }}>
                                                    {formatValue(field.key, field.newVal)}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1.5px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{
                        padding: '10px 24px', borderRadius: '12px', border: '1.5px solid #cbd5e1',
                        background: '#ffffff', color: '#475569', fontSize: '13px', fontWeight: 800,
                        cursor: 'pointer', transition: 'all 0.2s'
                    }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                       onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>
                        {lang === 'ta' ? 'மூடு' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default History;
