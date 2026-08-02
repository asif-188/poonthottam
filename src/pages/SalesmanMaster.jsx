import React, { useState, useEffect, useRef, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Edit2, Trash2, Search, X, User, Download, Upload } from 'lucide-react';
import { saveSalesman, deleteSalesman, subscribeToCollection } from '../utils/storage';
import { LangContext } from '../components/Layout';
import * as XLSX from 'xlsx';
import VoiceSearchButton from '../components/VoiceSearchButton';


const S = {
    page: {
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        padding: '28px 32px',
        minHeight: '70vh',
        fontFamily: 'var(--font-sans)',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px', gap: '16px', flexWrap: 'wrap',
    },
    titleRow: {
        display: 'flex', alignItems: 'center', gap: '10px',
    },
    titleCol: {
        display: 'flex', flexDirection: 'column',
    },
    title: {
        fontSize: '22px', fontWeight: 800, color: '#1e293b',
        letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', margin: 0,
    },
    subtitle: {
        fontSize: '11px', fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px',
    },
    actions: {
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
    },
    btnTemplate: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', borderRadius: '8px',
        border: '1.5px solid #d1d5db', background: '#f9fafb',
        color: '#374151', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    btnImport: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', borderRadius: '8px',
        border: '1.5px solid #d1d5db', background: '#f9fafb',
        color: '#374151', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
        position: 'relative',
    },
    btnExport: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', borderRadius: '8px',
        border: '1.5px solid #d1d5db', background: '#f9fafb',
        color: '#374151', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    btnAdd: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 18px', borderRadius: '8px',
        border: '1.5px solid #6366f1', background: '#ffffff',
        color: '#6366f1', fontSize: '13px', fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    searchWrap: {
        position: 'relative', marginBottom: '24px', maxWidth: '380px',
    },
    searchInput: {
        width: '100%', padding: '10px 16px 10px 40px',
        border: '1.5px solid #e2e8f0', borderRadius: '100px',
        background: '#fff', outline: 'none', fontSize: '14px',
        color: '#374151', fontFamily: 'var(--font-sans)',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box',
    },
    searchIcon: {
        position: 'absolute', left: '14px', top: '50%',
        transform: 'translateY(-50%)', color: '#9ca3af',
        pointerEvents: 'none',
    },
    table: {
        width: '100%', borderCollapse: 'collapse',
    },
    th: {
        padding: '10px 14px', textAlign: 'left',
        fontSize: '11px', fontWeight: 700, color: '#6366f1',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        borderBottom: '1.5px solid #e5e7eb', whiteSpace: 'nowrap',
        background: '#fff',
    },
    td: {
        padding: '13px 14px', fontSize: '14px',
        color: '#374151', borderBottom: '1px solid #f3f4f6',
        verticalAlign: 'middle',
    },
    idBadge: {
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 10px', borderRadius: '6px',
        background: '#e0e7ff', border: '1px solid #c7d2fe',
        color: '#4338ca', fontWeight: 700, fontSize: '12px',
    },
    statusBadge: {
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 8px', borderRadius: '100px',
        fontSize: '11px', fontWeight: 700,
    },
    emptyRow: {
        padding: '60px 16px', textAlign: 'center',
        color: '#9ca3af', fontStyle: 'italic', fontSize: '14px',
    },
    modalOverlay: {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        padding: '16px',
    },
    modalCard: {
        background: '#fff', borderRadius: '16px', width: '100%',
        maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        maxHeight: '90vh'
    },
    modalHeader: {
        padding: '16px 24px', background: '#f9fafb',
        borderBottom: '1px solid #f3f4f6', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
    },
    modalTitle: {
        fontSize: '16px', fontWeight: 800, color: '#1e293b', margin: 0,
    },
    modalCloseBtn: {
        background: 'none', border: 'none', color: '#9ca3af',
        cursor: 'pointer', display: 'flex', alignItems: 'center',
    },
    modalBody: {
        padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
        overflowY: 'auto', flex: 1,
    },
    formGroup: {
        display: 'flex', flexDirection: 'column', gap: '6px',
    },
    label: {
        fontSize: '11px', fontWeight: 700, color: '#64748b',
        textTransform: 'uppercase', letterSpacing: '0.05em',
    },
    input: {
        padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0',
        fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none',
        transition: 'border-color 0.15s',
    },
    modalFooter: {
        padding: '16px 24px', borderTop: '1px solid #f3f4f6',
        display: 'flex', justifyContent: 'flex-end', gap: '12px',
    },
    btnCancel: {
        padding: '8px 16px', borderRadius: '8px', border: 'none',
        background: 'none', color: '#6b7280', fontSize: '13px',
        fontWeight: 700, cursor: 'pointer',
    },
    btnSave: {
        padding: '8px 24px', borderRadius: '8px', border: 'none',
        background: '#6366f1', color: '#fff', fontSize: '13px',
        fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s',
    }
};

