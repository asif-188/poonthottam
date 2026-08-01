import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';
import { subscribeToCollection, saveCashPurchase, addData } from '../utils/storage';
import { LangContext } from '../components/Layout';
import { useTenant } from '../utils/TenantContext';
import { Plus, Trash2, Edit2, Calendar, User, ShoppingBag, History, CreditCard, Image as ImageIcon, Printer, Share2 } from 'lucide-react';

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
const TH_S = {
    padding: '12px 14px', textAlign: 'left',
    fontSize: '11px', fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.08em',
};
const TD_S = {
    padding: '14px', fontSize: '14px', verticalAlign: 'middle'
};

const displayDate = (iso) => {
    if (!iso || typeof iso !== 'string') return '---';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const SearchSelect = ({ items, value, onChange, onKeyDown, inputRef, placeholder, lang, disabled }) => {
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
                    if (n.includes(' ' + q) || tn.includes(' ' + q) || n.includes('-' + q) || tn.includes('-' + q)) return 2;
                    if (n.includes(q) || tn.includes(q) || id.includes(q)) return 1;
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

    const handleKey = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && filtered[cursor]) {
                choose(filtered[cursor]);
                if (onKeyDown) onKeyDown(e);
            } else if (value) {
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
        <div style={{ position: 'relative' }}>
            <input
                ref={inputRef}
                type="text"
                disabled={disabled}
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
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)', maxHeight: '200px',
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

const CashPurchase = () => {
    const { lang } = useContext(LangContext);
    const { tenantData } = useTenant();

    const [salesmen, setSalesmen] = useState([]);
    const [flowers, setFlowers] = useState([]);
    const [cashRecords, setCashRecords] = useState([]);
    const [purchaseRecords, setPurchaseRecords] = useState([]);
    const [payments, setPayments] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [cashPurchases, setCashPurchases] = useState([]);
    const [cashSales, setCashSales] = useState([]);

    // Form inputs
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [staffId, setStaffId] = useState('');
    const [vendorName, setVendorName] = useState('Cash');
    const [mobileNumber, setMobileNumber] = useState('');
    const [location, setLocation] = useState('');
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [remarks, setRemarks] = useState('');
    const [billImage, setBillImage] = useState('');

    // Line insertion state
    const [currentLine, setCurrentLine] = useState({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
    const [billItems, setBillItems] = useState([]);
    const [editingIndex, setEditingIndex] = useState(null);

    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedRecord, setLastSavedRecord] = useState(null);

    // Refs for keyboard navigation
    const refStaff = useRef(null);
    const refVendorName = useRef(null);
    const refMobile = useRef(null);
    const refLocation = useRef(null);
    const refPaymentMode = useRef(null);
    const refRemarks = useRef(null);
    const refFlower = useRef(null);
    const refQty = useRef(null);
    const refRate = useRef(null);
    const refAddBtn = useRef(null);

    useEffect(() => {
        const u1 = subscribeToCollection('salesmen', setSalesmen);
        const u2 = subscribeToCollection('products', (data) => {
            setFlowers(data.length === 0
                ? [{ name: 'Rose', taName: 'ரோஜா' }, { name: 'Jasmine', taName: 'மல்லிகை' }, { name: 'Marigold', taName: 'சாமந்தி' }]
                : data.map(f => ({ name: f.name, taName: f.taName })));
        });
        const u3 = subscribeToCollection('salesman_cash', setCashRecords);
        const u4 = subscribeToCollection('salesman_purchases', setPurchaseRecords);
        const u5 = subscribeToCollection('payments', setPayments);
        const u6 = subscribeToCollection('salesman_expenses', setExpenses);
        const u7 = subscribeToCollection('salesman_transfers', setTransfers);
        const u8 = subscribeToCollection('cash_purchases', setCashPurchases);
        const u9 = subscribeToCollection('cash_sales', setCashSales);

        return () => {
            u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9();
        };
    }, []);

    // Calculate Available Cash Balance dynamically
    const staffBalance = useMemo(() => {
        if (!staffId) return 0;
        const staff = salesmen.find(s => s.id === staffId);
        const baseOpening = Number(staff?.openingCash) || 0;

        // Dynamic checks
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
    }, [staffId, salesmen, cashRecords, transfers, payments, purchaseRecords, expenses, cashPurchases, cashSales]);

    // Available cash formatted
    const formattedStaffBalance = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(staffBalance);

    const activeStaff = useMemo(() => salesmen.find(s => s.id === staffId), [staffId, salesmen]);

    const totalAmount = useMemo(() => billItems.reduce((sum, item) => sum + (item.total || 0), 0), [billItems]);

    // Handle Image Upload -> Base64
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setBillImage(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleAddLine = () => {
        const { flowerType, flowerTypeTa, quantity, price } = currentLine;
        if (!flowerType || !quantity || !price) return;
        const qty = parseFloat(quantity);
        const rate = parseFloat(price);
        if (qty <= 0 || rate <= 0) return;

        const newLine = {
            flowerType,
            flowerTypeTa: flowerTypeTa || '',
            quantity: qty,
            price: rate,
            total: qty * rate
        };

        if (editingIndex !== null) {
            setBillItems(prev => prev.map((item, idx) => idx === editingIndex ? newLine : item));
            setEditingIndex(null);
        } else {
            setBillItems(prev => [...prev, newLine]);
        }

        setCurrentLine({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
        setTimeout(() => refFlower.current?.focus(), 50);
    };

    const handleEditLine = (index) => {
        const item = billItems[index];
        setCurrentLine({
            flowerType: item.flowerType,
            flowerTypeTa: item.flowerTypeTa || '',
            quantity: String(item.quantity),
            price: String(item.price)
        });
        setEditingIndex(index);
        setTimeout(() => refFlower.current?.focus(), 50);
    };

    const handleDeleteLine = (index) => {
        if (editingIndex === index) {
            setEditingIndex(null);
            setCurrentLine({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
        }
        setBillItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmitTransaction = async () => {
        if (!staffId) return alert(lang === 'ta' ? 'தயவுசெய்து பணியாளரைத் தேர்ந்தெடுக்கவும்' : 'Please select staff first.');
        if (billItems.length === 0) return alert(lang === 'ta' ? 'பொருட்களைச் சேர்க்கவும்' : 'Please add at least one item line.');
        if (isSaving) return;

        setIsSaving(true);
        try {
            const billData = {
                date,
                salesmanId: staffId,
                salesmanName: activeStaff?.name || 'Unknown',
                vendorName: 'Cash',
                mobileNumber: '---',
                location: '---',
                paymentMode: 'Cash',
                remarks: '---',
                billImage: billImage || '',
                items: billItems,
                grandTotal: totalAmount,
                type: 'cash_purchase'
            };

            await saveCashPurchase(billData);
            setLastSavedRecord(billData);
            alert(lang === 'ta' ? '✅ ரொக்கக் கொள்முதல் வெற்றிகரமாக சேமிக்கப்பட்டது!' : '✅ Cash Purchase Saved Successfully!');
            
            // Clear Form
            setVendorName('Cash');
            setMobileNumber('');
            setLocation('');
            setRemarks('');
            setBillImage('');
            setPaymentMode('Cash');
            setBillItems([]);
            setEditingIndex(null);
        } catch (error) {
            console.error("Error saving cash purchase:", error);
            alert("Error: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrintBill = () => {
        const record = lastSavedRecord;
        if (!record) return alert('No transaction saved yet to print.');
        const biz = tenantData || { name: 'S.V.M', type: 'SRI VALLI FLOWER MERCHANT', address: 'B-7, FLOWER MARKET, TINDIVANAM.', phone1: '9443247771', phone2: '9952535057' };
        
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
            <head>
                <title>Cash Purchase Bill</title>
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
                    <div style="font-size: 10px;">Ph: ${biz.phone1}</div>
                </div>
                <div class="details">
                    <div><span>Date:</span> <span>${displayDate(record.date)}</span></div>
                    <div><span>Staff:</span> <span>${record.salesmanName} (#${activeStaff?.displayId})</span></div>
                    <div><span>Vendor:</span> <span>${record.vendorName}</span></div>
                    <div><span>Mode:</span> <span>${record.paymentMode}</span></div>
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
                <div class="total">
                    Grand Total: Rs ${record.grandTotal.toFixed(0)}
                </div>
                <div class="footer">
                    🌹 Thank You! 🌹
                </div>
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
        
        let text = `*CASH PURCHASE BILL*\n`;
        text += `---------------------------\n`;
        text += `*Shop:* ${biz.name}\n`;
        text += `*Date:* ${displayDate(record.date)}\n`;
        text += `*Staff:* ${record.salesmanName}\n`;
        text += `*Vendor:* ${record.vendorName}\n`;
        text += `*Payment:* ${record.paymentMode}\n`;
        text += `---------------------------\n`;
        record.items.forEach((item, idx) => {
            const name = lang === 'ta' ? (item.flowerTypeTa || item.flowerType) : item.flowerType;
            text += `${idx + 1}. ${name} - ${item.quantity}Kg @ Rs.${item.price} = Rs.${item.total.toFixed(0)}\n`;
        });
        text += `---------------------------\n`;
        text += `*Grand Total:* *Rs ${record.grandTotal.toFixed(0)}*\n\n`;
        text += `Thank you!`;

        const phone = record.mobileNumber.replace(/[^0-9]/g, '');
        const targetPhone = phone.length === 10 ? `91${phone}` : phone.length === 12 ? phone : '';
        const url = `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

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
                if (!val || val === '0' || parseFloat(val) <= 0) {
                    return;
                }
            }
            nextRef.current?.focus();
            if (nextRef.current?.select) nextRef.current.select();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'var(--font-sans)' }}>
            
            {/* ── Transaction Page Card ── */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', padding: '24px' }}>
                
                {/* ── Header Row ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🛒</span>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {lang === 'ta' ? 'ரொக்கக் கொள்முதல்' : 'Cash Purchase'}
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
                    </div>
                </div>

                {/* ── Step 1: Select Staff (Mandatory) ── */}
                <div style={{ background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '24px' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        👨💼 {lang === 'ta' ? 'படி 1: பணியாளர் தேர்வு (கட்டாயம்)' : 'Step 1: Select Staff (Mandatory)'}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'end' }}>
                        <div>
                            <label style={LABEL_S}>{lang === 'ta' ? 'பணியாளர் பெயர்' : 'Staff Name'}</label>
                            <SearchSelect
                                items={salesmen.filter(s => s.status === 'Active')}
                                value={staffId}
                                placeholder={lang === 'ta' ? 'பணியாளர் தேர்வு செய்க...' : 'Select Staff Member...'}
                                onChange={(selected) => setStaffId(selected.id)}
                                lang={lang}
                                inputRef={refStaff}
                                onKeyDown={(e) => onKey(e, refFlower)}
                            />
                        </div>
                        <div>
                            <label style={LABEL_S}>{lang === 'ta' ? 'பணியாளர் ஐடி' : 'Staff ID'}</label>
                            <input
                                type="text"
                                disabled
                                value={activeStaff?.displayId || '---'}
                                style={{ ...INPUT_S, background: '#f1f5f9', color: '#64748b' }}
                            />
                        </div>
                        <div>
                            <label style={LABEL_S}>{lang === 'ta' ? 'கைவசம் உள்ள பண இருப்பு (காண்க மட்டும்)' : 'Available Cash Balance (Display Only)'}</label>
                            <div style={{ 
                                ...INPUT_S, 
                                background: '#f0fdf4', 
                                border: '1.5px solid #bbf7d0',
                                color: staffBalance < 0 ? '#ef4444' : '#16a34a',
                                fontWeight: 800, 
                                display: 'flex', 
                                alignItems: 'center' 
                            }}>
                                {formattedStaffBalance}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Transaction Details Form ── */}
                <div style={{ pointerEvents: staffId ? 'auto' : 'none', opacity: staffId ? 1 : 0.5, transition: 'all 0.3s' }}>
                    

                    {/* ── Manual Line Insertion ── */}
                    <div style={{ background: '#fffbeb', borderRadius: '16px', border: '1.5px solid #fef3c7', padding: '16px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                            <ShoppingBag size={16} className="text-amber-500" />
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {lang === 'ta' ? 'பூக்கள் விவரம்' : 'Flower Line Insertion'}
                            </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'பூ பெயர்' : 'Select Flower'}</label>
                                <SearchSelect
                                    items={flowers}
                                    value={currentLine.flowerType}
                                    placeholder={lang === 'ta' ? 'பூ வகை...' : 'Choose flower...'}
                                    onChange={(sel) => setCurrentLine(prev => ({
                                        ...prev,
                                        flowerType: sel.name,
                                        flowerTypeTa: sel.taName || ''
                                    }))}
                                    lang={lang}
                                    inputRef={refFlower}
                                    onKeyDown={(e) => onKey(e, refQty)}
                                />
                            </div>
                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'எடை (Kg)' : 'Qty (Kg)'}</label>
                                <input
                                    ref={refQty}
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={currentLine.quantity}
                                    onChange={e => setCurrentLine(prev => ({ ...prev, quantity: e.target.value }))}
                                    onKeyDown={(e) => onKey(e, refRate, currentLine.quantity, refFlower)}
                                    style={INPUT_S}
                                />
                            </div>
                            <div>
                                <label style={LABEL_S}>{lang === 'ta' ? 'விலை (1Kg)' : 'Rate (per Kg)'}</label>
                                <input
                                    ref={refRate}
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={currentLine.price}
                                    onChange={e => setCurrentLine(prev => ({ ...prev, price: e.target.value }))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddLine();
                                        }
                                    }}
                                    style={INPUT_S}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    ref={refAddBtn}
                                    onClick={handleAddLine}
                                    style={{
                                        padding: '9px 18px', background: editingIndex !== null ? '#10b981' : '#d97706', color: '#fff',
                                        border: 'none', borderRadius: '8px', cursor: 'pointer',
                                        fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    <Plus size={16} /> {editingIndex !== null ? (lang === 'ta' ? 'வரிசையைப் புதுப்பி' : 'Update Line') : (lang === 'ta' ? 'வரிசையைச் சேர்' : 'Add Line')}
                                </button>
                                {editingIndex !== null && (
                                    <button
                                        onClick={() => {
                                            setEditingIndex(null);
                                            setCurrentLine({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
                                        }}
                                        style={{
                                            padding: '9px 14px', background: '#ef4444', color: '#fff',
                                            border: 'none', borderRadius: '8px', cursor: 'pointer',
                                            fontWeight: 800, fontSize: '13px'
                                        }}
                                    >
                                        {lang === 'ta' ? 'ரத்து' : 'Cancel'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Table / Items List ── */}
                    {billItems.length > 0 && (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ ...TH_S, width: '60px' }}>S.No</th>
                                        <th style={TH_S}>{lang === 'ta' ? 'பூ வகை' : 'Flower Name'}</th>
                                        <th style={{ ...TH_S, textAlign: 'right' }}>{lang === 'ta' ? 'அளவு' : 'Qty (Kg)'}</th>
                                        <th style={{ ...TH_S, textAlign: 'right' }}>{lang === 'ta' ? 'விலை' : 'Rate (₹)'}</th>
                                        <th style={{ ...TH_S, textAlign: 'right' }}>{lang === 'ta' ? 'மொத்தம்' : 'Amount (₹)'}</th>
                                        <th style={{ ...TH_S, width: '80px', textAlign: 'center' }}>{lang === 'ta' ? 'செயல்' : 'Action'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {billItems.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ ...TD_S, fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                                            <td style={{ ...TD_S, fontWeight: 700 }}>
                                                {lang === 'ta' ? (item.flowerTypeTa || item.flowerType) : item.flowerType}
                                            </td>
                                            <td style={{ ...TD_S, textAlign: 'right', fontWeight: 700 }}>{item.quantity}</td>
                                            <td style={{ ...TD_S, textAlign: 'right', fontWeight: 700 }}>{item.price}</td>
                                            <td style={{ ...TD_S, textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                                                {item.total.toLocaleString('en-IN')}
                                            </td>
                                            <td style={{ ...TD_S, textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                    <button
                                                        onClick={() => handleEditLine(idx)}
                                                        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '4px' }}
                                                        title={lang === 'ta' ? 'மாற்றுக' : 'Edit'}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteLine(idx)}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                        title={lang === 'ta' ? 'அழிக்க' : 'Delete'}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            
                            {/* Grand Total Area */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', gap: '20px', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: '#475569' }}>
                                    {lang === 'ta' ? 'மொத்தத் தொகை:' : 'GRAND TOTAL:'}
                                </span>
                                <span style={{ fontSize: '24px', fontWeight: 900, color: '#d97706' }}>
                                    Rs {totalAmount.toLocaleString('en-IN')}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ── Submited Options / Action Buttons ── */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={handleSubmitTransaction}
                                disabled={isSaving || billItems.length === 0}
                                style={{
                                    padding: '12px 28px', background: '#10b981', color: '#fff',
                                    border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer',
                                    opacity: (isSaving || billItems.length === 0) ? 0.6 : 1, transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(16,185,129,0.2)'
                                }}
                            >
                                {isSaving ? 'Saving...' : (lang === 'ta' ? 'பதிவு செய்' : 'Save Transaction')}
                            </button>
                            <button
                                onClick={() => {
                                    if(window.confirm(lang === 'ta' ? 'இருப்பவற்றை அழிக்கவா?' : 'Reset entries?')) {
                                        setVendorName('');
                                        setMobileNumber('');
                                        setLocation('');
                                        setRemarks('');
                                        setBillImage('');
                                        setBillItems([]);
                                        setEditingIndex(null);
                                        setCurrentLine({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
                                    }
                                }}
                                style={{
                                    padding: '12px 20px', background: '#f1f5f9', color: '#475569',
                                    border: '1.5px solid #cbd5e1', borderRadius: '12px', fontWeight: 800, cursor: 'pointer'
                                }}
                            >
                                {lang === 'ta' ? 'ரத்து செய்' : 'Cancel'}
                            </button>
                        </div>

                        {lastSavedRecord && (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button
                                    onClick={handlePrintBill}
                                    style={{
                                        padding: '10px 18px', background: '#4f46e5', color: '#fff',
                                        border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '8px'
                                    }}
                                >
                                    <Printer size={16} /> {lang === 'ta' ? 'பில் அச்சிடு' : 'Print Bill'}
                                </button>
                                <button
                                    onClick={handleShareWhatsApp}
                                    style={{
                                        padding: '10px 18px', background: '#25d366', color: '#fff',
                                        border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '8px'
                                    }}
                                >
                                    <Share2 size={16} /> WhatsApp
                                </button>
                            </div>
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
};

export default CashPurchase;
