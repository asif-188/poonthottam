import React, { useState, useEffect, useRef, useContext } from 'react';
import { Plus, Trash2, Calendar, DollarSign, FileText, User, Pencil, X, History, Clock, Mic } from 'lucide-react';
import { subscribeToCollection, db, savePayment, addData, updateData, getTenant, addDoc, updateDoc, deleteDoc } from '../utils/storage';
import { doc, increment, collection, serverTimestamp } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import { useTenant } from '../utils/TenantContext';
import VoiceEntryModal from '../components/VoiceEntryModal';

/* ── Keyboard-navigable Generic Searchable Dropdown ── */
const SearchSelect = ({ items, value, onChange, onKeyDown, inputRef, placeholder }) => {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [cursor, setCursor] = useState(0);
    const listRef = useRef(null);

    const formatName = (item) => {
        if (!item) return '';
        return item.nameTa ? `${item.name}-${item.nameTa}` : item.name;
    };

    const selectedItem = items.find(i => i.id === value || i.name === value);
    const selectedName = selectedItem ? formatName(selectedItem) : '';

    const filtered = query.trim()
        ? items
            .filter(i => {
                const n = i.name?.toLowerCase() || '';
                const tn = i.nameTa?.toLowerCase() || '';
                const q = query.toLowerCase();
                return n.includes(q) || tn.includes(q) || (i.displayId && String(i.displayId).includes(query));
            })
            .sort((a, b) => {
                const q = query.toLowerCase();
                const getScore = (item) => {
                    const n = item.name?.toLowerCase() || '';
                    const tn = item.nameTa?.toLowerCase() || '';
                    const id = item.displayId ? String(item.displayId).toLowerCase() : '';
                    if (n.startsWith(q) || tn.startsWith(q) || id.startsWith(q)) return 3;
                    if (n.includes(' ' + q) || tn.includes(' ' + q) || n.includes('-' + q) || tn.includes('-' + q)) return 2;
                    if (n.includes(q) || tn.includes(q) || id.includes(q)) return 1;
                    return 0;
                };
                return getScore(b) - getScore(a);
            })
        : items;

    const choose = (item) => {
        onChange(item.id);
        setQuery(formatName(item));
        setOpen(false);
    };

    const handleKey = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                if (onKeyDown) onKeyDown(e);
            }
            else if (open && filtered[cursor]) {
                choose(filtered[cursor]);
                if (onKeyDown) onKeyDown(e);
            }
            else if (value) {
                if (onKeyDown) onKeyDown(e);
            }
        }
        else if (e.key === 'Escape') setOpen(false);
        else if (e.key === 'Tab') {
            if (open && filtered[cursor]) choose(filtered[cursor]);
            setOpen(false);
            if (onKeyDown) onKeyDown(e);
        }
    };

    useEffect(() => {
        if (listRef.current) {
            const els = listRef.current.querySelectorAll('li');
            els[cursor]?.scrollIntoView({ block: 'nearest' });
        }
    }, [cursor]);

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={open ? query : selectedName}
                onFocus={() => { setQuery(''); setOpen(true); setCursor(0); }}
                onBlur={() => setTimeout(() => setOpen(false), 200)}
                onChange={e => { setQuery(e.target.value); setCursor(0); }}
                onKeyDown={handleKey}
                autoComplete="off"
                style={INPUT_S}
            />
            {open && filtered.length > 0 && (
                <ul ref={listRef} style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)', maxHeight: '200px',
                    overflowY: 'auto', listStyle: 'none', margin: '4px 0', padding: '4px',
                }}>
                    {filtered.map((item, i) => (
                        <li key={item.id} onMouseDown={() => choose(item)}
                            style={{
                                padding: '8px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px',
                                fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                                background: i === cursor ? '#f0fdf4' : 'transparent',
                                color: i === cursor ? '#15803d' : '#374151',
                            }}
                            onMouseEnter={() => setCursor(i)}
                        >
                            {item.displayId && <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>#{item.displayId}</span>}
                            {formatName(item)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

/* ── Shared style tokens ── */
const INPUT_S = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: '1.5px solid #e2e8f0', background: '#fff',
    fontSize: '14px', fontWeight: 600, color: '#1e293b',
    outline: 'none', fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
};
const LABEL_S = {
    display: 'block', fontSize: '10px', fontWeight: 700,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px',
};
const TD_S = {
    padding: '12px 14px', fontSize: '13.5px',
    color: '#334155', borderBottom: '1px solid #f1f5f9',
    fontWeight: 650, verticalAlign: 'middle'
};
const TH_S = {
    padding: '12px 14px', textAlign: 'left',
    fontSize: '11px', fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    borderBottom: '1.5px solid #e2e8f0', background: '#f8fafc'
};

const Payments = () => {
    const { t, lang } = useContext(LangContext);
    const { tenantData } = useTenant();

    // --- State Mappings ---
    const [salesmen, setSalesmen] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [payments, setPayments] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [transfers, setTransfers] = useState([]);

    // --- Workflow State ---
    const [salesmanId, setSalesmanId] = useState('');
    const [transactionType, setTransactionType] = useState(''); // 'credit', 'debit', 'internal'
    const [internalSubtype, setInternalSubtype] = useState(''); // 'expenses', 'transfers'
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // --- Form States ---
    const [formData, setFormData] = useState({
        entityId: '',
        amount: '',
        cashLess: '',
        method: 'Cash', // 'Cash', 'UPI', 'Ready Cash'
        category: 'Petrol', // 'Petrol', 'Food', 'Maintenance', 'Other'
        source: 'Cash', // 'Cash', 'Ready Cash'
        toSalesmanId: '',
        note: '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
    const getVoiceModalType = () => {
        if (transactionType === 'credit') return 'cash_receive';
        if (transactionType === 'debit') return 'cash_pay';
        if (transactionType === 'internal') {
            if (internalSubtype === 'expenses') return 'expense';
            if (internalSubtype === 'transfers') return 'transfer';
        }
        return 'cash_receive';
    };

    const getVoiceModalEntities = () => {
        const vType = getVoiceModalType();
        if (vType === 'cash_receive') return buyers;
        if (vType === 'cash_pay') return vendors;
        if (vType === 'expense' || vType === 'transfer') return salesmen;
        return [];
    };

    const handleVoiceConfirm = (payload) => {
        const vType = getVoiceModalType();
        if (vType === 'cash_receive' || vType === 'cash_pay') {
            const { entity, amount, cashLess, note, method } = payload;
            setFormData(prev => ({
                ...prev,
                entityId: entity?.id || '',
                amount: amount ? String(amount) : '',
                cashLess: cashLess ? String(cashLess) : '',
                note: note || '',
                method: method || 'Cash'
            }));
        } else if (vType === 'expense') {
            const { staff, amount, category, remarks } = payload;
            if (staff) setSalesmanId(staff.id);
            setFormData(prev => ({
                ...prev,
                amount: amount ? String(amount) : '',
                category: category || 'Petrol',
                note: remarks || ''
            }));
        } else if (vType === 'transfer') {
            const { fromStaff, toStaff, amount, remarks } = payload;
            if (fromStaff) setSalesmanId(fromStaff.id);
            setFormData(prev => ({
                ...prev,
                toSalesmanId: toStaff?.id || '',
                amount: amount ? String(amount) : '',
                note: remarks || ''
            }));
        }
    };

    // --- Focus Refs ---
    const refSalesman = useRef(null);
    const refType = useRef(null);
    const refSubtype = useRef(null);
    const refEntity = useRef(null);
    const refAmount = useRef(null);
    const refCashLess = useRef(null);
    const refNotes = useRef(null);
    const refSaveBtn = useRef(null);

    // --- Subscriptions ---
    useEffect(() => {
        const u1 = subscribeToCollection('salesmen', setSalesmen);
        const u2 = subscribeToCollection('buyers', setBuyers);
        const u3 = subscribeToCollection('vendors', setVendors);
        const u4 = subscribeToCollection('payments', (data) =>
            setPayments(data.sort((a, b) => {
                const getTime = (p) => {
                    if (p.timestamp) return p.timestamp.toDate ? p.timestamp.toDate().getTime() : new Date(p.timestamp).getTime();
                    if (p.createdAt) return p.createdAt.toDate ? p.createdAt.toDate().getTime() : new Date(p.createdAt).getTime();
                    if (p.date) return new Date(p.date).getTime();
                    return 0;
                };
                return getTime(a) - getTime(b);
            })), true);
        const u5 = subscribeToCollection('salesman_expenses', setExpenses, true);
        const u6 = subscribeToCollection('salesman_transfers', setTransfers, true);

        return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
    }, []);

    // Auto-focus first entry field (Customer / Vendor / Category / Receiver Staff) when sub-form renders
    useEffect(() => {
        if (transactionType && (transactionType !== 'internal' || internalSubtype)) {
            setTimeout(() => {
                refEntity.current?.focus();
            }, 150);
        }
    }, [transactionType, internalSubtype]);

    // --- Keyboard Navigation ---
    const onKey = (e, nextRef, valToCheck = null, prevRef = null) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                if (prevRef && prevRef.current) {
                    prevRef.current.focus();
                    if (prevRef.current.select) prevRef.current.select();
                }
                return;
            }
            if (valToCheck !== null) {
                const val = String(valToCheck).trim();
                if (!val || val === '0' || parseFloat(val) <= 0) return;
            }
            nextRef.current?.focus();
            if (nextRef.current?.select) nextRef.current.select();
        }
    };

    // --- Reset Form Fields ---
    const resetForm = (keepSelection = false) => {
        setFormData(prev => ({
            entityId: keepSelection ? prev.entityId : '',
            amount: '',
            cashLess: '',
            method: prev.method,
            category: prev.category,
            source: prev.source,
            toSalesmanId: keepSelection ? prev.toSalesmanId : '',
            note: '',
        }));
    };

    // --- Save Actions ---
    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (isSaving || !salesmanId) return;

        setIsSaving(true);
        try {
            const amountNum = parseFloat(formData.amount || 0);
            const noteStr = formData.note;

            if (transactionType === 'credit') {
                // Credit (Sales Cash Receive)
                if (!formData.entityId || amountNum <= 0) {
                    alert('Please select a customer and enter an amount.');
                    setIsSaving(false);
                    return;
                }
                const cashLessNum = parseFloat(formData.cashLess || 0);
                const entityRef = doc(db, 'buyers', formData.entityId);
                await savePayment({
                    entityId: formData.entityId,
                    salesmanId: salesmanId,
                    amount: amountNum,
                    cashLess: cashLessNum,
                    method: formData.method,
                    note: noteStr,
                    date: date,
                    type: 'buyer',
                    timestamp: new Date(date).toISOString()
                });
                await updateDoc(entityRef, { balance: increment(-(amountNum + cashLessNum)) });
            } 
            else if (transactionType === 'debit') {
                // Debit (Purchase Cash Paid)
                if (!formData.entityId || amountNum <= 0) {
                    alert('Please select a vendor and enter an amount.');
                    setIsSaving(false);
                    return;
                }
                const entityRef = doc(db, 'vendors', formData.entityId);
                const tenantId = getTenant();
                await addDoc(collection(db, 'payments'), {
                    entityId: formData.entityId,
                    salesmanId: salesmanId,
                    amount: amountNum,
                    date: date,
                    method: formData.method,
                    note: noteStr,
                    type: 'vendor',
                    createdAt: serverTimestamp(),
                    tenantId
                });
                await updateDoc(entityRef, { balance: increment(-amountNum) });
            } 
            else if (transactionType === 'internal' && internalSubtype === 'expenses') {
                // Salesman Expenses
                if (amountNum <= 0) {
                    alert('Please enter a valid amount.');
                    setIsSaving(false);
                    return;
                }
                const salesman = salesmen.find(s => s.id === salesmanId);
                await addData('salesman_expenses', {
                    salesmanId: salesmanId,
                    salesmanName: salesman?.name || 'Unknown',
                    date: date,
                    category: formData.category,
                    amount: amountNum,
                    source: formData.source,
                    notes: noteStr
                });
            } 
            else if (transactionType === 'internal' && internalSubtype === 'transfers') {
                // Salesman Transfers
                if (!formData.toSalesmanId || amountNum <= 0) {
                    alert('Please select a receiver salesman and enter an amount.');
                    setIsSaving(false);
                    return;
                }
                if (salesmanId === formData.toSalesmanId) {
                    alert('Sender and receiver cannot be the same salesman.');
                    setIsSaving(false);
                    return;
                }
                const fromSalesman = salesmen.find(s => s.id === salesmanId);
                const toSalesman = salesmen.find(s => s.id === formData.toSalesmanId);
                await addData('salesman_transfers', {
                    fromSalesmanId: salesmanId,
                    fromSalesmanName: fromSalesman?.name || 'Unknown',
                    toSalesmanId: formData.toSalesmanId,
                    toSalesmanName: toSalesman?.name || 'Unknown',
                    date: date,
                    amount: amountNum,
                    notes: noteStr
                });
            }

            resetForm(true);
            alert('✅ Recorded successfully!');
            setTimeout(() => {
                if (transactionType === 'credit') {
                    refCashLess.current?.focus();
                    if (refCashLess.current?.select) refCashLess.current.select();
                } else {
                    refAmount.current?.focus();
                    if (refAmount.current?.select) refAmount.current.select();
                }
            }, 100);
        } catch (err) {
            alert('❌ Save failed: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Delete Action ---
    const handleDelete = async (item) => {
        if (!window.confirm('Are you sure you want to delete this record?')) return;
        try {
            if (item.rowType === 'credit') {
                await deleteDoc(doc(db, 'payments', item.id));
                const entityRef = doc(db, 'buyers', item.entityId);
                await updateDoc(entityRef, { balance: increment((item.amount || 0) + (item.cashLess || 0)) });
            } else if (item.rowType === 'debit') {
                await deleteDoc(doc(db, 'payments', item.id));
                const entityRef = doc(db, 'vendors', item.entityId);
                await updateDoc(entityRef, { balance: increment(item.amount || 0) });
            } else if (item.rowType === 'expense') {
                await deleteDoc(doc(db, 'salesman_expenses', item.id));
            } else if (item.rowType === 'transfer') {
                await deleteDoc(doc(db, 'salesman_transfers', item.id));
            }
            alert('Deleted successfully!');
        } catch (err) {
            alert('❌ Delete failed: ' + err.message);
        }
    };

    // --- Edit Notes Action ---
    const handleEditNote = async (item) => {
        const fieldName = (item.rowType === 'expense' || item.rowType === 'transfer') ? 'notes' : 'note';
        const currentVal = item[fieldName] || '';
        const newNote = window.prompt('Edit Note:', currentVal);
        if (newNote === null) return;

        try {
            const colName = (item.rowType === 'credit' || item.rowType === 'debit')
                ? 'payments'
                : (item.rowType === 'expense' ? 'salesman_expenses' : 'salesman_transfers');
            await updateDoc(doc(db, colName, item.id), { [fieldName]: newNote });
            alert('Note updated successfully!');
        }
        catch (err) {
            alert('❌ Update failed: ' + err.message);
        }
    };

    // --- Formatting Helpers ---
    const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

    const formatDate = (ts) => {
        if (!ts) return '—';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    const activeSalesmen = salesmen.filter(s => s.status === 'Active');

    // --- Get Today's unified live entries for the selected salesman ---
    const todayEntries = React.useMemo(() => {
        if (!salesmanId) return [];

        const list = [];

        // 1. Credits (Buyer payments)
        payments.forEach(p => {
            const d = p.timestamp ? (typeof p.timestamp === 'string' ? p.timestamp.substring(0, 10) : p.timestamp.toDate ? p.timestamp.toDate().toISOString().substring(0, 10) : '') : p.date;
            if ((p.type === 'buyer' || !p.type) && p.salesmanId === salesmanId && d === date) {
                list.push({ ...p, rowType: 'credit', sortKey: p.timestamp || p.createdAt || p.date });
            }
        });

        // 2. Debits (Vendor payments)
        payments.forEach(p => {
            if (p.type === 'vendor' && p.salesmanId === salesmanId && p.date === date) {
                list.push({ ...p, rowType: 'debit', sortKey: p.createdAt?.toDate ? p.createdAt.toDate().toISOString() : p.date });
            }
        });

        // 3. Expenses
        expenses.forEach(e => {
            if (e.salesmanId === salesmanId && e.date === date) {
                list.push({ ...e, rowType: 'expense', sortKey: e.date });
            }
        });

        // 4. Transfers (From / To)
        transfers.forEach(t => {
            if ((t.fromSalesmanId === salesmanId || t.toSalesmanId === salesmanId) && t.date === date) {
                list.push({ ...t, rowType: 'transfer', sortKey: t.date });
            }
        });

        return list.sort((a, b) => String(b.sortKey).localeCompare(String(a.sortKey)));
    }, [payments, expenses, transfers, salesmanId, date]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'var(--font-sans)' }}>

            {/* ── Page Container (Matching Sales Entry style) ── */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' }}>

                {/* ── Header Row ── */}
                <div className="mobile-stack-grid-header" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '20px', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>

                    {/* Left: Date selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '15px' }}>📅</span>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {lang === 'ta' ? 'புதிய வரவு/செலவு' : 'New Transaction'}
                            </span>
                        </div>
                        <div style={{ width: '150px' }}>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                style={{
                                    ...INPUT_S,
                                    padding: '6px 12px',
                                    border: '1.5px solid #d1fae5',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    color: '#475569'
                                }}
                            />
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', marginTop: '6px', textAlign: 'center' }}>
                                {date.split('-').reverse().join('-')}
                            </div>
                        </div>
                    </div>

                    {/* Center: Title */}
                    <h1 style={{
                        fontSize: '32px',
                        fontWeight: 900,
                        color: '#16a34a',
                        fontFamily: 'var(--font-display)',
                        letterSpacing: '0.05em',
                        margin: 0,
                        textTransform: 'uppercase'
                    }}>
                        {lang === 'ta' ? 'பணம் செலுத்துதல்' : 'Payments'}
                    </h1>

                    {/* Right: Voice Input Button */}
                    <div style={{ justifySelf: 'end' }}>
                        {salesmanId && transactionType && (transactionType !== 'internal' || internalSubtype) && (
                            <button
                                type="button"
                                onClick={() => setIsVoiceModalOpen(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: '#fff',
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(16,185,129,0.2)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Mic size={16} /> {lang === 'ta' ? 'குரல் உள்ளீடு' : 'Speak Form'}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Step Workflow Controls ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px', background: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>

                    {/* Step 1: Select Staff */}
                    <div>
                        <label style={LABEL_S}>{lang === 'ta' ? 'பணியாளர் தேர்வு' : 'Select Staff'}</label>
                        <select
                            ref={refSalesman}
                            value={salesmanId}
                            onChange={e => {
                                setSalesmanId(e.target.value);
                                setTransactionType('');
                                setInternalSubtype('');
                                resetForm();
                            }}
                            style={INPUT_S}
                        >
                            <option value="">{lang === 'ta' ? '-- பணியாளரைத் தேர்வுசெய் --' : '-- Choose Staff --'}</option>
                            {activeSalesmen.map(s => (
                                <option key={s.id} value={s.id}>{s.nameTa || s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Step 2: Select Type */}
                    {salesmanId && (
                        <div>
                            <label style={LABEL_S}>{lang === 'ta' ? 'பரிவர்த்தனை வகை' : 'Transaction Type'}</label>
                            <select
                                ref={refType}
                                value={transactionType}
                                onChange={e => {
                                    setTransactionType(e.target.value);
                                    setInternalSubtype('');
                                    resetForm();
                                }}
                                style={INPUT_S}
                            >
                                <option value="">{lang === 'ta' ? '-- வகையைத் தேர்வுசெய் --' : '-- Select Type --'}</option>
                                <option value="credit">{lang === 'ta' ? 'வரவு (விற்பனை பணம் பெறல்)' : 'Credit (Sales Cash Receive)'}</option>
                                <option value="debit">{lang === 'ta' ? 'செலவு (கொள்முதல் பணம் கொடுத்தல்)' : 'Debit (Purchase Cash Paid)'}</option>
                                <option value="internal">{lang === 'ta' ? 'உள் பரிமாற்றம்' : 'Internal Transfer'}</option>
                            </select>
                        </div>
                    )}

                    {/* Step 3: Select Subtype */}
                    {salesmanId && transactionType === 'internal' && (
                        <div>
                            <label style={LABEL_S}>{lang === 'ta' ? 'உள் துணை வகை' : 'Internal Sub-Type'}</label>
                            <select
                                ref={refSubtype}
                                value={internalSubtype}
                                onChange={e => {
                                    setInternalSubtype(e.target.value);
                                    resetForm();
                                }}
                                style={INPUT_S}
                            >
                                <option value="">{lang === 'ta' ? '-- துணை வகையைத் தேர்வுசெய் --' : '-- Select Sub-Type --'}</option>
                                <option value="expenses">{lang === 'ta' ? 'பணியாளர் செலவுகள்' : 'Staff Expenses'}</option>
                                <option value="transfers">{lang === 'ta' ? 'பணியாளர் பரிமாற்றம்' : 'Staff Transfers'}</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* ── Step 4: Transaction Specific Entry Controls ── */}
                {salesmanId && transactionType && (transactionType !== 'internal' || internalSubtype) && (
                    <div style={{ padding: '20px 0 10px 0', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>

                            {/* --- Credit Form (Sales Cash Receive) --- */}
                            {transactionType === 'credit' && (
                                <>
                                    <div>
                                        <label style={LABEL_S}>{t('customer')}</label>
                                        <SearchSelect
                                            items={buyers}
                                            value={formData.entityId}
                                            onChange={val => setFormData({ ...formData, entityId: val })}
                                            inputRef={refEntity}
                                            onKeyDown={e => onKey(e, refAmount)}
                                            placeholder={t('selectCustomer')}
                                        />
                                    </div>
                                    <div>
                                        <label style={LABEL_S}>{lang === 'ta' ? 'செலுத்தும் முறை' : 'Payment Method'}</label>
                                        <select
                                            value={formData.method}
                                            onChange={e => setFormData({ ...formData, method: e.target.value })}
                                            style={INPUT_S}
                                        >
                                            <option value="Cash">{lang === 'ta' ? 'பணம்' : 'Cash'}</option>
                                            <option value="UPI">{lang === 'ta' ? 'GPAY (UPI)' : 'GPAY (UPI)'}</option>
                                            <option value="Ready Cash">{lang === 'ta' ? 'ரொக்கம்' : 'Ready Cash'}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={LABEL_S}>{t('cashLess') || 'CASH LESS'}</label>
                                        <input
                                            ref={refCashLess}
                                            type="number"
                                            placeholder="0"
                                            value={formData.cashLess}
                                            onChange={e => setFormData({ ...formData, cashLess: e.target.value })}
                                            onKeyDown={e => onKey(e, refAmount, null, refEntity)}
                                            style={INPUT_S}
                                        />
                                    </div>
                                    <div>
                                        <label style={LABEL_S}>{t('givenAmount') || (lang === 'ta' ? 'செலுத்தும் தொகை' : 'Given Amount')}</label>
                                        <input
                                            ref={refAmount}
                                            type="number"
                                            placeholder="0"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            onKeyDown={e => onKey(e, refNotes, formData.amount, refCashLess)}
                                            style={{ ...INPUT_S, border: '1.5px solid #16a34a', color: '#16a34a' }}
                                        />
                                    </div>
                                </>
                            )}

                            {/* --- Debit Form (Purchase Cash Paid) --- */}
                            {transactionType === 'debit' && (
                                <>
                                    <div>
                                        <label style={LABEL_S}>{lang === 'ta' ? 'விற்பனையாளர்' : 'Vendor'}</label>
                                        <SearchSelect
                                            items={vendors}
                                            value={formData.entityId}
                                            onChange={val => setFormData({ ...formData, entityId: val })}
                                            inputRef={refEntity}
                                            onKeyDown={e => onKey(e, refAmount)}
                                            placeholder={lang === 'ta' ? 'விற்பனையாளரைத் தேர்வுசெய்' : 'Select Vendor'}
                                        />
                                    </div>
                                    <div>
                                        <label style={LABEL_S}>{lang === 'ta' ? 'செலுத்தும் முறை' : 'Payment Method'}</label>
                                        <select
                                            value={formData.method}
                                            onChange={e => setFormData({ ...formData, method: e.target.value })}
                                            style={INPUT_S}
                                        >
                                            <option value="Cash">{lang === 'ta' ? 'பணம்' : 'Cash'}</option>
                                            <option value="Ready Cash">{lang === 'ta' ? 'ரொக்கம்' : 'Ready Cash'}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={LABEL_S}>{lang === 'ta' ? 'செலுத்திய தொகை' : 'Amount Paid'}</label>
                                        <input
                                            ref={refAmount}
                                            type="number"
                                            placeholder="0"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            onKeyDown={e => onKey(e, refNotes, formData.amount, refEntity)}
                                            style={{ ...INPUT_S, border: '1.5px solid #f43f5e', color: '#f43f5e' }}
                                        />
                                    </div>
                                </>
                            )}

                            {/* --- Expenses Form --- */}
                            {transactionType === 'internal' && internalSubtype === 'expenses' && (
                                <>
                                    <div>
                                        <label style={LABEL_S}>{lang === 'ta' ? 'வகை' : 'Category'}</label>
                                        <select
                                            ref={refEntity}
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            style={INPUT_S}
                                        >
                                            <option value="Petrol">{lang === 'ta' ? 'பெட்ரோல்' : 'Petrol'}</option>
                                            <option value="Food">{lang === 'ta' ? 'உணவு' : 'Food'}</option>
                                            <option value="Maintenance">{lang === 'ta' ? 'பராமரிப்பு' : 'Maintenance'}</option>
                                            <option value="Other">{lang === 'ta' ? 'இதர' : 'Other'}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={LABEL_S}>{lang === 'ta' ? 'பண ஆதாரம்' : 'Payment Source'}</label>
                                        <select
                                            value={formData.source}
                                            onChange={e => setFormData({ ...formData, source: e.target.value })}
                                            style={INPUT_S}
                                        >
                                            <option value="Cash">{lang === 'ta' ? 'பணம்' : 'Cash'}</option>
                                            <option value="Ready Cash">{lang === 'ta' ? 'ரொக்கம்' : 'Ready Cash'}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={LABEL_S}>{lang === 'ta' ? 'செலவுத் தொகை' : 'Expense Amount'}</label>
                                        <input
                                            ref={refAmount}
                                            type="number"
                                            placeholder="0"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            onKeyDown={e => onKey(e, refNotes, formData.amount, refEntity)}
                                            style={{ ...INPUT_S, border: '1.5px solid #ef4444', color: '#ef4444' }}
                                        />
                                    </div>
                                </>
                            )}

                            {/* --- Transfers Form --- */}
                            {transactionType === 'internal' && internalSubtype === 'transfers' && (
                                <>
                                    <div>
                                        <label style={LABEL_S}>{lang === 'ta' ? 'பெறும் பணியாளர்' : 'To Staff'}</label>
                                        <select
                                            ref={refEntity}
                                            value={formData.toSalesmanId}
                                            onChange={e => setFormData({ ...formData, toSalesmanId: e.target.value })}
                                            style={INPUT_S}
                                        >
                                            <option value="">{lang === 'ta' ? '-- பெறும் பணியாளரைத் தேர்வுசெய் --' : '-- Choose Receiver --'}</option>
                                            {activeSalesmen.filter(s => s.id !== salesmanId).map(s => (
                                                <option key={s.id} value={s.id}>{s.nameTa || s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={LABEL_S}>{lang === 'ta' ? 'பரிமாற்றத் தொகை' : 'Transfer Amount'}</label>
                                        <input
                                            ref={refAmount}
                                            type="number"
                                            placeholder="0"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            onKeyDown={e => onKey(e, refNotes, formData.amount, refEntity)}
                                            style={{ ...INPUT_S, border: '1.5px solid #3b82f6', color: '#3b82f6' }}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Note / Remarks */}
                            <div>
                                <label style={LABEL_S}>{t('notes') || 'Remarks'}</label>
                                <input
                                    ref={refNotes}
                                    type="text"
                                    placeholder={lang === 'ta' ? 'குறிப்பு...' : 'Short note...'}
                                    value={formData.note}
                                    onChange={e => setFormData({ ...formData, note: e.target.value })}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (e.shiftKey) {
                                                refAmount.current?.focus();
                                            } else {
                                                handleSave();
                                            }
                                        }
                                    }}
                                    style={INPUT_S}
                                />
                            </div>

                            {/* Action Button */}
                            <button
                                ref={refSaveBtn}
                                onClick={handleSave}
                                disabled={isSaving || !formData.amount}
                                style={{
                                    height: '40px', padding: '0 20px', borderRadius: '8px', border: 'none',
                                    background: '#16a34a', color: '#fff', fontWeight: 800, fontSize: '14px',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    transition: 'all 0.2s', opacity: (!formData.amount || isSaving) ? 0.6 : 1
                                }}
                            >
                                {isSaving ? (lang === 'ta' ? 'சேமிக்கப்படுகிறது...' : 'Saving...') : <><Plus size={16} /> {lang === 'ta' ? 'சேமி' : 'SAVE'}</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── History Table Card (Today's Live Entries) ── */}
            {salesmanId && (
                <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <History size={18} color="#64748b" />
                            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {lang === 'ta' ? 'இன்றைய பதிவுகள்' : 'Today\'s Live Entries'}
                            </h3>
                        </div>
                        <div style={{ background: '#16a34a', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>
                            {todayEntries.length} {lang === 'ta' ? 'பதிவு(கள்)' : (todayEntries.length === 1 ? 'ENTRY' : 'ENTRIES')}
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#fff', borderBottom: '1.5px solid #f1f5f9' }}>
                                    <th style={TH_S}><Clock size={12} style={{ marginRight: '6px', display: 'inline' }} />{lang === 'ta' ? 'நேரம்' : 'Time'}</th>
                                    <th style={TH_S}>{lang === 'ta' ? 'வகை' : 'Type'}</th>
                                    <th style={TH_S}>{lang === 'ta' ? 'விவரங்கள்' : 'Particulars'}</th>
                                    <th style={{ ...TH_S, textAlign: 'right' }}>{lang === 'ta' ? 'தொகை' : 'Amount'}</th>
                                    <th style={TH_S}>{lang === 'ta' ? 'செலுத்தும் முறை' : 'Method'}</th>
                                    <th style={TH_S}>{lang === 'ta' ? 'குறிப்பு' : 'Notes'}</th>
                                    <th style={{ ...TH_S, textAlign: 'center' }}>{lang === 'ta' ? 'செயல்' : 'Action'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {todayEntries.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', fontSize: '13.5px' }}>
                                            {lang === 'ta' ? 'இந்தத் தேதியில் இந்தப் பணியாளருக்குப் பதிவுகள் எதுவும் இல்லை.' : 'No entries recorded for this staff member on this date.'}
                                        </td>
                                    </tr>
                                ) : (
                                    todayEntries.map((item, idx) => {
                                        let displayType = '';
                                        let displayParticulars = '';
                                        let amountColor = '#1e293b';

                                        if (item.rowType === 'credit') {
                                            displayType = lang === 'ta' ? 'வரவு (விற்பனை பணம் பெறல்)' : 'Credit (Sales Rec)';
                                            const buyer = buyers.find(b => b.id === item.entityId);
                                            displayParticulars = buyer ? (buyer.nameTa || buyer.name) + ` (#${buyer.displayId || ''})` : '—';
                                            amountColor = '#16a34a'; // Green for cash received
                                        }
                                        else if (item.rowType === 'debit') {
                                            displayType = lang === 'ta' ? 'செலவு (கொள்முதல் பணம் கொடுத்தல்)' : 'Debit (Purchase Paid)';
                                            const vendor = vendors.find(v => v.id === item.entityId);
                                            displayParticulars = vendor ? (vendor.nameTa || vendor.name) + ` (#${vendor.displayId || ''})` : '—';
                                            amountColor = '#f43f5e'; // Rose for cash paid
                                        }
                                        else if (item.rowType === 'expense') {
                                            let cat = item.category;
                                            if (lang === 'ta') {
                                                if (cat === 'Petrol') cat = 'பெட்ரோல்';
                                                else if (cat === 'Food') cat = 'உணவு';
                                                else if (cat === 'Maintenance') cat = 'பராமரிப்பு';
                                                else if (cat === 'Other') cat = 'இதர';
                                            }
                                            displayType = lang === 'ta' ? `செலவு (${cat})` : `Expense (${item.category})`;
                                            displayParticulars = cat || '—';
                                            amountColor = '#ef4444'; // Red for expense
                                        }
                                        else if (item.rowType === 'transfer') {
                                            displayType = lang === 'ta' ? 'பணியாளர் பரிமாற்றம்' : 'Credit Transfer';
                                            const from = salesmen.find(s => s.id === item.fromSalesmanId);
                                            const to = salesmen.find(s => s.id === item.toSalesmanId);
                                            const fromName = from ? (from.nameTa || from.name) : item.fromSalesmanName;
                                            const toName = to ? (to.nameTa || to.name) : item.toSalesmanName;
                                            displayParticulars = `${fromName} ➜ ${toName}`;
                                            amountColor = '#3b82f6'; // Blue for transfer
                                        }

                                        return (
                                            <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                                <td style={{ ...TD_S, color: '#64748b', fontSize: '12.5px' }}>
                                                    {formatDate(item.timestamp || item.createdAt || item.date)}
                                                </td>
                                                <td style={{ ...TD_S, fontWeight: 700, fontSize: '13px' }}>
                                                    {displayType}
                                                </td>
                                                <td style={{ ...TD_S, fontWeight: 600 }}>
                                                    {displayParticulars}
                                                </td>
                                                <td style={{ ...TD_S, textAlign: 'right', fontWeight: 800, color: amountColor, fontSize: '14.5px' }}>
                                                    {fmt(item.amount)}
                                                    {item.cashLess > 0 && (
                                                        <div style={{ fontSize: '10px', color: '#f43f5e', fontWeight: 700 }}>Less: {fmt(item.cashLess)}</div>
                                                    )}
                                                </td>
                                                <td style={{ ...TD_S, color: '#475569', fontSize: '13px', fontWeight: 600 }}>
                                                    {(() => {
                                                        const val = item.method || item.source || 'Cash';
                                                        if (lang === 'ta') {
                                                            if (val === 'Cash') return 'பணம்';
                                                            if (val === 'Ready Cash') return 'ரொக்கம்';
                                                            if (val === 'UPI') return 'GPAY (UPI)';
                                                        }
                                                        return val;
                                                    })()}
                                                </td>
                                                <td style={{ ...TD_S, color: '#64748b', fontSize: '13px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span>{item.note || item.notes || '—'}</span>
                                                        <button onClick={() => handleEditNote(item)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', display: 'flex', padding: '2px' }}
                                                            onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
                                                            onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                                                        ><Pencil size={12} /></button>
                                                    </div>
                                                </td>
                                                <td style={{ ...TD_S, textAlign: 'center' }}>
                                                    <button onClick={() => handleDelete(item)}
                                                        style={{
                                                            background: '#fff1f2',
                                                            border: 'none', borderRadius: '6px', width: '28px', height: '28px',
                                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                            cursor: 'pointer', color: '#f43f5e'
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = '#f43f5e'; e.currentTarget.style.color = '#fff'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#f43f5e'; }}
                                                    ><Trash2 size={13} /></button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            <VoiceEntryModal
                isOpen={isVoiceModalOpen}
                onClose={() => setIsVoiceModalOpen(false)}
                onConfirm={handleVoiceConfirm}
                entities={getVoiceModalEntities()}
                salesmen={salesmen}
                type={getVoiceModalType()}
                langSetting={lang}
            />
        </div>
    );
};

export default Payments;
