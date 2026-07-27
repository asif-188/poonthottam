import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Plus, Trash2, Calendar, DollarSign, FileText, User, Pencil, X } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { subscribeToCollection, addData, updateData, db, deleteDoc } from '../utils/storage';
import { LangContext } from '../components/Layout';

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
    const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' or 'credit'

    const [salesmen, setSalesmen] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [transfers, setTransfers] = useState([]);

    // Expense Form State
    const [editingExpenseId, setEditingExpenseId] = useState(null);
    const [expSalesmanId, setExpSalesmanId] = useState('');
    const [expDate, setExpDate] = useState(toDateStr(new Date()));
    const [expCategory, setExpCategory] = useState('Petrol');
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

        return () => {
            u1();
            u2();
            u3();
        };
    }, []);

    // Filter active salesmen
    const activeSalesmen = useMemo(() => {
        return salesmen.filter(s => s.status === 'Active');
    }, [salesmen]);

    // Handle edit expense
    const handleEditExpense = (exp) => {
        setEditingExpenseId(exp.id);
        setExpSalesmanId(exp.salesmanId);
        setExpDate(exp.date);
        setExpCategory(exp.category);
        setExpAmount(exp.amount.toString());
        setExpNotes(exp.notes || '');
    };

    const handleCancelEditExpense = () => {
        setEditingExpenseId(null);
        setExpSalesmanId('');
        setExpDate(toDateStr(new Date()));
        setExpCategory('Petrol');
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
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '14px', width: 'fit-content' }}>
                <button
                    onClick={() => setActiveTab('expenses')}
                    style={{
                        padding: '10px 24px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 800,
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
                        padding: '10px 24px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 800,
                        cursor: 'pointer', transition: 'all 0.2s',
                        background: activeTab === 'credit' ? '#fff' : 'transparent',
                        color: activeTab === 'credit' ? '#3b82f6' : '#64748b',
                        boxShadow: activeTab === 'credit' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                    }}
                >
                    {lang === 'ta' ? 'கடன்கள்' : 'Credit Transfers'}
                </button>
            </div>

            {activeTab === 'expenses' ? (
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
                                    <label style={LABEL_S}>{lang === 'ta' ? 'வகை' : 'Category'}</label>
                                    <select value={expCategory} onChange={e => setExpCategory(e.target.value)} style={INPUT_S}>
                                        <option value="Petrol">{lang === 'ta' ? 'பெட்ரோல்' : 'Petrol'}</option>
                                        <option value="Food">{lang === 'ta' ? 'உணவு' : 'Food'}</option>
                                        <option value="Maintenance">{lang === 'ta' ? 'பராமரிப்பு' : 'Maintenance'}</option>
                                        <option value="Other">{lang === 'ta' ? 'இதர' : 'Other'}</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'செலவு தொகை' : 'Expense Amount'}</label>
                                <input type="number" placeholder="0.00" value={expAmount} onChange={e => setExpAmount(e.target.value)} required style={INPUT_S} />
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
                                                        {exp.category}
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
            ) : (
                // ── CREDIT TRANSFER TAB ──
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    
                    {/* Add Transfer Form */}
                    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', height: 'fit-content' }}>
                        <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 900, color: '#1e293b' }}>
                            {editingTransferId 
                                ? (lang === 'ta' ? 'பரிமாற்ற விவரங்களை திருத்துக' : 'Edit Transfer Details') 
                                : (lang === 'ta' ? 'மாற்றுப் பணம் பதிவு' : 'New Credit Transfer')}
                        </h3>
                        <form onSubmit={handleAddTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'அனுப்பிய பணியாளர்' : 'From Staff (Giver)'}</label>
                                <select value={fromSalesmanId} onChange={e => setFromSalesmanId(e.target.value)} required style={INPUT_S}>
                                    <option value="">{lang === 'ta' ? 'தேர்வு செய்க...' : 'Choose Staff...'}</option>
                                    {activeSalesmen.filter(s => s.id !== toSalesmanId).map(s => (
                                        <option key={s.id} value={s.id}>{s.name} (#{s.displayId})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'பெறும் பணியாளர்' : 'To Staff (Receiver)'}</label>
                                <select value={toSalesmanId} onChange={e => setToSalesmanId(e.target.value)} required style={INPUT_S}>
                                    <option value="">{lang === 'ta' ? 'தேர்வு செய்க...' : 'Choose Staff...'}</option>
                                    {activeSalesmen.filter(s => s.id !== fromSalesmanId).map(s => (
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
                                    <input type="number" placeholder="0.00" value={transAmount} onChange={e => setTransAmount(e.target.value)} required style={INPUT_S} />
                                </div>
                            </div>

                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'குறிப்பு' : 'Notes / Remarks'}</label>
                                <input type="text" placeholder={lang === 'ta' ? 'விவரம்...' : 'Details...'} value={transNotes} onChange={e => setTransNotes(e.target.value)} style={INPUT_S} />
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
                                        ? (editingTransferId ? 'மாற்றங்களைச் சேமி' : 'பரிமாற்றத்தை சேமி') 
                                        : (editingTransferId ? 'Save Changes' : 'Transfer Credit')}
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

                    {/* Transfers Details list */}
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
                                        <th style={TH_S}>{lang === 'ta' ? 'அனுப்பியவர்' : 'From'}</th>
                                        <th style={TH_S}>{lang === 'ta' ? 'பெற்றவர்' : 'To'}</th>
                                        <th style={{ ...TH_S, textAlign: 'right' }}>{lang === 'ta' ? 'தொகை' : 'Amount'}</th>
                                        <th style={{ ...TH_S, textAlign: 'center' }}>{lang === 'ta' ? 'செயல்' : 'Action'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedTransfers.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '36px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                                {lang === 'ta' ? 'மாற்றுப் பணம் பதிவுகள் எதுவும் இல்லை.' : 'No transfers recorded.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedTransfers.map((t, idx) => (
                                            <tr key={t.id}>
                                                <td style={TD_S}>{idx + 1}</td>
                                                <td style={TD_S}>{t.date.split('-').reverse().join('/')}</td>
                                                <td style={{ ...TD_S, color: '#dc2626', fontWeight: 700 }}>{t.fromSalesmanName}</td>
                                                <td style={{ ...TD_S, color: '#16a34a', fontWeight: 700 }}>
                                                    <div>{t.toSalesmanName}</div>
                                                    <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>{t.notes}</div>
                                                </td>
                                                <td style={{ ...TD_S, textAlign: 'right', fontWeight: 750, color: '#1e293b' }}>{fmt(t.amount)}</td>
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
        </div>
    );
};

export default SalesmanCreditExpenses;
