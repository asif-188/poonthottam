import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { 
    db, 
    saveFarmer, 
    saveBuyer, 
    savePayment, 
    saveVendor, 
    saveSalesman, 
    saveProduct, 
    saveCashPurchase, 
    saveCashSale, 
    saveSale,
    saveOutsidePurchase,
    addData, 
    subscribeToCollection 
} from '../utils/storage';
import { doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { LangContext } from '../components/Layout';
import { useTenant } from '../utils/TenantContext';
import { Plus, User, Calendar, CheckCircle2, Mic, Trash2, Printer, Share2, ShoppingBag, CreditCard, ArrowRight } from 'lucide-react';
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
        fontSize: '11px',
        fontWeight: 800,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: '6px',
    },
    input: {
        width: '100%',
        padding: '11px 15px',
        borderRadius: '10px',
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
        padding: '12px 24px',
        borderRadius: '10px',
        border: 'none',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        color: '#fff',
        fontWeight: 800,
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'transform 0.15s, opacity 0.15s',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        boxShadow: '0 4px 12px rgba(16,185,129,0.2)',
    },
    btnCancel: {
        padding: '12px 20px',
        background: '#f1f5f9',
        color: '#475569',
        border: '1.5px solid #cbd5e1',
        borderRadius: '10px',
        fontWeight: 800,
        fontSize: '13px',
        cursor: 'pointer',
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
    },
    sectionTitle: {
        fontSize: '16px',
        fontWeight: 800,
        color: '#1e293b',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '2px solid #f1f5f9',
        paddingBottom: '10px',
        marginBottom: '16px',
    }
};

const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