const SalesmanMaster = () => {
    const { t, lang } = useContext(LangContext);
    const locationState = useLocation().state;
    const [salesmen, setSalesmen] = useState([]);
    const [cashRecords, setCashRecords] = useState([]);
    const [purchaseRecords, setPurchaseRecords] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [payments, setPayments] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentSalesman, setCurrentSalesman] = useState({ id: '', displayId: '', name: '', contact: '', location: '', status: 'Active' });
    const importRef = useRef(null);
    const [isSaving, setIsSaving] = useState(false);

    const fmt = (n) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

    useEffect(() => {
        const unsubSalesmen = subscribeToCollection('salesmen', setSalesmen);
        const unsubCash = subscribeToCollection('salesman_cash', setCashRecords);
        const unsubPurchases = subscribeToCollection('salesman_purchases', setPurchaseRecords);
        const unsubExpenses = subscribeToCollection('salesman_expenses', setExpenses);
        const unsubTransfers = subscribeToCollection('salesman_transfers', setTransfers);
        const unsubPayments = subscribeToCollection('payments', setPayments);

        const handleGlobalSearch = (e) => {
            setSearchTerm(e.detail);
        };
        window.addEventListener('global-voice-search', handleGlobalSearch);

        return () => {
            unsubSalesmen();
            unsubCash();
            unsubPurchases();
            unsubExpenses();
            unsubTransfers();
            unsubPayments();
            window.removeEventListener('global-voice-search', handleGlobalSearch);
        };
    }, []);

    useEffect(() => {
        if (locationState?.openAddModal) {
            handleOpenModal();
        }
    }, [locationState]);

    useEffect(() => {
        const migrateStaffIds = async () => {
            const needsMigration = salesmen.some(s => s.displayId && s.displayId.length > 4);
            if (needsMigration && salesmen.length > 0) {
                const sorted = [...salesmen].sort((a, b) => {
                    const idA = parseInt(a.displayId) || 0;
                    const idB = parseInt(b.displayId) || 0;
                    return idA - idB;
                });
                for (let i = 0; i < sorted.length; i++) {
                    const s = sorted[i];
                    const nextId = String(101 + i);
                    if (s.displayId !== nextId) {
                        try {
                            await saveSalesman({ ...s, displayId: nextId });
                        } catch (err) {
                            console.error(`Failed to migrate ID for ${s.name}:`, err);
                        }
                    }
                }
            }
        };
        if (salesmen.length > 0) {
            migrateStaffIds();
        }
    }, [salesmen]);

    const [isTranslating, setIsTranslating] = useState(false);
    const transTimeout = useRef(null);
    const [touched, setTouched] = useState({ name: false, nameTa: false });

    const translate = async (text, from, to) => {
        if (!text || text.length < 2) return '';
        try {
            const resp = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
            const data = await resp.json();
            return data[0][0][0];
        } catch { return ''; }
    };

    const handleAutoTranslate = (val, source) => {
        const target = source === 'name' ? 'nameTa' : 'name';
        const fromLang = source === 'name' ? 'en' : 'ta';
        const toLang = source === 'name' ? 'ta' : 'en';

        // Update the field being typed in normally
        setCurrentSalesman(prev => ({ ...prev, [source]: val }));

        // If the other field hasn't been manually touched, translate into it
        if (!touched[target] && val.trim().length > 2) {
            if (transTimeout.current) clearTimeout(transTimeout.current);
            transTimeout.current = setTimeout(async () => {
                setIsTranslating(true);
                const translated = await translate(val, fromLang, toLang);
                if (translated && !touched[target]) {
                    setCurrentSalesman(prev => ({ ...prev, [target]: translated }));
                }
                setIsTranslating(false);
            }, 800);
        }
    };

    const handleOpenModal = (salesman = null) => {
        setTouched({ name: false, nameTa: false });
        if (salesman) {
            const val = Number(salesman.openingCash) || 0;
            setCurrentSalesman({
                ...salesman,
                openingCash: val > 0 ? String(val) : '',
                openingCredit: val < 0 ? String(Math.abs(val)) : ''
            });
        } else {
            const validIds = salesmen.map(s => parseInt(s.displayId) || 0).filter(id => id >= 101 && id < 100000);
            const nextId = validIds.length > 0 ? Math.max(...validIds) + 1 : 101;
            setCurrentSalesman({ id: '', displayId: String(nextId), name: '', nameTa: '', contact: '', location: '', status: 'Active', openingCash: '', openingCredit: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            let finalOpeningCash = 0;
            if (currentSalesman.openingCash && parseFloat(currentSalesman.openingCash) > 0) {
                finalOpeningCash = parseFloat(currentSalesman.openingCash);
            } else if (currentSalesman.openingCredit && parseFloat(currentSalesman.openingCredit) > 0) {
                finalOpeningCash = -parseFloat(currentSalesman.openingCredit);
            }

            const dataToSave = {
                ...currentSalesman,
                openingCash: finalOpeningCash
            };
            delete dataToSave.openingCredit;

            await saveSalesman(dataToSave);
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving salesman:", error);
            alert("Failed to save.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this staff member? This action cannot be undone.")) {
            try {
                await deleteSalesman(id);
            } catch (error) {
                console.error("Error deleting staff:", error);
                alert("Failed to delete.");
            }
        }
    };

    const handleExportExcel = () => {
        if (salesmen.length === 0) return alert('No data to export.');
        const data = salesmen.map((s, idx) => {
            const sCash = cashRecords.filter(r => r.salesmanId === s.id);
            const sPurchases = purchaseRecords.filter(p => p.salesmanId === s.id);
            const sExpenses = expenses.filter(e => e.salesmanId === s.id);
            const sTransfersIn = transfers.filter(t => t.toSalesmanId === s.id);
            const sTransfersOut = transfers.filter(t => t.fromSalesmanId === s.id);
            const sPayments = payments.filter(p => p.type === 'vendor' && p.salesmanId === s.id);

            const opening = (Number(s.openingCash) || 0) + sCash.reduce((sum, r) => sum + (Number(r.openingCash) || 0), 0);
            const purchasesAmt = sPurchases.reduce((sum, p) => sum + (Number(p.grandTotal) || 0), 0);
            const expensesAmt = sExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            const transInAmt = sTransfersIn.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
            const transOutAmt = sTransfersOut.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
            const vendorPayAmt = sPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            const balance = (opening + transInAmt) - (purchasesAmt + expensesAmt + transOutAmt + vendorPayAmt);
            return {
                'S.No': idx + 1,
                'Staff ID': s.displayId || '---',
                'Staff Name': s.name,
                'Staff Name (Tamil)': s.nameTa || '',
                'Opening Cash (₹)': opening,
                'Purchase Amount (₹)': purchasesAmt,
                'Available Balance (₹)': balance,
                'Status': s.status || 'Active'
            };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Staff');
        XLSX.writeFile(wb, `StaffRegistry_${Date.now()}.xlsx`);
    };

    const handleDownloadTemplate = () => {
        const templateRows = [
            { 'Staff Name': 'Kumar', 'Staff Name (Tamil)': 'குமார்', 'Contact Number': '9876543210', 'Location': 'Tindivanam', 'Status': 'Active' },
            { 'Staff Name': 'Ravi', 'Staff Name (Tamil)': 'ரவி', 'Contact Number': '9988776655', 'Location': 'Pondicherry', 'Status': 'Active' }
        ];
        const ws = XLSX.utils.json_to_sheet(templateRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, `Staff_Import_Template.xlsx`);
    };

    const handleImportExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const ab = evt.target.result;
                const wb = XLSX.read(ab, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(ws);
                if (data.length === 0) return alert('No data found in Excel.');

                let importedCount = 0;
                for (const row of data) {
                    const name = row['Staff Name'] || row['Salesman Name'] || row['Name'];
                    const nameTa = row['Staff Name (Tamil)'] || row['Salesman Name (Tamil)'] || row['Tamil Name'] || '';
                    if (!name) continue;

                    const contact = row['Contact Number'] || row['Contact'] || row['Phone'] || '';
                    const location = row['Location'] || row['Address'] || '';
                    const status = row['Status'] || 'Active';
                    const openingCash = row['Opening Cash'] || row['Opening'] || 0;

                    await saveSalesman({
                        name: String(name).trim(),
                        nameTa: String(nameTa).trim(),
                        contact: String(contact).trim(),
                        location: String(location).trim(),
                        status: String(status).trim(),
                        openingCash: Number(openingCash) || 0
                    });
                    importedCount++;
                }
                alert(`Successfully imported ${importedCount} staff members!`);
            } catch (err) {
                alert('Error importing Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const filteredSalesmen = salesmen.filter(s => {
        const sTerm = searchTerm.toLowerCase().trim();
        if (!sTerm) return true;
        return s.name?.toLowerCase().includes(sTerm) ||
            s.location?.toLowerCase().includes(sTerm) ||
            s.contact?.includes(sTerm) ||
            (s.displayId && String(s.displayId).includes(sTerm));
    }).sort((a, b) => (parseInt(a.displayId) || 0) - (parseInt(b.displayId) || 0));

    return (
        <div style={S.page}>
            {/* Header */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <User size={22} color="#4338ca" />
                    <div style={S.titleCol}>
                        <h2 style={S.title}>Staff Registry</h2>
                        <span style={S.subtitle}>Manage active and inactive staff members</span>
                    </div>
                </div>
                
                <div style={S.actions}>
                    <button style={S.btnTemplate} onClick={handleDownloadTemplate}
                        onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'}
                        onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                    >
                        <Download size={14} /> Template
                    </button>
                    <button style={S.btnImport} onClick={() => importRef.current?.click()}
                        onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'}
                        onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                    >
                        <Upload size={14} color="#6366f1" /> Import
                        <input ref={importRef} type="file" accept=".xlsx, .xls" onChange={handleImportExcel} style={{ display: 'none' }} />
                    </button>
                    <button style={S.btnExport} onClick={handleExportExcel}
                        onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'}
                        onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                    >
                        <Download size={14} /> Export
                    </button>
                    <button style={S.btnAdd} onClick={() => handleOpenModal()}
                        onMouseEnter={e => { e.currentTarget.style.background='#6366f1'; e.currentTarget.style.color='#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='#ffffff'; e.currentTarget.style.color='#6366f1'; }}
                    >
                        <Plus size={15} /> Add Staff
                    </button>
                </div>
            </div>

            {/* Search */}
            <div style={S.searchWrap}>
                <Search style={S.searchIcon} size={18} />
                <input 
                    type="text" 
                    placeholder="Search by name, ID, contact..." 
                    style={{ ...S.searchInput, paddingRight: '40px' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                    <VoiceSearchButton onSpeechResult={setSearchTerm} langSetting={lang} />
                </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                    <thead>
                        <tr style={{ background: '#fff', borderBottom: '1.5px solid #f1f5f9' }}>
                            <th style={S.th}>ID</th>
                            <th style={S.th}>Staff Name</th>
                            <th style={{...S.th, textAlign: 'right'}}>Opening Cash</th>
                            <th style={{...S.th, textAlign: 'right'}}>Purchase Amount</th>
                            <th style={{...S.th, textAlign: 'right'}}>Available Balance</th>
                            <th style={S.th}>Status</th>
                            <th style={{...S.th, textAlign: 'center'}}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSalesmen.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={S.emptyRow}>
                                    No records found.
                                </td>
                            </tr>
                        ) : (
                            filteredSalesmen.map((salesman) => {
                                const sCash = cashRecords.filter(r => r.salesmanId === salesman.id);
                                const sPurchases = purchaseRecords.filter(p => p.salesmanId === salesman.id);
                                const sExpenses = expenses.filter(e => e.salesmanId === salesman.id);
                                const sTransfersIn = transfers.filter(t => t.toSalesmanId === salesman.id);
                                const sTransfersOut = transfers.filter(t => t.fromSalesmanId === salesman.id);
                                const sPayments = payments.filter(p => p.type === 'vendor' && p.salesmanId === salesman.id);

                                const opening = (Number(salesman.openingCash) || 0) + sCash.reduce((sum, r) => sum + (Number(r.openingCash) || 0), 0);
                                const purchasesAmt = sPurchases.reduce((sum, p) => sum + (Number(p.grandTotal) || 0), 0);
                                const expensesAmt = sExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
                                const transInAmt = sTransfersIn.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                                const transOutAmt = sTransfersOut.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                                const vendorPayAmt = sPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

                                const balance = (opening + transInAmt) - (purchasesAmt + expensesAmt + transOutAmt + vendorPayAmt);
                                return (
                                    <tr key={salesman.id} className="group" style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={S.td}>
                                            <span style={S.idBadge}>#{salesman.displayId || '---'}</span>
                                        </td>
                                        <td style={{...S.td, fontWeight: 700, color: '#334155'}}>
                                            <div>{salesman.name}</div>
                                            {salesman.nameTa && <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 550 }}>{salesman.nameTa}</div>}
                                        </td>
                                        <td style={{...S.td, textAlign: 'right', fontWeight: 700, color: '#16a34a'}}>{fmt(opening)}</td>
                                        <td style={{...S.td, textAlign: 'right', fontWeight: 700, color: '#dc2626'}}>{fmt(purchasesAmt)}</td>
                                        <td style={{...S.td, textAlign: 'right', fontWeight: 850, color: balance >= 0 ? '#1e293b' : '#b91c1c'}}>{fmt(balance)}</td>
                                        <td style={S.td}>
                                            <span style={{
                                                ...S.statusBadge,
                                                background: salesman.status === 'Active' ? '#dcfce7' : '#fee2e2',
                                                color: salesman.status === 'Active' ? '#15803d' : '#b91c1c'
                                            }}>
                                                {salesman.status}
                                            </span>
                                        </td>
                                        <td style={{...S.td, textAlign: 'center'}}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button 
                                                    onClick={() => handleOpenModal(salesman)}
                                                    style={{ border: '1px solid #e5e7eb', background: '#fff', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#3b82f6' }}
                                                    onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                                                    onMouseLeave={e => e.currentTarget.style.background='#ffffff'}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(salesman.id)}
                                                    style={{ border: '1px solid #e5e7eb', background: '#fff', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ef4444' }}
                                                    onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                                                    onMouseLeave={e => e.currentTarget.style.background='#ffffff'}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '24px', width: '400px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto', fontFamily: 'var(--font-sans)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontWeight: 900, color: '#92400e' }}>
                                {currentSalesman.id 
                                    ? (lang === 'ta' ? '✏️ பணியாளர் விவரம் மாற்று' : '✏️ Edit Staff') 
                                    : (lang === 'ta' ? '👤 புதிய பணியாளர் சேர்க்க' : '👤 New Staff')}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {lang === 'ta' ? 'பணியாளர் பெயர் (ஆங்கிலம்)' : 'Staff Name (English)'}
                                </label>
                                <input 
                                    type="text" 
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none', fontFamily: 'var(--font-sans)' }}
                                    value={currentSalesman.name}
                                    onChange={(e) => {
                                        setTouched(p => ({ ...p, name: true }));
                                        handleAutoTranslate(e.target.value, 'name');
                                    }}
                                    placeholder={lang === 'ta' ? 'பெயர் ஆங்கிலத்தில்' : 'Full Name in English'}
                                    required
                                    onFocus={e => e.target.style.borderColor = '#d97706'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {lang === 'ta' ? 'பணியாளர் பெயர் (தமிழ்)' : 'Staff Name (Tamil)'}
                                </label>
                                <input 
                                    type="text" 
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none', fontFamily: 'var(--font-sans)' }}
                                    value={currentSalesman.nameTa || ''}
                                    onChange={(e) => {
                                        setTouched(p => ({ ...p, nameTa: true }));
                                        handleAutoTranslate(e.target.value, 'nameTa');
                                    }}
                                    placeholder={lang === 'ta' ? 'பெயர் தமிழில்' : 'Full Name in Tamil'}
                                    onFocus={e => e.target.style.borderColor = '#d97706'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {lang === 'ta' ? 'தொடர்பு எண்' : 'Contact Number'}
                                </label>
                                <input 
                                    type="text" 
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none', fontFamily: 'var(--font-sans)' }}
                                    value={currentSalesman.contact}
                                    onChange={(e) => setCurrentSalesman({ ...currentSalesman, contact: e.target.value })}
                                    placeholder={lang === 'ta' ? 'அலைபேசி எண்' : 'Mobile Number'}
                                    onFocus={e => e.target.style.borderColor = '#d97706'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {lang === 'ta' ? 'இருப்பிடம் / ஊர்' : 'Location'}
                                </label>
                                <input 
                                    type="text" 
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none', fontFamily: 'var(--font-sans)' }}
                                    value={currentSalesman.location}
                                    onChange={(e) => setCurrentSalesman({ ...currentSalesman, location: e.target.value })}
                                    placeholder={lang === 'ta' ? 'நகரம்' : 'City/Town'}
                                    onFocus={e => e.target.style.borderColor = '#d97706'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {lang === 'ta' ? 'தொடக்க ரொக்கம்' : 'Opening Cash'}
                                    </label>
                                    <input 
                                        type="number" 
                                        inputMode="decimal"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none', fontFamily: 'var(--font-sans)' }}
                                        value={currentSalesman.openingCash || ''}
                                        onChange={(e) => setCurrentSalesman({ ...currentSalesman, openingCash: e.target.value, openingCredit: '' })}
                                        placeholder={lang === 'ta' ? 'ரொக்கம் (ரூ)' : 'Cash (₹)'}
                                        onFocus={e => e.target.style.borderColor = '#d97706'}
                                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {lang === 'ta' ? 'தொடக்க இருப்பு' : 'Opening Credit'}
                                    </label>
                                    <input 
                                        type="number" 
                                        inputMode="decimal"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none', fontFamily: 'var(--font-sans)' }}
                                        value={currentSalesman.openingCredit || ''}
                                        onChange={(e) => setCurrentSalesman({ ...currentSalesman, openingCredit: e.target.value, openingCash: '' })}
                                        placeholder={lang === 'ta' ? 'இருப்பு (ரூ)' : 'Credit (₹)'}
                                        onFocus={e => e.target.style.borderColor = '#d97706'}
                                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lang === 'ta' ? 'நிலை' : 'Status'}</label>
                                <select 
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#1e293b', outline: 'none', fontFamily: 'var(--font-sans)' }}
                                    value={currentSalesman.status}
                                    onChange={(e) => setCurrentSalesman({ ...currentSalesman, status: e.target.value })}
                                    onFocus={e => e.target.style.borderColor = '#d97706'}
                                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                                >
                                    <option value="Active">{lang === 'ta' ? 'செயலில் உள்ளது (Active)' : 'Active'}</option>
                                    <option value="Inactive">{lang === 'ta' ? 'செயலில் இல்லை (Inactive)' : 'Inactive'}</option>
                                </select>
                            </div>
                            <button type="submit" disabled={isSaving} style={{ padding: '12px', background: '#d97706', color: '#fff', borderRadius: '12px', border: 'none', fontWeight: 800, marginTop: '10px', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1 }}>
                                {isSaving 
                                    ? (lang === 'ta' ? 'சேமிக்கப்படுகிறது...' : 'Saving...') 
                                    : (lang === 'ta' ? 'சேமி' : 'Save')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesmanMaster;
