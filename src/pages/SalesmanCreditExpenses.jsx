import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Trash2, Calendar, DollarSign, FileText, User, Pencil, X } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { subscribeToCollection, addData, updateData, db, deleteDoc } from '../utils/storage';
import { LangContext } from '../components/Layout';
import CashPurchase from './CashPurchase';
import CashSales from './CashSales';

const fmt = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const toDateStr = (d) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

const LABEL_S = {
    fontSize: '11px', fontWeight: 700, color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block'
};

const INPUT_S = {
    width: '100%', padding: '10px 12px', borderRadius: '10px',
    border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '13px',
    fontWeight: 600, color: '#334155', boxSizing: 'border-box', background: '#fff'
};

const TH_S = {
    padding: '12px 14px', textAlign: 'left',
    fontSize: '11px', fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    borderBottom: '1.5px solid #e2e8f0', background: '#f8fafc'
};

const TD_S = {
    padding: '12px 14px', fontSize: '13px',
    color: '#334155', borderBottom: '1px solid #f1f5f9',
    fontWeight: 650
};

const SalesmanCreditExpenses = () => {
    const { lang } = useContext(LangContext);
    const locationState = useLocation().state;
    const [activeTab, setActiveTab] = useState(locationState?.tab || 'expenses'); // 'expenses', 'credit', 'cash-purchase', 'cash-sales'

    const [salesmen, setSalesmen] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [transfers, setTransfers] = useState([]);

    // Custom Categories State
    const [customCategories, setCustomCategories] = useState([]);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newCatNameTa, setNewCatNameTa] = useState('');
    const [savingCategory, setSavingCategory] = useState(false);

    // Expense Form State
    const [editingExpenseId, setEditingExpenseId] = useState(null);
    const [expSalesmanId, setExpSalesmanId] = useState('');
    const [expDate, setExpDate] = useState(toDateStr(new Date()));
    const [expCategory, setExpCategory] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expNotes, setExpNotes] = useState('');
    const [savingExpense, setSavingExpense] = useState(false);

    // Credit Transfer Form State
    const [editingTransferId, setEditingTransferId] = useState(null);
    const [fromSalesmanId, setFromSalesmanId] = useState('');
    const [toSalesmanId, setToSalesmanId] = useState('');
    const [transDate, setTransDate] = useState(toDateStr(new Date()));
    const [transAmount, setTransAmount] = useState('');
    const [transNotes, setTransNotes] = useState('');
    const [savingTransfer, setSavingTransfer] = useState(false);

    useEffect(() => {
        const u1 = subscribeToCollection('salesmen', setSalesmen, true);
        const u2 = subscribeToCollection('salesman_expenses', setExpenses, true);
        const u3 = subscribeToCollection('salesman_transfers', setTransfers, true);
        const u4 = subscribeToCollection('expense_categories', setCustomCategories, true);

        return () => {
            u1();
            u2();
            u3();
            u4();
        };
    }, []);

    const allCategories = useMemo(() => {
        return customCategories.filter(c => c.name);
    }, [customCategories]);

    const handleAutoTranslateCategory = async (val) => {
        setNewCatName(val);
        if (val.trim().length > 2) {
            try {
                const resp = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ta&dt=t&q=${encodeURIComponent(val)}`);
                const data = await resp.json();
                if (data && data[0] && data[0][0] && data[0][0][0]) {
                    setNewCatNameTa(data[0][0][0]);
                }
            } catch { }
        }
    };

    const handleAddCategory = async (e) => {
        if (e) e.preventDefault();
        if (!newCatName.trim() || savingCategory) return;
        setSavingCategory(true);

        try {
            const trimmedName = newCatName.trim();
            const trimmedNameTa = newCatNameTa.trim() || trimmedName;

            const exists = allCategories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase());
            if (exists) {
                alert(lang === 'ta' ? '❌ இந்த வகை ஏற்கனவே உள்ளது!' : '❌ Category already exists!');
                setSavingCategory(false);
                return;
            }

            const newCatDoc = {
                name: trimmedName,
                nameTa: trimmedNameTa,
                createdAt: new Date().toISOString()
            };

            await addData('expense_categories', newCatDoc);
            setExpCategory(trimmedName);
            setNewCatName('');
            setNewCatNameTa('');
            setIsCategoryModalOpen(false);
            alert(lang === 'ta' ? '✅ புதிய வகை வெற்றிகரமாக சேமிக்கப்பட்டது!' : '✅ Custom category added successfully!');
        } catch (err) {
            alert('Failed to add category: ' + err.message);
        } finally {
            setSavingCategory(false);
        }
    };

    const handleDeleteCategory = async (catId) => {
        if (!window.confirm(lang === 'ta' ? 'நிச்சயமாக இந்த வகையை நீக்க வேண்டுமா?' : 'Are you sure you want to delete this category?')) return;
        try {
            await deleteDoc(doc(db, 'expense_categories', catId));
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    };

    // Filter active salesmen
    const activeSalesmen = useMemo(() => {
        return salesmen.filter(s => s.status === 'Active');
    }, [salesmen]);

    // Handle edit expense
    const handleEditExpense = (exp) => {
        setEditingExpenseId(exp.id);
        setExpSalesmanId(exp.salesmanId);
        setExpDate(exp.date);
        setExpCategory(exp.category || '');
        setExpAmount(exp.amount.toString());
        setExpNotes(exp.notes || '');
    };

    const handleCancelEditExpense = () => {
        setEditingExpenseId(null);
        setExpSalesmanId('');
        setExpDate(toDateStr(new Date()));
        setExpCategory('');
        setExpAmount('');
        setExpNotes('');
    };

    // Handle edit transfer
    const handleEditTransfer = (t) => {
        setEditingTransferId(t.id);
        setFromSalesmanId(t.fromSalesmanId);
        setToSalesmanId(t.toSalesmanId);
        setTransDate(t.date);
        setTransAmount(t.amount.toString());
        setTransNotes(t.notes || '');
    };

    const handleCancelEditTransfer = () => {
        setEditingTransferId(null);
        setFromSalesmanId('');
        setToSalesmanId('');
        setTransDate(toDateStr(new Date()));
        setTransAmount('');
        setTransNotes('');
    };

    // Handle add expense
    const handleAddExpense = async (e) => {
        if (e) e.preventDefault();
        if (!expSalesmanId || !expAmount || savingExpense) return;
        if (!expCategory) {
            alert(lang === 'ta' ? 'தயவுசெய்து செலவு வகையைத் தேர்ந்தெடுக்கவும்' : 'Please select an expense category');
            return;
        }
        setSavingExpense(true);

        try {
            const salesman = salesmen.find(s => s.id === expSalesmanId);
            const expenseData = {
                salesmanId: expSalesmanId,
                salesmanName: salesman?.name || 'Unknown',
                date: expDate,
                category: expCategory,
                amount: parseFloat(expAmount),
                notes: expNotes
            };

            if (editingExpenseId) {
                await updateData('salesman_expenses', editingExpenseId, expenseData);
                setEditingExpenseId(null);
                alert(lang === 'ta' ? '✅ செலவு வெற்றிகரமாக புதுப்பிக்கப்பட்டது!' : '✅ Expense updated successfully!');
            } else {
                await addData('salesman_expenses', expenseData);
                alert(lang === 'ta' ? '✅ செலவு வெற்றிகரமாக சேமிக்கப்பட்டது!' : '✅ Expense recorded successfully!');
            }
            setExpCategory('');
            setExpAmount('');
            setExpNotes('');
        } catch (err) {
            alert('❌ Failed to save expense: ' + err.message);
        } finally {
            setSavingExpense(false);
        }
    };

    // Handle add credit transfer
    const handleAddTransfer = async (e) => {
        if (e) e.preventDefault();
        if (!fromSalesmanId || !toSalesmanId || !transAmount || savingTransfer) return;
        if (fromSalesmanId === toSalesmanId) {
            alert('❌ Sender and receiver cannot be the same staff member.');
            return;
        }
        setSavingTransfer(true);

        try {
            const fromSalesman = salesmen.find(s => s.id === fromSalesmanId);
            const toSalesman = salesmen.find(s => s.id === toSalesmanId);

            const transferData = {
                fromSalesmanId,
                fromSalesmanName: fromSalesman?.name || 'Unknown',
                toSalesmanId,
                toSalesmanName: toSalesman?.name || 'Unknown',
                date: transDate,
                amount: parseFloat(transAmount),
                notes: transNotes
            };

            if (editingTransferId) {
                await updateData('salesman_transfers', editingTransferId, transferData);
                setEditingTransferId(null);
                alert(lang === 'ta' ? '✅ பரிமாற்றம் வெற்றிகரமாக புதுப்பிக்கப்பட்டது!' : '✅ Credit transfer updated successfully!');
            } else {
                await addData('salesman_transfers', transferData);
                alert(lang === 'ta' ? '✅ பரிமாற்றம் வெற்றிகரமாக சேமிக்கப்பட்டது!' : '✅ Credit transfer recorded successfully!');
            }
            setTransAmount('');
            setTransNotes('');
        } catch (err) {
            alert('❌ Failed to save transfer: ' + err.message);
        } finally {
            setSavingTransfer(false);
        }
    };

    // Handle delete expense
    const handleDeleteExpense = async (id) => {
        if (!window.confirm(lang === 'ta' ? 'நிச்சயமாக நீக்க வேண்டுமா?' : 'Are you sure you want to delete this expense?')) return;
        try {
            await deleteDoc(doc(db, 'salesman_expenses', id));
            if (editingExpenseId === id) {
                handleCancelEditExpense();
            }
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    };

    // Handle delete transfer
    const handleDeleteTransfer = async (id) => {
        if (!window.confirm(lang === 'ta' ? 'நிச்சயமாக நீக்க வேண்டுமா?' : 'Are you sure you want to delete this transfer?')) return;
        try {
            await deleteDoc(doc(db, 'salesman_transfers', id));
            if (editingTransferId === id) {
                handleCancelEditTransfer();
            }
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    };

    // Sorted items list
    const sortedExpenses = useMemo(() => {
        return [...expenses].sort((a, b) => b.date.localeCompare(a.date));
    }, [expenses]);

    const sortedTransfers = useMemo(() => {
        return [...transfers].sort((a, b) => b.date.localeCompare(a.date));
    }, [transfers]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
            
            {/* Navigation Tabs */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap', gap: '4px' }}>
                <button
                    onClick={() => setActiveTab('expenses')}
                    style={{
                        padding: '10px 20px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 800,
                        cursor: 'pointer', transition: 'all 0.2s',
                        background: activeTab === 'expenses' ? '#fff' : 'transparent',
                        color: activeTab === 'expenses' ? '#ef4444' : '#64748b',
                        boxShadow: activeTab === 'expenses' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                    }}
                >
                    {lang === 'ta' ? 'செலவுகள்' : 'Expenses'}
                </button>
                <button
                    onClick={() => setActiveTab('credit')}
                    style={{
                        padding: '10px 20px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 800,
                        cursor: 'pointer', transition: 'all 0.2s',
                        background: activeTab === 'credit' ? '#fff' : 'transparent',
                        color: activeTab === 'credit' ? '#3b82f6' : '#64748b',
                        boxShadow: activeTab === 'credit' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                    }}
                >
                    {lang === 'ta' ? 'பரிமாற்றம்' : 'Credit Transfers'}
                </button>
                <button
                    onClick={() => setActiveTab('cash-purchase')}
                    style={{
                        padding: '10px 20px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 800,
                        cursor: 'pointer', transition: 'all 0.2s',
                        background: activeTab === 'cash-purchase' ? '#fff' : 'transparent',
                        color: activeTab === 'cash-purchase' ? '#d97706' : '#64748b',
                        boxShadow: activeTab === 'cash-purchase' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                    }}
                >
                    {lang === 'ta' ? 'ரொக்கக் கொள்முதல்' : 'Cash Purchase'}
                </button>
                <button
                    onClick={() => setActiveTab('cash-sales')}
                    style={{
                        padding: '10px 20px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 800,
                        cursor: 'pointer', transition: 'all 0.2s',
                        background: activeTab === 'cash-sales' ? '#fff' : 'transparent',
                        color: activeTab === 'cash-sales' ? '#10b981' : '#64748b',
                        boxShadow: activeTab === 'cash-sales' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                    }}
                >
                    {lang === 'ta' ? 'ரொக்க விற்பனை' : 'Cash Sales'}
                </button>
            </div>

            {activeTab === 'expenses' && (
                // ── EXPENSES TAB ──
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    
                    {/* Add Expense Box */}
                    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', height: 'fit-content' }}>
                        <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 900, color: '#1e293b' }}>
                            {editingExpenseId 
                                ? (lang === 'ta' ? 'செலவு விவரங்களை திருத்துக' : 'Edit Expense Details') 
                                : (lang === 'ta' ? 'செலவு சேர்' : 'Add Expense')}
                        </h3>
                        <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'பணியாளர்' : 'Select Staff'}</label>
                                <select value={expSalesmanId} onChange={e => setExpSalesmanId(e.target.value)} required style={INPUT_S}>
                                    <option value="">{lang === 'ta' ? 'தேர்வு செய்க...' : 'Choose Staff...'}</option>
                                    {activeSalesmen.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} (#{s.displayId})</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={LABEL_S}>{lang === 'ta' ? 'தேதி' : 'Date'}</label>
                                    <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} required style={INPUT_S} />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label style={{ ...LABEL_S, marginBottom: 0 }}>{lang === 'ta' ? 'வகை' : 'Category'}</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsCategoryModalOpen(true)}
                                            style={{ border: 'none', background: 'none', color: '#4f46e5', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}
                                        >
                                            <Plus size={12} /> {lang === 'ta' ? 'வகை மேலாண்மை' : 'Manage Categories'}
                                        </button>
                                    </div>
                                    <select 
                                        value={expCategory} 
                                        onChange={e => {
                                            if (e.target.value === '__ADD_NEW__') {
                                                setIsCategoryModalOpen(true);
                                            } else {
                                                setExpCategory(e.target.value);
                                            }
                                        }} 
                                        required
                                        style={INPUT_S}
                                    >
                                        <option value="">{lang === 'ta' ? 'வகை தேர்வு செய்க...' : 'Select Category...'}</option>
                                        {allCategories.map(c => (
                                            <option key={c.id || c.name} value={c.name}>
                                                {lang === 'ta' ? (c.nameTa || c.name) : c.name}
                                            </option>
                                        ))}
                                        <option value="__ADD_NEW__">➕ {lang === 'ta' ? '+ புதிய வகை சேர்...' : '+ Add Custom Category...'}</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'செலவு தொகை' : 'Expense Amount'}</label>
                                <input type="number" inputMode="decimal" placeholder="0.00" value={expAmount} onChange={e => setExpAmount(e.target.value)} required style={INPUT_S} />
                            </div>

                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'குறிப்பு' : 'Notes / Remarks'}</label>
                                <input type="text" placeholder={lang === 'ta' ? 'எ.கா. பெட்ரோல் செலவு' : 'e.g. Petrol bill'} value={expNotes} onChange={e => setExpNotes(e.target.value)} style={INPUT_S} />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                <button
                                    type="submit"
                                    disabled={savingExpense}
                                    style={{
                                        flex: 1, padding: '12px', background: '#ef4444', color: '#fff',
                                        border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer',
                                        fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        boxShadow: '0 4px 12px rgba(239,68,68,0.2)'
                                    }}
                                >
                                    <Plus size={16} />
                                    {lang === 'ta' 
                                        ? (editingExpenseId ? 'மாற்றங்களைச் சேமி' : 'செலவைச் சேமி') 
                                        : (editingExpenseId ? 'Save Changes' : 'Save Expense')}
                                </button>
                                {editingExpenseId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEditExpense}
                                        style={{
                                            padding: '12px 18px', background: '#f1f5f9', color: '#64748b',
                                            border: '1.5px solid #e2e8f0', borderRadius: '12px', fontWeight: 800, cursor: 'pointer',
                                            fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                        }}
                                    >
                                        <X size={16} />
                                        {lang === 'ta' ? 'ரத்து' : 'Cancel'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Expense Details list */}
                    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 900, color: '#1e293b' }}>
                            {lang === 'ta' ? 'செலவுகள் பட்டியல்' : 'Expenses List'}
                        </h3>
                        <div style={{ overflowX: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...TH_S, width: '40px' }}>S.No</th>
                                        <th style={TH_S}>{lang === 'ta' ? 'தேதி' : 'Date'}</th>
                                        <th style={TH_S}>{lang === 'ta' ? 'பணியாளர் பெயர்' : 'Staff'}</th>
                                        <th style={TH_S}>{lang === 'ta' ? 'வகை' : 'Category'}</th>
                                        <th style={{ ...TH_S, textAlign: 'right' }}>{lang === 'ta' ? 'தொகை' : 'Amount'}</th>
                                        <th style={{ ...TH_S, textAlign: 'center' }}>{lang === 'ta' ? 'செயல்' : 'Action'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedExpenses.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '36px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                                {lang === 'ta' ? 'செலவு பதிவுகள் எதுவும் இல்லை.' : 'No expenses recorded.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedExpenses.map((exp, idx) => (
                                            <tr key={exp.id}>
                                                <td style={TD_S}>{idx + 1}</td>
                                                <td style={TD_S}>{exp.date.split('-').reverse().join('/')}</td>
                                                <td style={TD_S}>
                                                    <div style={{ fontWeight: 700 }}>{exp.salesmanName}</div>
                                                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{exp.notes}</div>
                                                </td>
                                                <td style={TD_S}>
                                                    <span style={{ fontSize: '9px', background: '#fef2f2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase' }}>
                                                        {(() => {
                                                            const found = allCategories.find(c => c.name.toLowerCase() === (exp.category || '').toLowerCase());
                                                            return lang === 'ta' ? (found?.nameTa || exp.category) : (found?.name || exp.category);
                                                        })()}
                                                    </span>
                                                </td>
                                                <td style={{ ...TD_S, textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{fmt(exp.amount)}</td>
                                                <td style={{ ...TD_S, textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                        <button 
                                                            onClick={() => handleEditExpense(exp)} 
                                                            title={lang === 'ta' ? 'திருத்து' : 'Edit'}
                                                            style={{ border: 'none', background: 'none', color: '#3b82f6', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                        >
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteExpense(exp.id)} 
                                                            title={lang === 'ta' ? 'நீக்கு' : 'Delete'}
                                                            style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'credit' && (
                // ── CREDIT TRANSFER TAB ──
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    
                    {/* Add Transfer Form */}
                    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', height: 'fit-content' }}>
                        <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 900, color: '#1e293b' }}>
                            {editingTransferId 
                                ? (lang === 'ta' ? 'கடனைப் புதுப்பிக்கவும்' : 'Edit Credit Transfer') 
                                : (lang === 'ta' ? 'கடன் / பணம் பரிமாற்றம்' : 'Add Credit Transfer')}
                        </h3>
                        <form onSubmit={handleAddTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'பணம் வழங்குபவர்' : 'Sender (From Staff)'}</label>
                                <select value={fromSalesmanId} onChange={e => setFromSalesmanId(e.target.value)} required style={INPUT_S}>
                                    <option value="">{lang === 'ta' ? 'தேர்வு செய்க...' : 'Choose Staff...'}</option>
                                    {activeSalesmen.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} (#{s.displayId})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'பணம் பெறுபவர்' : 'Receiver (To Staff)'}</label>
                                <select value={toSalesmanId} onChange={e => setToSalesmanId(e.target.value)} required style={INPUT_S}>
                                    <option value="">{lang === 'ta' ? 'தேர்வு செய்க...' : 'Choose Staff...'}</option>
                                    {activeSalesmen.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} (#{s.displayId})</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={LABEL_S}>{lang === 'ta' ? 'தேதி' : 'Date'}</label>
                                    <input type="date" value={transDate} onChange={e => setTransDate(e.target.value)} required style={INPUT_S} />
                                </div>
                                <div>
                                    <label style={LABEL_S}>{lang === 'ta' ? 'தொகை' : 'Amount'}</label>
                                    <input type="number" inputMode="decimal" placeholder="0.00" value={transAmount} onChange={e => setTransAmount(e.target.value)} required style={INPUT_S} />
                                </div>
                            </div>

                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'குறிப்பு' : 'Notes / Remarks'}</label>
                                <input type="text" placeholder={lang === 'ta' ? 'எ.கா. ரொக்கப் பரிமாற்றம்' : 'e.g. Cash handed over'} value={transNotes} onChange={e => setTransNotes(e.target.value)} style={INPUT_S} />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                <button
                                    type="submit"
                                    disabled={savingTransfer}
                                    style={{
                                        flex: 1, padding: '12px', background: '#3b82f6', color: '#fff',
                                        border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer',
                                        fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        boxShadow: '0 4px 12px rgba(59,130,246,0.2)'
                                    }}
                                >
                                    <Plus size={16} />
                                    {lang === 'ta' 
                                        ? (editingTransferId ? 'மாற்றங்களைச் சேமி' : 'பரிமாற்றத்தைச் சேமி') 
                                        : (editingTransferId ? 'Save Changes' : 'Save Transfer')}
                                </button>
                                {editingTransferId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEditTransfer}
                                        style={{
                                            padding: '12px 18px', background: '#f1f5f9', color: '#64748b',
                                            border: '1.5px solid #e2e8f0', borderRadius: '12px', fontWeight: 800, cursor: 'pointer',
                                            fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                        }}
                                    >
                                        <X size={16} />
                                        {lang === 'ta' ? 'ரத்து' : 'Cancel'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Credit Transfers List */}
                    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 900, color: '#1e293b' }}>
                            {lang === 'ta' ? 'பரிமாற்றங்கள் பட்டியல்' : 'Credit Transfers List'}
                        </h3>
                        <div style={{ overflowX: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...TH_S, width: '40px' }}>S.No</th>
                                        <th style={TH_S}>{lang === 'ta' ? 'தேதி' : 'Date'}</th>
                                        <th style={TH_S}>{lang === 'ta' ? 'வழங்குபவர்' : 'Sender'}</th>
                                        <th style={TH_S}>{lang === 'ta' ? 'பெறுபவர்' : 'Receiver'}</th>
                                        <th style={{ ...TH_S, textAlign: 'right' }}>{lang === 'ta' ? 'தொகை' : 'Amount'}</th>
                                        <th style={{ ...TH_S, textAlign: 'center' }}>{lang === 'ta' ? 'செயல்' : 'Action'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedTransfers.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '36px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                                {lang === 'ta' ? 'பரிமாற்றப் பதிவுகள் எதுவும் இல்லை.' : 'No transfers recorded.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedTransfers.map((t, idx) => (
                                            <tr key={t.id}>
                                                <td style={TD_S}>{idx + 1}</td>
                                                <td style={TD_S}>{t.date.split('-').reverse().join('/')}</td>
                                                <td style={TD_S}>
                                                    <div style={{ fontWeight: 700, color: '#ef4444' }}>{t.fromSalesmanName}</div>
                                                </td>
                                                <td style={TD_S}>
                                                    <div style={{ fontWeight: 700, color: '#10b981' }}>{t.toSalesmanName}</div>
                                                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{t.notes}</div>
                                                </td>
                                                <td style={{ ...TD_S, textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>{fmt(t.amount)}</td>
                                                <td style={{ ...TD_S, textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                        <button 
                                                            onClick={() => handleEditTransfer(t)} 
                                                            title={lang === 'ta' ? 'திருத்து' : 'Edit'}
                                                            style={{ border: 'none', background: 'none', color: '#3b82f6', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                        >
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteTransfer(t.id)} 
                                                            title={lang === 'ta' ? 'நீக்கு' : 'Delete'}
                                                            style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'cash-purchase' && (
                <CashPurchase />
            )}

            {activeTab === 'cash-sales' && (
                <CashSales />
            )}

            {/* ── Category Manager Modal ── */}
            {isCategoryModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '24px', width: '480px', maxWidth: '90vw', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontWeight: 900, color: '#1e293b', fontSize: '16px' }}>
                                📁 {lang === 'ta' ? 'செலவு வகைகள் மேலாண்மை' : 'Expense Categories'}
                            </h3>
                            <button onClick={() => setIsCategoryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                        </div>

                        {/* Add New Category Form */}
                        <form onSubmit={handleAddCategory} style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                ➕ {lang === 'ta' ? 'புதிய வகை சேர்' : 'Add New Category'}
                            </span>
                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'வகை பெயர் (ஆங்கிலம்)' : 'Category Name (English)'}</label>
                                <input 
                                    type="text" 
                                    value={newCatName} 
                                    onChange={e => handleAutoTranslateCategory(e.target.value)} 
                                    placeholder="e.g. Tea / Refreshment" 
                                    required 
                                    style={INPUT_S} 
                                />
                            </div>
                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'வகை பெயர் (தமிழ்)' : 'Category Name (Tamil)'}</label>
                                <input 
                                    type="text" 
                                    value={newCatNameTa} 
                                    onChange={e => setNewCatNameTa(e.target.value)} 
                                    placeholder="எ.கா. டீ / சிற்றுண்டி" 
                                    style={INPUT_S} 
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={savingCategory || !newCatName.trim()}
                                style={{
                                    padding: '10px', background: '#4338ca', color: '#fff',
                                    border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer',
                                    fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    opacity: (savingCategory || !newCatName.trim()) ? 0.6 : 1
                                }}
                            >
                                <Plus size={16} /> {savingCategory ? (lang === 'ta' ? 'சேமிக்கப்படுகிறது...' : 'Saving...') : (lang === 'ta' ? 'வகை சேர்' : 'Add Category')}
                            </button>
                        </form>

                        {/* List of Custom Categories */}
                        <div>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', display: 'block' }}>
                                {lang === 'ta' ? 'தனிப்பயன் வகைகள்' : 'Custom Categories'}
                            </span>
                            {customCategories.length === 0 ? (
                                <div style={{ padding: '16px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                    {lang === 'ta' ? 'தனிப்பயன் வகைகள் எதுவும் இல்லை.' : 'No custom categories created yet.'}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {customCategories.map(cat => (
                                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f1f5f9', borderRadius: '10px' }}>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{cat.name}</div>
                                                {cat.nameTa && cat.nameTa !== cat.name && <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{cat.nameTa}</div>}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                title={lang === 'ta' ? 'நீக்கு' : 'Delete'}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesmanCreditExpenses;