const displayDate = (iso) => {
    if (!iso || typeof iso !== 'string') return '---';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const SearchSelect = ({ items, value, onChange, placeholder, lang, disabled }) => {
    const [query, setQuery]         = useState('');
    const [open, setOpen]           = useState(false);
    const [cursor, setCursor]       = useState(0);
    const listRef                   = useRef(null);

    const formatName = (item) => {
        if (!item) return '';
        if (lang === 'ta') {
            return item.taName || item.nameTa || item.name;
        }
        return item.name;
    };

    const selectedItem = items.find(i => i.id === value || i.name === value || (i.displayId && String(i.displayId) === String(value)));
    const selectedName = selectedItem ? formatName(selectedItem) : '';

    const filtered = query.trim()
        ? items
            .filter(i => {
                const n = i.name?.toLowerCase() || '';
                const tn = i.taName?.toLowerCase() || i.nameTa?.toLowerCase() || '';
                const q = query.toLowerCase();
                return n.includes(q) || tn.includes(q) || (i.displayId && String(i.displayId).includes(query));
            })
            .sort((a, b) => {
                const q = query.toLowerCase();
                const getScore = (item) => {
                    const n = item.name?.toLowerCase() || '';
                    const tn = item.taName?.toLowerCase() || item.nameTa?.toLowerCase() || '';
                    const id = item.displayId ? String(item.displayId).toLowerCase() : '';
                    if (n.startsWith(q) || tn.startsWith(q) || id.startsWith(q)) return 3;
                    if (n.includes(' ' + q) || tn.includes(' ' + q)) return 2;
                    return 0;
                };
                return getScore(b) - getScore(a);
            })
        : items;

    const choose = (item) => {
        onChange(item);
        setQuery(formatName(item));
        setOpen(false);
    };

    return (
        <div style={{ position: 'relative' }}>
            <input
                type="text"
                disabled={disabled}
                placeholder={placeholder}
                value={open ? query : selectedName}
                onFocus={() => { setQuery(''); setOpen(true); setCursor(0); }}
                onBlur={() => setTimeout(() => setOpen(false), 200)}
                onChange={e => { setQuery(e.target.value); setCursor(0); }}
                onKeyDown={e => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
                    else if (e.key === 'Enter' && open && filtered[cursor]) { e.preventDefault(); choose(filtered[cursor]); }
                    else if (e.key === 'Escape') setOpen(false);
                }}
                autoComplete="off"
                style={S.input}
            />
            {open && filtered.length > 0 && (
                <ul ref={listRef} style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)', maxHeight: '180px',
                    overflowY: 'auto', listStyle: 'none', margin: '4px 0', padding: '4px',
                }}>
                    {filtered.map((item, i) => (
                        <li key={item.id || item.name} onMouseDown={() => choose(item)}
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

const QuickEntry = () => {
    const { t, lang } = useContext(LangContext);
    const { tenantData } = useTenant();
    
    // Select dropdown state
    const [entryType, setEntryType] = useState('farmer'); 

    // Dynamic dataset subscriptions
    const [farmers, setFarmers] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [salesmen, setSalesmen] = useState([]);
    const [products, setProducts] = useState([]);

    // Transactions subscriptions for balance calculation
    const [cashRecords, setCashRecords] = useState([]);
    const [purchaseRecords, setPurchaseRecords] = useState([]);
    const [payments, setPayments] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [cashPurchases, setCashPurchases] = useState([]);
    const [cashSales, setCashSales] = useState([]);

    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [lastSavedRecord, setLastSavedRecord] = useState(null);

    // Dropdown search filters
    const [farmerSearch, setFarmerSearch] = useState('');
    const [isFarmerDropdownOpen, setIsFarmerDropdownOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

    useEffect(() => {
        const u1 = subscribeToCollection('farmers', setFarmers);
        const u2 = subscribeToCollection('buyers', setBuyers);
        const u3 = subscribeToCollection('vendors', setVendors);
        const u4 = subscribeToCollection('salesmen', setSalesmen);
        const u5 = subscribeToCollection('products', setProducts);

        const u6 = subscribeToCollection('salesman_cash', setCashRecords);
        const u7 = subscribeToCollection('salesman_purchases', setPurchaseRecords);
        const u8 = subscribeToCollection('payments', setPayments);
        const u9 = subscribeToCollection('salesman_expenses', setExpenses);
        const u10 = subscribeToCollection('salesman_transfers', setTransfers);
        const u11 = subscribeToCollection('cash_purchases', setCashPurchases);
        const u12 = subscribeToCollection('cash_sales', setCashSales);

        const handleGlobalSearch = (e) => setFarmerSearch(e.detail);
        window.addEventListener('global-voice-search', handleGlobalSearch);

        return () => {
            u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); u11(); u12();
            window.removeEventListener('global-voice-search', handleGlobalSearch);
        };
    }, []);

    // Helper to calculate salesman dynamic cashbox balance
    const getStaffBalance = (staffId) => {
        if (!staffId) return 0;
        const staff = salesmen.find(s => s.id === staffId);
        const baseOpening = Number(staff?.openingCash) || 0;

        const sCash = cashRecords.filter(r => r.salesmanId === staffId);
        const sTransIn = transfers.filter(t => t.toSalesmanId === staffId);
        const sBuyerPayments = payments.filter(p => (p.type === 'buyer' || !p.type) && p.salesmanId === staffId);
        const sCashSales = cashSales.filter(cs => cs.salesmanId === staffId);

        const totalInflow = baseOpening +
            sCash.reduce((sum, r) => sum + (Number(r.openingCash) || 0), 0) +
            sTransIn.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) +
            sBuyerPayments.reduce((sum, p) => sum + (Number(p.amount) || 0) + (Number(p.cashLess) || 0), 0) +
            sCashSales.reduce((sum, cs) => sum + (Number(cs.grandTotal) || 0), 0);

        const sPurchases = purchaseRecords.filter(p => p.salesmanId === staffId);
        const sPayments = payments.filter(p => p.type === 'vendor' && p.salesmanId === staffId);
        const sExpenses = expenses.filter(e => e.salesmanId === staffId);
        const sTransOut = transfers.filter(t => t.fromSalesmanId === staffId);
        const sCashPurchases = cashPurchases.filter(cp => cp.salesmanId === staffId);

        const totalOutflow =
            sPurchases.reduce((sum, p) => sum + (Number(p.grandTotal) || 0), 0) +
            sPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) +
            sExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) +
            sTransOut.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) +
            sCashPurchases.reduce((sum, cp) => sum + (Number(cp.grandTotal) || 0), 0);

        return totalInflow - totalOutflow;
    };

    // Forms States
    const [farmerForm, setFarmerForm] = useState({ name: '', contact: '', balance: '0' });
    const [customerForm, setCustomerForm] = useState({ name: '', nameTa: '', contact: '', place: '', placeTa: '', balance: '0', balanceDate: toDateStr(new Date()) });
    const [vendorForm, setVendorForm] = useState({ name: '', nameTa: '', contact: '', place: '', placeTa: '', balance: '0' });
    const [staffForm, setStaffForm] = useState({ name: '', nameTa: '', contact: '', openingCash: '0' });
    const [flowerForm, setFlowerForm] = useState({ name: '', taName: '' });

    const [payForm, setPayForm] = useState({ entityId: '', amount: '', cashLess: '', method: 'Cash', note: '', date: toDateStr(new Date()) });
    const [receiveForm, setReceiveForm] = useState({ entityId: '', amount: '', cashLess: '', method: 'Cash', note: '', date: toDateStr(new Date()) });

    // Standard Credit Sales & Purchase States
    const [creditSalesForm, setCreditSalesForm] = useState({ buyerId: '', date: toDateStr(new Date()) });
    const [creditPurchaseForm, setCreditPurchaseForm] = useState({ vendorId: '', date: toDateStr(new Date()) });
    const [creditSalesItems, setCreditSalesItems] = useState([]);
    const [creditPurchaseItems, setCreditPurchaseItems] = useState([]);
    const [currentCreditSalesLine, setCurrentCreditSalesLine] = useState({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
    const [currentCreditPurchaseLine, setCurrentCreditPurchaseLine] = useState({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });

    const [cashPurchaseForm, setCashPurchaseForm] = useState({ staffId: '', shopName: '', mobileNumber: '', location: '', paymentMode: 'Cash', remarks: '', date: toDateStr(new Date()) });
    const [cashSalesForm, setCashSalesForm] = useState({ staffId: '', customerName: '', mobileNumber: '', location: '', paymentMode: 'Cash', remarks: '', date: toDateStr(new Date()) });
    const [purchaseItems, setPurchaseItems] = useState([]);
    const [salesItems, setSalesItems] = useState([]);
    const [currentPurchaseLine, setCurrentPurchaseLine] = useState({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
    const [currentSalesLine, setCurrentSalesLine] = useState({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });

    const [expenseForm, setExpenseForm] = useState({ staffId: '', category: 'Petrol', amount: '', notes: '', date: toDateStr(new Date()) });
    const [transferForm, setTransferForm] = useState({ fromStaffId: '', toStaffId: '', amount: '', notes: '', date: toDateStr(new Date()) });

    // Voice Modal helper mapping
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

    // Auto Translate Engine
    const transTimeout = useRef(null);
    const translate = async (text, from, to) => {
        if (!text || text.length < 2) return '';
        try {
            const resp = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
            const data = await resp.json();
            return data[0][0][0];
        } catch { return ''; }
    };
    const handleAutoTranslate = (val, source, formSetter) => {
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

        formSetter(prev => ({ ...prev, [source]: val }));

        if (transTimeout.current) clearTimeout(transTimeout.current);
        transTimeout.current = setTimeout(async () => {
            const translated = await translate(val, fromLang, toLang);
            if (translated) {
                formSetter(prev => ({ ...prev, [target]: translated }));
            }
        }, 600);
    };

    const showNotification = (msg) => {
        setMessage(msg);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => setMessage(''), 4000);
    };

    // Submissions Handlers
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
            showNotification(lang === 'ta' ? '✅ விவசாயி வெற்றிகரமாகச் சேர்க்கப்பட்டார்!' : '✅ Farmer added successfully!');
            setFarmerForm({ name: '', contact: '', balance: '0' });
        } catch (err) { alert('Error: ' + err.message); } finally { setIsSaving(false); }
    };

    const handleSubmitCustomer = async (e) => {
        e.preventDefault();
        if (isSaving || !customerForm.name.trim()) return;
        setIsSaving(true);
        try {
            const nextId = buyers.length > 0 ? Math.max(...buyers.map(b => parseInt(b.displayId) || 0)) + 1 : 101;
            await saveBuyer({
                name: customerForm.name.trim(),
                nameTa: customerForm.nameTa.trim() || customerForm.name.trim(),
                contact: customerForm.contact.trim() || '',
                place: customerForm.place.trim() || '',
                placeTa: customerForm.placeTa.trim() || customerForm.place.trim(),
                balance: parseFloat(customerForm.balance) || 0,
                balanceDate: customerForm.balance ? (customerForm.balanceDate || toDateStr(new Date())) : '',
                displayId: nextId
            });
            showNotification(lang === 'ta' ? '✅ வாடிக்கையாளர் வெற்றிகரமாகச் சேர்க்கப்பட்டார்!' : '✅ Customer added successfully!');
            setCustomerForm({ name: '', nameTa: '', contact: '', place: '', placeTa: '', balance: '0', balanceDate: toDateStr(new Date()) });
        } catch (err) { alert('Error: ' + err.message); } finally { setIsSaving(false); }
    };

    const handleSubmitVendor = async (e) => {
        e.preventDefault();
        if (isSaving || !vendorForm.name.trim()) return;
        setIsSaving(true);
        try {
            await saveVendor({
                name: vendorForm.name.trim(),
                nameTa: vendorForm.nameTa.trim() || vendorForm.name.trim(),
                contact: vendorForm.contact.trim() || '',
                place: vendorForm.place.trim() || '',
                placeTa: vendorForm.placeTa.trim() || vendorForm.place.trim(),
                balance: parseFloat(vendorForm.balance) || 0
            });
            showNotification(lang === 'ta' ? '✅ விற்பனையாளர் வெற்றிகரமாகச் சேர்க்கப்பட்டார்!' : '✅ Vendor added successfully!');
            setVendorForm({ name: '', nameTa: '', contact: '', place: '', placeTa: '', balance: '0' });
        } catch (err) { alert('Error: ' + err.message); } finally { setIsSaving(false); }
    };

    const handleSubmitStaff = async (e) => {
        e.preventDefault();
        if (isSaving || !staffForm.name.trim()) return;
        setIsSaving(true);
        try {
            await saveSalesman({
                name: staffForm.name.trim(),
                nameTa: staffForm.nameTa.trim() || staffForm.name.trim(),
                contact: staffForm.contact.trim() || '',
                openingCash: parseFloat(staffForm.openingCash) || 0
            });
            showNotification(lang === 'ta' ? '✅ பணியாளர் வெற்றிகரமாகச் சேர்க்கப்பட்டார்!' : '✅ Staff member added successfully!');
            setStaffForm({ name: '', nameTa: '', contact: '', openingCash: '0' });
        } catch (err) { alert('Error: ' + err.message); } finally { setIsSaving(false); }
    };

    const handleSubmitFlower = async (e) => {
        e.preventDefault();
        if (isSaving || !flowerForm.name.trim()) return;
        setIsSaving(true);
        try {
            await saveProduct({
                name: flowerForm.name.trim(),
                taName: flowerForm.taName.trim() || flowerForm.name.trim()
            });
            showNotification(lang === 'ta' ? '✅ பூ வெற்றிகரமாகச் சேர்க்கப்பட்டது!' : '✅ Flower added successfully!');
            setFlowerForm({ name: '', taName: '' });
        } catch (err) { alert('Error: ' + err.message); } finally { setIsSaving(false); }
    };

    const handleSubmitCashPay = async (e) => {
        e.preventDefault();
        if (isSaving || !payForm.entityId || !payForm.amount) return;
        setIsSaving(true);
        try {
            const amountNum = parseFloat(payForm.amount || 0);
            const cashLessNum = parseFloat(payForm.cashLess || 0);
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
            await updateDoc(doc(db, 'farmers', payForm.entityId), { balance: increment(-(amountNum + cashLessNum)) });
            showNotification(lang === 'ta' ? '✅ பணப்பட்டுவாடா வெற்றிகரமாகப் பதிவு செய்யப்பட்டது!' : '✅ Cash Payment logged successfully!');
            setPayForm({ entityId: '', amount: '', cashLess: '', method: 'Cash', note: '', date: toDateStr(new Date()) });
            setFarmerSearch('');
        } catch (err) { alert('Error: ' + err.message); } finally { setIsSaving(false); }
    };

    const handleSubmitCashReceive = async (e) => {
        e.preventDefault();
        if (isSaving || !receiveForm.entityId || !receiveForm.amount) return;
        setIsSaving(true);
        try {
            const amountNum = parseFloat(receiveForm.amount || 0);
            const cashLessNum = parseFloat(receiveForm.cashLess || 0);
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
            await updateDoc(doc(db, 'buyers', receiveForm.entityId), { balance: increment(-(amountNum + cashLessNum)) });
            showNotification(lang === 'ta' ? '✅ பண வரவு வெற்றிகரமாகப் பதிவு செய்யப்பட்டது!' : '✅ Cash Receive logged successfully!');
            setReceiveForm({ entityId: '', amount: '', cashLess: '', method: 'Cash', note: '', date: toDateStr(new Date()) });
            setCustomerSearch('');
        } catch (err) { alert('Error: ' + err.message); } finally { setIsSaving(false); }
    };

    const handleSubmitCreditSales = async (e) => {
        e.preventDefault();
        if (isSaving || !creditSalesForm.buyerId || creditSalesItems.length === 0) return;
        setIsSaving(true);
        try {
            const buyer = buyers.find(b => b.id === creditSalesForm.buyerId);
            const total = creditSalesItems.reduce((sum, item) => sum + item.total, 0);
            const record = {
                buyerId: creditSalesForm.buyerId,
                buyerName: buyer?.name || 'Unknown',
                date: creditSalesForm.date,
                items: creditSalesItems,
                grandTotal: total,
                timestamp: serverTimestamp()
            };
            await saveSale(record);
            await updateDoc(doc(db, 'buyers', creditSalesForm.buyerId), { balance: increment(total) });
            setLastSavedRecord({ ...record, customerName: buyer?.name || 'Unknown' });
            showNotification(lang === 'ta' ? '✅ விற்பனைப் பதிவு வெற்றிகரமாகச் சேமிக்கப்பட்டது!' : '✅ Sales entry saved successfully!');
            setCreditSalesForm({ buyerId: '', date: toDateStr(new Date()) });
            setCreditSalesItems([]);
        } catch (err) { alert('Error: ' + err.message); } finally { setIsSaving(false); }
    };

    const handleSubmitCreditPurchase = async (e) => {
        e.preventDefault();
        if (isSaving || !creditPurchaseForm.vendorId || creditPurchaseItems.length === 0) return;
        setIsSaving(true);
        try {
            const vendor = vendors.find(v => v.id === creditPurchaseForm.vendorId);
            const total = creditPurchaseItems.reduce((sum, item) => sum + item.total, 0);
            const record = {
                vendorId: creditPurchaseForm.vendorId,
                vendorName: vendor?.name || 'Unknown',
                date: creditPurchaseForm.date,
                items: creditPurchaseItems,
                grandTotal: total,
                cashPaid: 0,
                timestamp: serverTimestamp()
            };
            await saveOutsidePurchase(record);
            await updateDoc(doc(db, 'vendors', creditPurchaseForm.vendorId), { balance: increment(total) });
            setLastSavedRecord({ ...record, vendorName: vendor?.name || 'Unknown' });
            showNotification(lang === 'ta' ? '✅ கொள்முதல் பதிவு வெற்றிகரமாகச் சேமிக்கப்பட்டது!' : '✅ Purchase entry saved successfully!');
            setCreditPurchaseForm({ vendorId: '', date: toDateStr(new Date()) });
            setCreditPurchaseItems([]);
        } catch (err) { alert('Error: ' + err.message); } finally { setIsSaving(false); }
    };

    const handleSubmitCashPurchase = async (e) => {
        e.preventDefault();
        if (isSaving || !cashPurchaseForm.staffId || !cashPurchaseForm.shopName.trim() || purchaseItems.length === 0) return;
        setIsSaving(true);
        try {
            const activeStaff = salesmen.find(s => s.id === cashPurchaseForm.staffId);
            const billData = {
                date: cashPurchaseForm.date,
                salesmanId: cashPurchaseForm.staffId,
                salesmanName: activeStaff?.name || 'Unknown',
                vendorName: cashPurchaseForm.shopName.trim(),
                mobileNumber: cashPurchaseForm.mobileNumber.trim() || '---',
                location: cashPurchaseForm.location.trim() || '---',
                paymentMode: cashPurchaseForm.paymentMode,
                remarks: cashPurchaseForm.remarks.trim() || '---',
                items: purchaseItems,
                grandTotal: purchaseItems.reduce((sum, item) => sum + item.total, 0),
                type: 'cash_purchase'
            };
            await saveCashPurchase(billData);
            setLastSavedRecord(billData);
            showNotification(lang === 'ta' ? '✅ ரொக்கக் கொள்முதல் சேமிக்கப்பட்டது!' : '✅ Cash Purchase logged successfully!');
            setCashPurchaseForm({ staffId: '', shopName: '', mobileNumber: '', location: '', paymentMode: 'Cash', remarks: '', date: toDateStr(new Date()) });
            setPurchaseItems([]);
        } catch (err) { alert('Error: ' + err.message); } finally { setIsSaving(false); }
    };

    const handleSubmitCashSales = async (e) => {
        e.preventDefault();
        if (isSaving || !cashSalesForm.staffId || !cashSalesForm.customerName.trim() || salesItems.length === 0) return;
        setIsSaving(true);
        try {
            const activeStaff = salesmen.find(s => s.id === cashSalesForm.staffId);
            const billData = {
                date: cashSalesForm.date,
                salesmanId: cashSalesForm.staffId,
                salesmanName: activeStaff?.name || 'Unknown',
                customerName: cashSalesForm.customerName.trim(),
                mobileNumber: cashSalesForm.mobileNumber.trim() || '---',
                location: cashSalesForm.location.trim() || '---',
                paymentMode: cashSalesForm.paymentMode,
                remarks: cashSalesForm.remarks.trim() || '---',
                items: salesItems,
                grandTotal: salesItems.reduce((sum, item) => sum + item.total, 0),
                type: 'cash_sale'
            };
            await saveCashSale(billData);
            setLastSavedRecord(billData);
            showNotification(lang === 'ta' ? '✅ ரொக்க விற்பனை சேமிக்கப்பட்டது!' : '✅ Cash Sale logged successfully!');
            setCashSalesForm({ staffId: '', customerName: '', mobileNumber: '', location: '', paymentMode: 'Cash', remarks: '', date: toDateStr(new Date()) });
            setSalesItems([]);
        } catch (err) { alert('Error: ' + err.message); } finally { setIsSaving(false); }
    };

    const handleSubmitExpense = async (e) => {
        e.preventDefault();
        if (isSaving || !expenseForm.staffId || !expenseForm.amount) return;
        setIsSaving(true);
        try {
            const activeStaff = salesmen.find(s => s.id === expenseForm.staffId);
            await addData('salesman_expenses', {
                salesmanId: expenseForm.staffId,
                salesmanName: activeStaff?.name || 'Unknown',
                date: expenseForm.date,
                category: expenseForm.category,
                amount: parseFloat(expenseForm.amount),
                notes: expenseForm.notes || '---'
            });
            showNotification(lang === 'ta' ? '✅ பணியாளர் செலவு சேமிக்கப்பட்டது!' : '✅ Staff expense recorded successfully!');
            setExpenseForm({ staffId: '', category: 'Petrol', amount: '', notes: '', date: toDateStr(new Date()) });
        } catch (err) { alert('Error: ' + err.message); } finally { setIsSaving(false); }
    };

    const handleSubmitTransfer = async (e) => {
        e.preventDefault();
        if (isSaving || !transferForm.fromStaffId || !transferForm.toStaffId || !transferForm.amount) return;
        if (transferForm.fromStaffId === transferForm.toStaffId) {
            alert('Sender and receiver cannot be the same staff member.');
            return;
        }
        setIsSaving(true);
        try {
            const fromStaff = salesmen.find(s => s.id === transferForm.fromStaffId);
            const toStaff = salesmen.find(s => s.id === transferForm.toStaffId);
            await addData('salesman_transfers', {
                fromSalesmanId: transferForm.fromStaffId,
                fromSalesmanName: fromStaff?.name || 'Unknown',
                toSalesmanId: transferForm.toStaffId,
                toSalesmanName: toStaff?.name || 'Unknown',
                date: transferForm.date,
                amount: parseFloat(transferForm.amount),
                notes: transferForm.notes || '---'
            });
            showNotification(lang === 'ta' ? '✅ பணியாளர் பண பரிமாற்றம் சேமிக்கப்பட்டது!' : '✅ Staff transfer recorded successfully!');
            setTransferForm({ fromStaffId: '', toStaffId: '', amount: '', notes: '', date: toDateStr(new Date()) });
        } catch (err) { alert('Error: ' + err.message); } finally { setIsSaving(false); }
    };

    // Lines adding functions
    const handleAddPurchaseLine = () => {
        const { flowerType, flowerTypeTa, quantity, price } = currentPurchaseLine;
        if (!flowerType || !quantity || !price) return;
        const qty = parseFloat(quantity);
        const rate = parseFloat(price);
        if (qty <= 0 || rate <= 0) return;

        setPurchaseItems(prev => [...prev, { flowerType, flowerTypeTa: flowerTypeTa || '', quantity: qty, price: rate, total: qty * rate }]);
        setCurrentPurchaseLine({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
    };

    const handleAddSalesLine = () => {
        const { flowerType, flowerTypeTa, quantity, price } = currentSalesLine;
        if (!flowerType || !quantity || !price) return;
        const qty = parseFloat(quantity);
        const rate = parseFloat(price);
        if (qty <= 0 || rate <= 0) return;

        setSalesItems(prev => [...prev, { flowerType, flowerTypeTa: flowerTypeTa || '', quantity: qty, price: rate, total: qty * rate }]);
        setCurrentSalesLine({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
    };

    const handleAddCreditSalesLine = () => {
        const { flowerType, flowerTypeTa, quantity, price } = currentCreditSalesLine;
        if (!flowerType || !quantity || !price) return;
        const qty = parseFloat(quantity);
        const rate = parseFloat(price);
        if (qty <= 0 || rate <= 0) return;

        setCreditSalesItems(prev => [...prev, { flowerType, flowerTypeTa: flowerTypeTa || '', quantity: qty, price: rate, total: qty * rate }]);
        setCurrentCreditSalesLine({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
    };

    const handleAddCreditPurchaseLine = () => {
        const { flowerType, flowerTypeTa, quantity, price } = currentCreditPurchaseLine;
        if (!flowerType || !quantity || !price) return;
        const qty = parseFloat(quantity);
        const rate = parseFloat(price);
        if (qty <= 0 || rate <= 0) return;

        setCreditPurchaseItems(prev => [...prev, { flowerType, flowerTypeTa: flowerTypeTa || '', quantity: qty, price: rate, total: qty * rate }]);
        setCurrentCreditPurchaseLine({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
    };

    // Print Thermal Invoice helper
    const handlePrintInvoice = () => {
        const record = lastSavedRecord;
        if (!record) return alert('No transaction saved yet to print.');
        const biz = tenantData || { name: 'S.V.M', type: 'SRI VALLI FLOWER MERCHANT', address: 'B-7, FLOWER MARKET, TINDIVANAM.', phone1: '9443247771', phone2: '9952535057' };
        
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
            <head>
                <title>Invoice</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; padding: 10px; font-size: 14px; width: 80mm; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                    .shop-name { font-size: 18px; font-weight: bold; }
                    .details { font-size: 12px; margin-bottom: 10px; }
                    .details div { display: flex; justify-content: space-between; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; border-bottom: 1px dashed #000; }
                    th { border-bottom: 1px dashed #000; text-align: left; font-size: 12px; }
                    td { font-size: 12px; padding: 4px 0; }
                    .total { text-align: right; font-weight: bold; font-size: 14px; padding: 10px 0; }
                    .footer { text-align: center; font-size: 11px; margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="header">
                    <div class="shop-name">${biz.name}</div>
                    <div style="font-size: 11px;">${biz.type || ''}</div>
                    <div style="font-size: 10px;">${biz.address || ''}</div>
                </div>
                <div class="details">
                    <div><span>Date:</span> <span>${displayDate(record.date)}</span></div>
                    ${record.salesmanName ? `<div><span>Staff:</span> <span>${record.salesmanName}</span></div>` : ''}
                    <div><span>Name:</span> <span>${record.customerName || record.vendorName || record.buyerName}</span></div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th style="text-align: right;">Qty</th>
                            <th style="text-align: right;">Rate</th>
                            <th style="text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${record.items.map(item => `
                            <tr>
                                <td>${lang === 'ta' ? (item.flowerTypeTa || item.flowerType) : item.flowerType}</td>
                                <td style="text-align: right;">${item.quantity}</td>
                                <td style="text-align: right;">${item.price}</td>
                                <td style="text-align: right;">${item.total.toFixed(0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="total">Grand Total: Rs ${record.grandTotal.toFixed(0)}</div>
                <div class="footer">🌹 Thank You! Come Again! 🌹</div>
            </body>
            </html>
        `;
        printWindow.document.write(content);
        printWindow.document.close();
    };

    const handleShareWhatsApp = () => {
        const record = lastSavedRecord;
        if (!record) return alert('No transaction saved yet to share.');
        const biz = tenantData || { name: 'S.V.M' };
        
        let text = `*TRANSACTION INVOICE*\n`;
        text += `---------------------------\n`;
        text += `*Shop:* ${biz.name}\n`;
        text += `*Date:* ${displayDate(record.date)}\n`;
        if (record.salesmanName) text += `*Staff:* ${record.salesmanName}\n`;
        text += `*Name:* ${record.customerName || record.vendorName || record.buyerName}\n`;
        text += `---------------------------\n`;
        record.items.forEach((item, idx) => {
            const name = lang === 'ta' ? (item.flowerTypeTa || item.flowerType) : item.flowerType;
            text += `${idx + 1}. ${name} - ${item.quantity}Kg @ Rs.${item.price} = Rs.${item.total.toFixed(0)}\n`;
        });
        text += `---------------------------\n`;
        text += `*Grand Total:* *Rs ${record.grandTotal.toFixed(0)}*\n\n`;
        text += `Thank you!`;

        const mob = (record.mobileNumber || '').replace(/[^0-9]/g, '');
        const targetPhone = mob.length === 10 ? `91${mob}` : mob.length === 12 ? mob : '';
        window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`, '_blank');
    };

    // Filters Dropdowns
    const filteredFarmers = farmers.filter(f => f.name.toLowerCase().includes(farmerSearch.toLowerCase()));
    const filteredBuyers = buyers.filter(b => b.name.toLowerCase().includes(customerSearch.toLowerCase()) || b.displayId?.toString().includes(customerSearch));

    return (
        <div style={S.page} className="animate-in fade-in duration-300">
            {/* Header / Dynamic form selection */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ecfdf5', color: '#10b981', fontSize: '24px' }}>
                        ⚡
                    </div>
                    <div>
                        <h2 style={S.title}>{lang === 'ta' ? 'விரைவு பதிவு மையம்' : 'Quick Entry Hub'}</h2>
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>{lang === 'ta' ? 'அனைத்து முக்கிய பதிவுகளையும் ஒரே இடத்தில் வேகமாகப் பதிவு செய்ய' : 'Consolidated shortcut panel for fast entries.'}</span>
                    </div>
                </div>

                <div>
                    <select 
                        value={entryType} 
                        onChange={e => {
                            setEntryType(e.target.value);
                            setMessage('');
                            setLastSavedRecord(null);
                        }} 
                        style={S.select}
                    >
                        <option value="farmer">👨🌾 {lang === 'ta' ? 'விவசாயி சேர்' : 'Add Farmer'}</option>
                        <option value="buyer">👥 {lang === 'ta' ? 'வாடிக்கையாளர் சேர்' : 'Add Customer'}</option>
                        <option value="vendor">🏪 {lang === 'ta' ? 'விற்பனையாளர் சேர்' : 'Add Vendor'}</option>
                        <option value="staff">💼 {lang === 'ta' ? 'பணியாளர் சேர்' : 'Add Staff'}</option>
                        <option value="flower">🌸 {lang === 'ta' ? 'பூ சேர்' : 'Add Flower'}</option>
                        <option value="cash_pay">💸 {lang === 'ta' ? 'விவசாயிக்கு பணம்' : 'Cash Pay Farmer'}</option>
                        <option value="cash_receive">📥 {lang === 'ta' ? 'வாடிக்கையாளர் வரவு' : 'Cash Receive Customer'}</option>
                        <option value="sales_credit">📈 {lang === 'ta' ? 'விற்பனைப் பதிவு' : 'Credit Sales Entry'}</option>
                        <option value="purchase_credit">📉 {lang === 'ta' ? 'கொள்முதல் பதிவு' : 'Credit Purchase Entry'}</option>
                        <option value="cash_purchase">🛒 {lang === 'ta' ? 'ரொக்கக் கொள்முதல்' : 'Cash Purchase'}</option>
                        <option value="cash_sales">💵 {lang === 'ta' ? 'ரொக்க விற்பனை' : 'Cash Sales'}</option>
                        <option value="staff_expense">💸 {lang === 'ta' ? 'பணியாளர் செலவு' : 'Staff Expense'}</option>
                        <option value="staff_transfer">🔄 {lang === 'ta' ? 'பணியாளர் பண பரிமாற்றம்' : 'Staff Transfer'}</option>
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

            {/* Print & Share actions for last saved record */}
            {lastSavedRecord && (
                <div style={{ ...S.alert, background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e40af', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800 }}>🎉 Saved successfully! Trigger Invoice actions:</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handlePrintInvoice} style={{ padding: '8px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Printer size={13} /> Print Invoice
                        </button>
                        <button onClick={handleShareWhatsApp} style={{ padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Share2 size={13} /> WhatsApp
                        </button>
                    </div>
                </div>
            )}

            {/* Outer Form Container */}
            <div style={{ background: '#f8fafc', padding: '32px', borderRadius: '20px', border: '1.5px solid #f1f5f9' }}>
                
                {/* ────────────────── ADD FARMER ────────────────── */}
                {entryType === 'farmer' && (
                    <form onSubmit={handleSubmitFarmer} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={S.sectionTitle}>👨🌾 {lang === 'ta' ? 'புதிய விவசாயி பதிவு' : 'Add New Farmer'}</h3>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'விவசாயி பெயர்' : 'Farmer Name'}</label>
                            <input type="text" style={S.input} placeholder="e.g. Arumugam" value={farmerForm.name} onChange={e => setFarmerForm({ ...farmerForm, name: e.target.value })} required />
                        </div>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'தொடர்பு எண்' : 'Contact Number'}</label>
                            <input type="text" style={S.input} placeholder="Mobile number" value={farmerForm.contact} onChange={e => setFarmerForm({ ...farmerForm, contact: e.target.value })} />
                        </div>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'ஆரம்ப நிலுவை தொகை (₹)' : 'Initial Balance (Old Dues)'}</label>
                            <input type="number" inputMode="decimal" style={S.input} placeholder="0.00" value={farmerForm.balance} onChange={e => setFarmerForm({ ...farmerForm, balance: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            <button type="submit" style={S.btnSubmit} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Farmer'}</button>
                            <button type="button" style={S.btnCancel} onClick={() => setFarmerForm({ name: '', contact: '', balance: '0' })}>Cancel</button>
                        </div>
                    </form>
                )}

                {/* ────────────────── ADD CUSTOMER ────────────────── */}
                {entryType === 'buyer' && (
                    <form onSubmit={handleSubmitCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={S.sectionTitle}>👥 {lang === 'ta' ? 'புதிய வாடிக்கையாளர் பதிவு' : 'Add New Customer'}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'பெயர் (ஆங்கிலம்)' : 'Customer Name (EN)'}</label>
                                <input type="text" style={S.input} placeholder="English Name" value={customerForm.name} onChange={e => handleAutoTranslate(e.target.value, 'name', setCustomerForm)} required />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'பெயர் (தமிழ்)' : 'Customer Name (TA)'}</label>
                                <input type="text" style={S.input} placeholder="தமிழ் பெயர்" value={customerForm.nameTa} onChange={e => setCustomerForm({ ...customerForm, nameTa: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'தொடர்பு எண்' : 'Contact Number'}</label>
                            <input type="text" style={S.input} placeholder="Mobile number" value={customerForm.contact} onChange={e => setCustomerForm({ ...customerForm, contact: e.target.value })} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'ஊர் (ஆங்கிலம்)' : 'Place (EN)'}</label>
                                <input type="text" style={S.input} placeholder="Place name" value={customerForm.place} onChange={e => handleAutoTranslate(e.target.value, 'place', setCustomerForm)} />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'ஊர் (தமிழ்)' : 'Place (TA)'}</label>
                                <input type="text" style={S.input} placeholder="ஊர் பெயர்" value={customerForm.placeTa} onChange={e => setCustomerForm({ ...customerForm, placeTa: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'பழைய நிலுவை தொகை (₹)' : 'Old Balance (₹)'}</label>
                                <input type="number" inputMode="decimal" style={S.input} placeholder="0" value={customerForm.balance} onChange={e => setCustomerForm({ ...customerForm, balance: e.target.value })} />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'நிலுவை தேதி' : 'Balance Date'}</label>
                                <input type="date" style={S.input} value={customerForm.balanceDate} onChange={e => setCustomerForm({ ...customerForm, balanceDate: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            <button type="submit" style={S.btnSubmit} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Customer'}</button>
                            <button type="button" style={S.btnCancel} onClick={() => setCustomerForm({ name: '', nameTa: '', contact: '', place: '', placeTa: '', balance: '0', balanceDate: toDateStr(new Date()) })}>Cancel</button>
                        </div>
                    </form>
                )}

                {/* ────────────────── ADD VENDOR ────────────────── */}
                {entryType === 'vendor' && (
                    <form onSubmit={handleSubmitVendor} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={S.sectionTitle}>🏪 {lang === 'ta' ? 'புதிய விற்பனையாளர் பதிவு' : 'Add New Vendor'}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'பெயர் (ஆங்கிலம்)' : 'Vendor Name (EN)'}</label>
                                <input type="text" style={S.input} placeholder="English Name" value={vendorForm.name} onChange={e => handleAutoTranslate(e.target.value, 'name', setVendorForm)} required />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'பெயர் (தமிழ்)' : 'Vendor Name (TA)'}</label>
                                <input type="text" style={S.input} placeholder="தமிழ் பெயர்" value={vendorForm.nameTa} onChange={e => setVendorForm({ ...vendorForm, nameTa: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'தொடர்பு எண்' : 'Contact Number'}</label>
                            <input type="text" style={S.input} placeholder="Mobile number" value={vendorForm.contact} onChange={e => setVendorForm({ ...vendorForm, contact: e.target.value })} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'ஊர் (ஆங்கிலம்)' : 'Place (EN)'}</label>
                                <input type="text" style={S.input} placeholder="Place name" value={vendorForm.place} onChange={e => handleAutoTranslate(e.target.value, 'place', setVendorForm)} />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'ஊர் (தமிழ்)' : 'Place (TA)'}</label>
                                <input type="text" style={S.input} placeholder="ஊர் பெயர்" value={vendorForm.placeTa} onChange={e => setVendorForm({ ...vendorForm, placeTa: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'பழைய நிலுவை தொகை (₹)' : 'Opening Balance (₹)'}</label>
                            <input type="number" inputMode="decimal" style={S.input} placeholder="0" value={vendorForm.balance} onChange={e => setVendorForm({ ...vendorForm, balance: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            <button type="submit" style={S.btnSubmit} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Vendor'}</button>
                            <button type="button" style={S.btnCancel} onClick={() => setVendorForm({ name: '', nameTa: '', contact: '', place: '', placeTa: '', balance: '0' })}>Cancel</button>
                        </div>
                    </form>
                )}

                {/* ────────────────── ADD STAFF ────────────────── */}
                {entryType === 'staff' && (
                    <form onSubmit={handleSubmitStaff} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={S.sectionTitle}>💼 {lang === 'ta' ? 'புதிய பணியாளர் பதிவு' : 'Add New Staff Member'}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'பெயர் (ஆங்கிலம்)' : 'Staff Name (EN)'}</label>
                                <input type="text" style={S.input} placeholder="English Name" value={staffForm.name} onChange={e => handleAutoTranslate(e.target.value, 'name', setStaffForm)} required />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'பெயர் (தமிழ்)' : 'Staff Name (TA)'}</label>
                                <input type="text" style={S.input} placeholder="தமிழ் பெயர்" value={staffForm.nameTa} onChange={e => setStaffForm({ ...staffForm, nameTa: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'தொடர்பு எண்' : 'Contact Number'}</label>
                            <input type="text" style={S.input} placeholder="Mobile number" value={staffForm.contact} onChange={e => setStaffForm({ ...staffForm, contact: e.target.value })} />
                        </div>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'ஆரம்ப ரொக்க இருப்பு (₹)' : 'Opening Cash Balance (₹)'}</label>
                            <input type="number" inputMode="decimal" style={S.input} placeholder="0" value={staffForm.openingCash} onChange={e => setStaffForm({ ...staffForm, openingCash: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            <button type="submit" style={S.btnSubmit} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Staff'}</button>
                            <button type="button" style={S.btnCancel} onClick={() => setStaffForm({ name: '', nameTa: '', contact: '', openingCash: '0' })}>Cancel</button>
                        </div>
                    </form>
                )}

                {/* ────────────────── ADD FLOWER ────────────────── */}
                {entryType === 'flower' && (
                    <form onSubmit={handleSubmitFlower} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={S.sectionTitle}>🌸 {lang === 'ta' ? 'புதிய பூ வகை பதிவு' : 'Add New Flower Variety'}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'பூ பெயர் (ஆங்கிலம்)' : 'Flower Name (EN)'}</label>
                                <input type="text" style={S.input} placeholder="e.g. Jasmine" value={flowerForm.name} onChange={e => handleAutoTranslate(e.target.value, 'name', setFlowerForm)} required />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'பூ பெயர் (தமிழ்)' : 'Flower Name (TA)'}</label>
                                <input type="text" style={S.input} placeholder="e.g. மல்லிகை" value={flowerForm.taName} onChange={e => setFlowerForm({ ...flowerForm, taName: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            <button type="submit" style={S.btnSubmit} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Flower'}</button>
                            <button type="button" style={S.btnCancel} onClick={() => setFlowerForm({ name: '', taName: '' })}>Cancel</button>
                        </div>
                    </form>
                )}

                {/* ────────────────── CASH PAY (FARMER) ────────────────── */}
                {entryType === 'cash_pay' && (
                    <form onSubmit={handleSubmitCashPay} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={{ ...S.sectionTitle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>💸 {lang === 'ta' ? 'விவசாயிக்கு பணம் வழங்குதல்' : 'Record Farmer Cash Payment'}</span>
                            <button type="button" onClick={() => setIsVoiceModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#ecfdf5', color: '#059669', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
                                <Mic size={14} /> Voice Input
                            </button>
                        </h3>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'தேதி' : 'Date'}</label>
                            <input type="date" style={S.input} value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} required />
                        </div>
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
                                            <div key={f.id} onClick={() => { setPayForm({ ...payForm, entityId: f.id }); setIsFarmerDropdownOpen(false); setFarmerSearch(''); }} style={{ padding: '10px 14px', cursor: 'pointer', fontWeight: 600, borderBottom: '1px solid #f1f5f9', fontSize: '13px' }} onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
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
                                <input type="number" inputMode="decimal" style={S.input} placeholder="0" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} required />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'தள்ளுபடி (Cash Less)' : 'Discount / Cash Less (₹)'}</label>
                                <input type="number" inputMode="decimal" style={S.input} placeholder="0" value={payForm.cashLess} onChange={e => setPayForm({ ...payForm, cashLess: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'செலுத்தும் வழி' : 'Payment Method'}</label>
                                <select value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })} style={S.input}>
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
                                <input type="text" style={S.input} placeholder="e.g. advance, weekly pay" value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            <button type="submit" style={S.btnSubmit} disabled={isSaving || !payForm.entityId}>Log Payment</button>
                            <button type="button" style={S.btnCancel} onClick={() => setPayForm({ entityId: '', amount: '', cashLess: '', method: 'Cash', note: '', date: toDateStr(new Date()) })}>Cancel</button>
                        </div>
                    </form>
                )}

                {/* ────────────────── CASH RECEIVE (CUSTOMER) ────────────────── */}
                {entryType === 'cash_receive' && (
                    <form onSubmit={handleSubmitCashReceive} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={{ ...S.sectionTitle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>📥 {lang === 'ta' ? 'வாடிக்கையாளரிடமிருந்து பண வரவு' : 'Record Customer Cash Receive'}</span>
                            <button type="button" onClick={() => setIsVoiceModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#ecfdf5', color: '#059669', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
                                <Mic size={14} /> Voice Input
                            </button>
                        </h3>
                        <div>
                            <label style={S.label}>{lang === 'ta' ? 'தேதி' : 'Date'}</label>
                            <input type="date" style={S.input} value={receiveForm.date} onChange={e => setReceiveForm({ ...receiveForm, date: e.target.value })} required />
                        </div>
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
                                            <div key={b.id} onClick={() => { setReceiveForm({ ...receiveForm, entityId: b.id }); setIsCustomerDropdownOpen(false); setCustomerSearch(''); }} style={{ padding: '10px 14px', cursor: 'pointer', fontWeight: 600, borderBottom: '1px solid #f1f5f9', fontSize: '13px' }} onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                                                #{b.displayId} - {b.name} (Dues: ₹{b.balance || 0})
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
                                <input type="number" inputMode="decimal" style={S.input} placeholder="0" value={receiveForm.amount} onChange={e => setReceiveForm({ ...receiveForm, amount: e.target.value })} required />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'தள்ளுபடி (Cash Less)' : 'Discount / Cash Less (₹)'}</label>
                                <input type="number" inputMode="decimal" style={S.input} placeholder="0" value={receiveForm.cashLess} onChange={e => setReceiveForm({ ...receiveForm, cashLess: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'பெற்ற வழி' : 'Payment Method'}</label>
                                <select value={receiveForm.method} onChange={e => setReceiveForm({ ...receiveForm, method: e.target.value })} style={S.input}>
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
                                <input type="text" style={S.input} placeholder="e.g. partial pay" value={receiveForm.note} onChange={e => setReceiveForm({ ...receiveForm, note: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                            <button type="submit" style={S.btnSubmit} disabled={isSaving || !receiveForm.entityId}>Log Receive</button>
                            <button type="button" style={S.btnCancel} onClick={() => setReceiveForm({ entityId: '', amount: '', cashLess: '', method: 'Cash', note: '', date: toDateStr(new Date()) })}>Cancel</button>
                        </div>
                    </form>
                )}

                {/* ────────────────── CREDIT SALES ENTRY ────────────────── */}
                {entryType === 'sales_credit' && (
                    <form onSubmit={handleSubmitCreditSales} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={S.sectionTitle}>📈 {lang === 'ta' ? 'விற்பனைப் பதிவு (வாடிக்கையாளர் கடன்)' : 'Standard Credit Sales Entry'}</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'தேதி' : 'Date'}</label>
                                <input type="date" style={S.input} value={creditSalesForm.date} onChange={e => setCreditSalesForm({ ...creditSalesForm, date: e.target.value })} required />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'வாடிக்கையாளர் பெயர்' : 'Select Customer'}</label>
                                <SearchSelect 
                                    items={buyers} 
                                    value={creditSalesForm.buyerId} 
                                    placeholder="Choose customer..." 
                                    onChange={sel => setCreditSalesForm({ ...creditSalesForm, buyerId: sel.id })} 
                                    lang={lang} 
                                />
                            </div>
                        </div>

                        <div style={{ pointerEvents: creditSalesForm.buyerId ? 'auto' : 'none', opacity: creditSalesForm.buyerId ? 1 : 0.45, transition: 'all 0.3s' }}>
                            {/* Lines Insertion Section */}
                            <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '16px', border: '1px solid #fef3c7', marginBottom: '16px' }}>
                                <span style={{ ...S.label, color: '#b45309', marginBottom: '12px', display: 'block' }}>Add Flower Detail Rows</span>
                                <div className="flower-line-grid">
                                    <div>
                                        <label style={S.label}>Flower Variety</label>
                                        <SearchSelect 
                                            items={products} 
                                            value={currentCreditSalesLine.flowerType} 
                                            placeholder="Choose flower..." 
                                            onChange={sel => setCurrentCreditSalesLine(prev => ({ ...prev, flowerType: sel.name, flowerTypeTa: sel.taName || '' }))} 
                                            lang={lang} 
                                        />
                                    </div>
                                    <div>
                                        <label style={S.label}>Qty (Kg)</label>
                                        <input type="number" inputMode="decimal" style={S.input} placeholder="0.0" value={currentCreditSalesLine.quantity} onChange={e => setCurrentCreditSalesLine({ ...currentCreditSalesLine, quantity: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={S.label}>Rate (₹)</label>
                                        <input type="number" inputMode="decimal" style={S.input} placeholder="0.0" value={currentCreditSalesLine.price} onChange={e => setCurrentCreditSalesLine({ ...currentCreditSalesLine, price: e.target.value })} />
                                    </div>
                                    <button type="button" onClick={handleAddCreditSalesLine} style={{ padding: '11px 18px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '13px' }}>
                                        + Row
                                    </button>
                                </div>
                            </div>

                            {/* Items list */}
                            {creditSalesItems.length > 0 && (
                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Qty</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Remove</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {creditSalesItems.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '8px 12px', fontWeight: 650 }}>{lang === 'ta' ? (item.flowerTypeTa || item.flowerType) : item.flowerType}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{item.quantity} Kg</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹{item.price}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>₹{item.total.toFixed(0)}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                        <button type="button" onClick={() => setCreditSalesItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 900, color: '#10b981', fontSize: '15px' }}>
                                        Total Sale: ₹{creditSalesItems.reduce((sum, item) => sum + item.total, 0).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="submit" style={S.btnSubmit} disabled={isSaving || creditSalesItems.length === 0}>Save Sales Entry</button>
                                <button type="button" style={S.btnCancel} onClick={() => { setCreditSalesForm({ buyerId: '', date: toDateStr(new Date()) }); setCreditSalesItems([]); }}>Cancel</button>
                            </div>
                        </div>
                    </form>
                )}

                {/* ────────────────── CREDIT PURCHASE ENTRY ────────────────── */}
                {entryType === 'purchase_credit' && (
                    <form onSubmit={handleSubmitCreditPurchase} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={S.sectionTitle}>📉 {lang === 'ta' ? 'கொள்முதல் பதிவு (விற்பனையாளர் கடன்)' : 'Standard Credit Purchase Entry'}</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'தேதி' : 'Date'}</label>
                                <input type="date" style={S.input} value={creditPurchaseForm.date} onChange={e => setCreditPurchaseForm({ ...creditPurchaseForm, date: e.target.value })} required />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'விற்பனையாளர் பெயர்' : 'Select Vendor'}</label>
                                <SearchSelect 
                                    items={vendors} 
                                    value={creditPurchaseForm.vendorId} 
                                    placeholder="Choose vendor..." 
                                    onChange={sel => setCreditPurchaseForm({ ...creditPurchaseForm, vendorId: sel.id })} 
                                    lang={lang} 
                                />
                            </div>
                        </div>

                        <div style={{ pointerEvents: creditPurchaseForm.vendorId ? 'auto' : 'none', opacity: creditPurchaseForm.vendorId ? 1 : 0.45, transition: 'all 0.3s' }}>
                            {/* Lines Insertion Section */}
                            <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '16px', border: '1px solid #fef3c7', marginBottom: '16px' }}>
                                <span style={{ ...S.label, color: '#b45309', marginBottom: '12px', display: 'block' }}>Add Flower Detail Rows</span>
                                <div className="flower-line-grid">
                                    <div>
                                        <label style={S.label}>Flower Variety</label>
                                        <SearchSelect 
                                            items={products} 
                                            value={currentCreditPurchaseLine.flowerType} 
                                            placeholder="Choose flower..." 
                                            onChange={sel => setCurrentCreditPurchaseLine(prev => ({ ...prev, flowerType: sel.name, flowerTypeTa: sel.taName || '' }))} 
                                            lang={lang} 
                                        />
                                    </div>
                                    <div>
                                        <label style={S.label}>Qty (Kg)</label>
                                        <input type="number" inputMode="decimal" style={S.input} placeholder="0.0" value={currentCreditPurchaseLine.quantity} onChange={e => setCurrentCreditPurchaseLine({ ...currentCreditPurchaseLine, quantity: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={S.label}>Rate (₹)</label>
                                        <input type="number" inputMode="decimal" style={S.input} placeholder="0.0" value={currentCreditPurchaseLine.price} onChange={e => setCurrentCreditPurchaseLine({ ...currentCreditPurchaseLine, price: e.target.value })} />
                                    </div>
                                    <button type="button" onClick={handleAddCreditPurchaseLine} style={{ padding: '11px 18px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '13px' }}>
                                        + Row
                                    </button>
                                </div>
                            </div>

                            {/* Items list */}
                            {creditPurchaseItems.length > 0 && (
                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Qty</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Remove</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {creditPurchaseItems.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '8px 12px', fontWeight: 650 }}>{lang === 'ta' ? (item.flowerTypeTa || item.flowerType) : item.flowerType}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{item.quantity} Kg</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹{item.price}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>₹{item.total.toFixed(0)}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                        <button type="button" onClick={() => setCreditPurchaseItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 900, color: '#ef4444', fontSize: '15px' }}>
                                        Total Purchase: ₹{creditPurchaseItems.reduce((sum, item) => sum + item.total, 0).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="submit" style={S.btnSubmit} disabled={isSaving || creditPurchaseItems.length === 0}>Save Purchase Entry</button>
                                <button type="button" style={S.btnCancel} onClick={() => { setCreditPurchaseForm({ vendorId: '', date: toDateStr(new Date()) }); setCreditPurchaseItems([]); }}>Cancel</button>
                            </div>
                        </div>
                    </form>
                )}

                {/* ────────────────── CASH PURCHASE ────────────────── */}
                {entryType === 'cash_purchase' && (
                    <form onSubmit={handleSubmitCashPurchase} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={S.sectionTitle}>🛒 {lang === 'ta' ? 'ரொக்கக் கொள்முதல் பதிவு' : 'Record Cash Purchase'}</h3>
                        
                        <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '8px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'end' }}>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'பணியாளர் பெயர்' : 'Select Staff (Mandatory)'}</label>
                                    <SearchSelect 
                                        items={salesmen.filter(s => s.status === 'Active')} 
                                        value={cashPurchaseForm.staffId} 
                                        placeholder="Select Staff member..." 
                                        onChange={sel => setCashPurchaseForm({ ...cashPurchaseForm, staffId: sel.id })} 
                                        lang={lang} 
                                    />
                                </div>
                                <div>
                                    <label style={S.label}>Available Cashbox Balance</label>
                                    <div style={{ ...S.input, background: '#f8fafc', color: '#15803d', fontWeight: 800 }}>
                                        ₹ {getStaffBalance(cashPurchaseForm.staffId).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ pointerEvents: cashPurchaseForm.staffId ? 'auto' : 'none', opacity: cashPurchaseForm.staffId ? 1 : 0.45, transition: 'all 0.3s' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'தேதி' : 'Date'}</label>
                                    <input type="date" style={S.input} value={cashPurchaseForm.date} onChange={e => setCashPurchaseForm({ ...cashPurchaseForm, date: e.target.value })} required />
                                </div>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'கடை / விவசாயி பெயர்' : 'Shop/Vendor Name'}</label>
                                    <input type="text" style={S.input} placeholder="Vendor name" value={cashPurchaseForm.shopName} onChange={e => setCashPurchaseForm({ ...cashPurchaseForm, shopName: e.target.value })} required={!!cashPurchaseForm.staffId} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'கைபேசி எண்' : 'Mobile Number (Optional)'}</label>
                                    <input type="text" style={S.input} placeholder="9876543210" value={cashPurchaseForm.mobileNumber} onChange={e => setCashPurchaseForm({ ...cashPurchaseForm, mobileNumber: e.target.value })} />
                                </div>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'ஊர்' : 'Location (Optional)'}</label>
                                    <input type="text" style={S.input} placeholder="e.g. Tindivanam" value={cashPurchaseForm.location} onChange={e => setCashPurchaseForm({ ...cashPurchaseForm, location: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'வகை' : 'Payment Mode'}</label>
                                    <select value={cashPurchaseForm.paymentMode} onChange={e => setCashPurchaseForm({ ...cashPurchaseForm, paymentMode: e.target.value })} style={S.input}>
                                        <option value="Cash">Cash</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Bank">Bank Transfer</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'குறிப்பு' : 'Remarks / Note'}</label>
                                    <input type="text" style={S.input} placeholder="Short details" value={cashPurchaseForm.remarks} onChange={e => setCashPurchaseForm({ ...cashPurchaseForm, remarks: e.target.value })} />
                                </div>
                            </div>

                            {/* Lines Insertion Section */}
                            <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '16px', border: '1px solid #fef3c7', marginBottom: '16px' }}>
                                <span style={{ ...S.label, color: '#b45309', marginBottom: '12px', display: 'block' }}>Add Flower Detail Rows</span>
                                <div className="flower-line-grid">
                                    <div>
                                        <label style={S.label}>Flower Variety</label>
                                        <SearchSelect 
                                            items={products} 
                                            value={currentPurchaseLine.flowerType} 
                                            placeholder="Choose flower..." 
                                            onChange={sel => setCurrentPurchaseLine(prev => ({ ...prev, flowerType: sel.name, flowerTypeTa: sel.taName || '' }))} 
                                            lang={lang} 
                                        />
                                    </div>
                                    <div>
                                        <label style={S.label}>Qty (Kg)</label>
                                        <input type="number" inputMode="decimal" style={S.input} placeholder="0.0" value={currentPurchaseLine.quantity} onChange={e => setCurrentPurchaseLine({ ...currentPurchaseLine, quantity: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={S.label}>Rate (₹)</label>
                                        <input type="number" inputMode="decimal" style={S.input} placeholder="0.0" value={currentPurchaseLine.price} onChange={e => setCurrentPurchaseLine({ ...currentPurchaseLine, price: e.target.value })} />
                                    </div>
                                    <button type="button" onClick={handleAddPurchaseLine} style={{ padding: '11px 18px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '13px' }}>
                                        + Row
                                    </button>
                                </div>
                            </div>

                            {/* Items list */}
                            {purchaseItems.length > 0 && (
                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Qty</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Remove</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {purchaseItems.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '8px 12px', fontWeight: 650 }}>{lang === 'ta' ? (item.flowerTypeTa || item.flowerType) : item.flowerType}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{item.quantity} Kg</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹{item.price}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>₹{item.total.toFixed(0)}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                        <button type="button" onClick={() => setPurchaseItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 900, color: '#b45309', fontSize: '15px' }}>
                                        Total: ₹{purchaseItems.reduce((sum, item) => sum + item.total, 0).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="submit" style={S.btnSubmit} disabled={isSaving || purchaseItems.length === 0}>Save Cash Purchase</button>
                                <button type="button" style={S.btnCancel} onClick={() => { setCashPurchaseForm({ staffId: '', shopName: '', mobileNumber: '', location: '', paymentMode: 'Cash', remarks: '', date: toDateStr(new Date()) }); setPurchaseItems([]); }}>Cancel</button>
                            </div>
                        </div>
                    </form>
                )}

                {/* ────────────────── CASH SALES ────────────────── */}
                {entryType === 'cash_sales' && (
                    <form onSubmit={handleSubmitCashSales} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={S.sectionTitle}>💵 {lang === 'ta' ? 'ரொக்க விற்பனை பதிவு' : 'Record Cash Sales'}</h3>
                        
                        <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '8px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'end' }}>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'பணியாளர் பெயர்' : 'Select Staff (Mandatory)'}</label>
                                    <SearchSelect 
                                        items={salesmen.filter(s => s.status === 'Active')} 
                                        value={cashSalesForm.staffId} 
                                        placeholder="Select Staff member..." 
                                        onChange={sel => setCashSalesForm({ ...cashSalesForm, staffId: sel.id })} 
                                        lang={lang} 
                                    />
                                </div>
                                <div>
                                    <label style={S.label}>Available Cashbox Balance</label>
                                    <div style={{ ...S.input, background: '#f8fafc', color: '#15803d', fontWeight: 800 }}>
                                        ₹ {getStaffBalance(cashSalesForm.staffId).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ pointerEvents: cashSalesForm.staffId ? 'auto' : 'none', opacity: cashSalesForm.staffId ? 1 : 0.45, transition: 'all 0.3s' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'தேதி' : 'Date'}</label>
                                    <input type="date" style={S.input} value={cashSalesForm.date} onChange={e => setCashSalesForm({ ...cashSalesForm, date: e.target.value })} required />
                                </div>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'வாடிக்கையாளர் பெயர்' : 'Customer Name'}</label>
                                    <input type="text" style={S.input} placeholder="Customer Name" value={cashSalesForm.customerName} onChange={e => setCashSalesForm({ ...cashSalesForm, customerName: e.target.value })} required={!!cashSalesForm.staffId} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'கைபேசி எண்' : 'Mobile Number (Optional)'}</label>
                                    <input type="text" style={S.input} placeholder="9876543210" value={cashSalesForm.mobileNumber} onChange={e => setCashSalesForm({ ...cashSalesForm, mobileNumber: e.target.value })} />
                                </div>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'ஊர்' : 'Location (Optional)'}</label>
                                    <input type="text" style={S.input} placeholder="e.g. Tindivanam" value={cashSalesForm.location} onChange={e => setCashSalesForm({ ...cashSalesForm, location: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'வகை' : 'Payment Mode'}</label>
                                    <select value={cashSalesForm.paymentMode} onChange={e => setCashSalesForm({ ...cashSalesForm, paymentMode: e.target.value })} style={S.input}>
                                        <option value="Cash">Cash</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Bank">Bank Transfer</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'குறிப்பு' : 'Remarks / Note'}</label>
                                    <input type="text" style={S.input} placeholder="Short details" value={cashSalesForm.remarks} onChange={e => setCashSalesForm({ ...cashSalesForm, remarks: e.target.value })} />
                                </div>
                            </div>

                            {/* Lines Insertion Section */}
                            <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '16px', border: '1px solid #fef3c7', marginBottom: '16px' }}>
                                <span style={{ ...S.label, color: '#b45309', marginBottom: '12px', display: 'block' }}>Add Flower Detail Rows</span>
                                <div className="flower-line-grid">
                                    <div>
                                        <label style={S.label}>Flower Variety</label>
                                        <SearchSelect 
                                            items={products} 
                                            value={currentSalesLine.flowerType} 
                                            placeholder="Choose flower..." 
                                            onChange={sel => setCurrentSalesLine(prev => ({ ...prev, flowerType: sel.name, flowerTypeTa: sel.taName || '' }))} 
                                            lang={lang} 
                                        />
                                    </div>
                                    <div>
                                        <label style={S.label}>Qty (Kg)</label>
                                        <input type="number" inputMode="decimal" style={S.input} placeholder="0.0" value={currentSalesLine.quantity} onChange={e => setCurrentSalesLine({ ...currentSalesLine, quantity: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={S.label}>Rate (₹)</label>
                                        <input type="number" inputMode="decimal" style={S.input} placeholder="0.0" value={currentSalesLine.price} onChange={e => setCurrentSalesLine({ ...currentSalesLine, price: e.target.value })} />
                                    </div>
                                    <button type="button" onClick={handleAddSalesLine} style={{ padding: '11px 18px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '13px' }}>
                                        + Row
                                    </button>
                                </div>
                            </div>

                            {/* Items list */}
                            {salesItems.length > 0 && (
                                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Qty</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'center' }}>Remove</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {salesItems.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '8px 12px', fontWeight: 650 }}>{lang === 'ta' ? (item.flowerTypeTa || item.flowerType) : item.flowerType}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{item.quantity} Kg</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>₹{item.price}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>₹{item.total.toFixed(0)}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                        <button type="button" onClick={() => setSalesItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 900, color: '#b45309', fontSize: '15px' }}>
                                        Total: ₹{salesItems.reduce((sum, item) => sum + item.total, 0).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="submit" style={S.btnSubmit} disabled={isSaving || salesItems.length === 0}>Save Cash Sales</button>
                                <button type="button" style={S.btnCancel} onClick={() => { setCashSalesForm({ staffId: '', customerName: '', mobileNumber: '', location: '', paymentMode: 'Cash', remarks: '', date: toDateStr(new Date()) }); setSalesItems([]); }}>Cancel</button>
                            </div>
                        </div>
                    </form>
                )}

                {/* ────────────────── STAFF EXPENSE ────────────────── */}
                {entryType === 'staff_expense' && (
                    <form onSubmit={handleSubmitExpense} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={S.sectionTitle}>💸 {lang === 'ta' ? 'பணியாளர் செலவு பதிவு' : 'Record Staff Expense'}</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'தேதி' : 'Date'}</label>
                                <input type="date" style={S.input} value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} required />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'பணியாளர்' : 'Select Staff (Mandatory)'}</label>
                                <SearchSelect 
                                    items={salesmen.filter(s => s.status === 'Active')} 
                                    value={expenseForm.staffId} 
                                    placeholder="Choose staff member..." 
                                    onChange={sel => setExpenseForm({ ...expenseForm, staffId: sel.id })} 
                                    lang={lang} 
                                />
                            </div>
                        </div>

                        <div style={{ pointerEvents: expenseForm.staffId ? 'auto' : 'none', opacity: expenseForm.staffId ? 1 : 0.45, transition: 'all 0.3s' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'செலவு வகை' : 'Category'}</label>
                                    <select value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} style={S.input}>
                                        <option value="Petrol">Petrol</option>
                                        <option value="Food">Food / Tea</option>
                                        <option value="Rent">Market Rent</option>
                                        <option value="Salary">Staff Salary</option>
                                        <option value="Others">Others</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'தொகை (₹)' : 'Expense Amount (₹)'}</label>
                                    <input type="number" inputMode="decimal" style={S.input} placeholder="0" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} required={!!expenseForm.staffId} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={S.label}>{lang === 'ta' ? 'குறிப்பு' : 'Notes / Remarks'}</label>
                                <input type="text" style={S.input} placeholder="Write brief notes" value={expenseForm.notes} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="submit" style={S.btnSubmit} disabled={isSaving || !expenseForm.amount}>Save Expense</button>
                                <button type="button" style={S.btnCancel} onClick={() => setExpenseForm({ staffId: '', category: 'Petrol', amount: '', notes: '', date: toDateStr(new Date()) })}>Cancel</button>
                            </div>
                        </div>
                    </form>
                )}

                {/* ────────────────── STAFF TRANSFER ────────────────── */}
                {entryType === 'staff_transfer' && (
                    <form onSubmit={handleSubmitTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={S.sectionTitle}>🔄 {lang === 'ta' ? 'பணியாளர் பண பரிமாற்றம்' : 'Record Staff Credit Transfer'}</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'தேதி' : 'Date'}</label>
                                <input type="date" style={S.input} value={transferForm.date} onChange={e => setTransferForm({ ...transferForm, date: e.target.value })} required />
                            </div>
                            <div>
                                <label style={S.label}>{lang === 'ta' ? 'அனுப்புபவர்' : 'From Staff (Sender)'}</label>
                                <SearchSelect 
                                    items={salesmen.filter(s => s.status === 'Active')} 
                                    value={transferForm.fromStaffId} 
                                    placeholder="Choose sender..." 
                                    onChange={sel => setTransferForm({ ...transferForm, fromStaffId: sel.id })} 
                                    lang={lang} 
                                />
                            </div>
                        </div>

                        <div style={{ pointerEvents: transferForm.fromStaffId ? 'auto' : 'none', opacity: transferForm.fromStaffId ? 1 : 0.45, transition: 'all 0.3s' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'பெறுபவர்' : 'To Staff (Receiver)'}</label>
                                    <SearchSelect 
                                        items={salesmen.filter(s => s.status === 'Active' && s.id !== transferForm.fromStaffId)} 
                                        value={transferForm.toStaffId} 
                                        placeholder="Choose receiver..." 
                                        onChange={sel => setTransferForm({ ...transferForm, toStaffId: sel.id })} 
                                        lang={lang} 
                                    />
                                </div>
                                <div>
                                    <label style={S.label}>{lang === 'ta' ? 'பரிமாற்ற தொகை (₹)' : 'Transfer Amount (₹)'}</label>
                                    <input type="number" inputMode="decimal" style={S.input} placeholder="0" value={transferForm.amount} onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })} required={!!transferForm.fromStaffId} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={S.label}>{lang === 'ta' ? 'குறிப்பு' : 'Notes / Remarks'}</label>
                                <input type="text" style={S.input} placeholder="Write details" value={transferForm.notes} onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="submit" style={S.btnSubmit} disabled={isSaving || !transferForm.toStaffId || !transferForm.amount}>Save Transfer</button>
                                <button type="button" style={S.btnCancel} onClick={() => setTransferForm({ fromStaffId: '', toStaffId: '', amount: '', notes: '', date: toDateStr(new Date()) })}>Cancel</button>
                            </div>
                        </div>
                    </form>
                )}

            </div>

            <VoiceEntryModal
                isOpen={isVoiceModalOpen}
                onClose={() => setIsVoiceModalOpen(false)}
                onConfirm={handleVoiceConfirm}
                entities={getVoiceModalEntities()}
                type={getVoiceModalType()}
                langSetting={lang}
            />
        </div>
    );
};

export default QuickEntry;
