import React, { useState, useEffect, useMemo, useContext } from 'react';
import { subscribeToCollection } from '../utils/storage';
import { LangContext } from '../components/Layout';
import * as XLSX from 'xlsx';
import { Printer, Download, BarChart2 } from 'lucide-react';

const S = {
    page: {
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        padding: '28px 32px',
        minHeight: '70vh',
        fontFamily: 'var(--font-sans)',
        maxWidth: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px', gap: '16px', flexWrap: 'wrap',
    },
    titleRow: { display: 'flex', alignItems: 'center', gap: '10px' },
    titleCol: { display: 'flex', flexDirection: 'column' },
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
    btnAction: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 14px', borderRadius: '8px',
        border: '1.5px solid #d1d5db', background: '#f9fafb',
        color: '#374151', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.18s',
        fontFamily: 'var(--font-sans)',
    },
    toolbar: {
        display: 'flex', alignItems: 'center', gap: '20px',
        padding: '20px', background: '#f0fdfa', border: '1px solid #99f6e4',
        borderRadius: '12px', marginBottom: '24px', flexWrap: 'wrap',
    },
    filterGroup: {
        display: 'flex', flexDirection: 'column', gap: '4px',
    },
    label: {
        fontSize: '10px', fontWeight: 700, color: '#0d9488',
        textTransform: 'uppercase', letterSpacing: '0.08em',
    },
    input: {
        padding: '7px 12px', borderRadius: '8px', border: '1.5px solid #99f6e4',
        fontSize: '13px', fontWeight: 600, color: '#374151', outline: 'none',
        background: '#fff',
    },
    table: {
        width: '100%', borderCollapse: 'collapse',
    },
    th: {
        padding: '8px 10px', textAlign: 'left',
        fontSize: '11px', fontWeight: 700, color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        borderBottom: '1.5px solid #e2e8f0', whiteSpace: 'normal',
        wordBreak: 'break-word',
        background: '#f8fafc',
    },
    td: {
        padding: '8px 10px', fontSize: '12px',
        color: '#334155', borderBottom: '1px solid #f1f5f9',
        verticalAlign: 'middle', whiteSpace: 'normal',
        wordBreak: 'break-word',
    },
    emptyRow: {
        padding: '80px 16px', textAlign: 'center',
        color: '#9ca3af', fontStyle: 'italic', fontSize: '14px',
    }
};

const TD_S = S.td;
const TH_S = S.th;

const displayDate = (iso) => {
    if (!iso || typeof iso !== 'string') return '---';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const SalesmanReports = () => {
    const { lang } = useContext(LangContext);
    const [salesmen, setSalesmen] = useState([]);
    const [cashRecords, setCashRecords] = useState([]);
    const [purchaseRecords, setPurchaseRecords] = useState([]);
    const [flowers, setFlowers] = useState([]);
    const [payments, setPayments] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [cashPurchases, setCashPurchases] = useState([]);
    const [cashSales, setCashSales] = useState([]);

    const today = new Date().toLocaleDateString('en-CA');
    const [selectedSalesmanId, setSelectedSalesmanId] = useState('');
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);

    useEffect(() => {
        const unsubSalesmen = subscribeToCollection('salesmen', setSalesmen);
        const unsubCash = subscribeToCollection('salesman_cash', setCashRecords);
        const unsubPurchases = subscribeToCollection('salesman_purchases', setPurchaseRecords);
        const unsubProducts = subscribeToCollection('products', (data) => {
            setFlowers(data.length === 0
                ? [{ name: 'Rose', taName: 'ரோஜா' }, { name: 'Jasmine', taName: 'மல்லிகை' }, { name: 'Marigold', taName: 'சாமந்தி' }]
                : data);
        });
        const unsubPayments = subscribeToCollection('payments', setPayments);
        const unsubExpenses = subscribeToCollection('salesman_expenses', setExpenses);
        const unsubTransfers = subscribeToCollection('salesman_transfers', setTransfers);
        const unsubVendors = subscribeToCollection('vendors', setVendors);
        const unsubBuyers = subscribeToCollection('buyers', setBuyers);
        const unsubCashPurchases = subscribeToCollection('cash_purchases', setCashPurchases);
        const unsubCashSales = subscribeToCollection('cash_sales', setCashSales);

        return () => {
            unsubSalesmen();
            unsubCash();
            unsubPurchases();
            unsubProducts();
            unsubPayments();
            unsubExpenses();
            unsubTransfers();
            unsubVendors();
            unsubBuyers();
            unsubCashPurchases();
            unsubCashSales();
        };
    }, []);

    const fmt = (n) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

    const salesmanCardsData = useMemo(() => {
        const activeSalesmen = salesmen.filter(s => 
            s.status === 'Active' && (!selectedSalesmanId || s.id === selectedSalesmanId)
        );

        return activeSalesmen.map(salesman => {
            const creditList = [];

            // 1. Opening Balance
            const sCashHist = cashRecords.filter(r => r.salesmanId === salesman.id && r.date < fromDate);
            const sTransInHist = transfers.filter(t => t.toSalesmanId === salesman.id && t.date < fromDate);
            const sBuyerPaymentsHist = payments.filter(p => (p.type === 'buyer' || !p.type) && p.salesmanId === salesman.id && (
                (p.date && p.date < fromDate) || (p.timestamp && p.timestamp.split('T')[0] < fromDate)
            ));
            const sPurchasesHist = purchaseRecords.filter(p => p.salesmanId === salesman.id && p.date < fromDate);
            const sPaymentsHist = payments.filter(p => p.type === 'vendor' && p.salesmanId === salesman.id && p.date < fromDate);
            const sExpensesHist = expenses.filter(e => e.salesmanId === salesman.id && e.date < fromDate);
            const sTransOutHist = transfers.filter(t => t.fromSalesmanId === salesman.id && t.date < fromDate);

            const openingCashInflow = (Number(salesman.openingCash) || 0) + 
                sCashHist.reduce((sum, r) => sum + (Number(r.openingCash) || 0), 0) + 
                sTransInHist.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) +
                sBuyerPaymentsHist.reduce((sum, p) => sum + (Number(p.amount) || 0) + (Number(p.cashLess) || 0), 0);

            const openingCashOutflow = 
                sPurchasesHist.reduce((sum, p) => sum + (Number(p.grandTotal) || 0), 0) + 
                sPaymentsHist.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) + 
                sExpensesHist.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) + 
                sTransOutHist.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

            const openingBalance = openingCashInflow - openingCashOutflow;

            if (openingBalance > 0) {
                creditList.push({
                    particulars: 'OB',
                    quantity: null,
                    rate: null,
                    total: openingBalance
                });
            }

            // 2. Cash Issued
            const rangeCash = cashRecords.filter(r => r.salesmanId === salesman.id && r.date >= fromDate && r.date <= toDate);
            rangeCash.forEach(r => {
                creditList.push({
                    particulars: (lang === 'ta' ? 'ரொக்கம் வழங்கப்பட்டது' : 'Cash Issued') + (r.remarks ? ` (${r.remarks})` : ''),
                    quantity: null,
                    rate: null,
                    total: Number(r.openingCash) || 0
                });
            });

            // 3. Transfers In
            const rangeTransIn = transfers.filter(t => t.toSalesmanId === salesman.id && t.date >= fromDate && t.date <= toDate);
            rangeTransIn.forEach(t => {
                const fromSales = salesmen.find(s => s.id === t.fromSalesmanId);
                const fromName = fromSales ? (lang === 'ta' ? (fromSales.nameTa || fromSales.name) : fromSales.name) : '---';
                creditList.push({
                    particulars: fromName,
                    quantity: null,
                    rate: null,
                    total: Number(t.amount) || 0
                });
            });

            // 4. Buyer Payments Received (Collection)
            const rangeBuyerPayments = payments.filter(p => (p.type === 'buyer' || !p.type) && p.salesmanId === salesman.id && (
                (p.date && p.date >= fromDate && p.date <= toDate) ||
                (p.timestamp && p.timestamp.split('T')[0] >= fromDate && p.timestamp.split('T')[0] <= toDate)
            ));
            rangeBuyerPayments.forEach(p => {
                const buyer = buyers.find(b => b.id === p.entityId);
                const buyerName = buyer ? buyer.name : (lang === 'ta' ? 'வாடிக்கையாளர்' : 'Buyer');
                const noteSuffix = p.note ? ` (${p.note})` : '';
                creditList.push({
                    particulars: `${buyerName}${noteSuffix}`,
                    quantity: null,
                    rate: null,
                    total: (Number(p.amount) || 0) + (Number(p.cashLess) || 0)
                });
            });

            // 5. Cash Sales
            const rangeCashSales = cashSales.filter(cs => cs.salesmanId === salesman.id && cs.date >= fromDate && cs.date <= toDate);
            rangeCashSales.forEach(cs => {
                if (cs.items && cs.items.length > 0) {
                    cs.items.forEach(item => {
                        const fl = flowers.find(f => f.name === item.flowerType);
                        const flowerName = fl ? (lang === 'ta' ? (fl.taName || item.flowerType) : item.flowerType) : item.flowerType;
                        creditList.push({
                            particulars: `${flowerName} (${item.quantity}*${item.price || item.rate})`,
                            quantity: Number(item.quantity) || 0,
                            rate: Number(item.price) || 0,
                            total: Number(item.total) || 0
                        });
                    });
                } else {
                    creditList.push({
                        particulars: (lang === 'ta' ? 'ரொக்க விற்பனை' : 'Cash Sales') + ` (${cs.customerName || '---'})`,
                        quantity: null,
                        rate: null,
                        total: Number(cs.grandTotal) || 0
                    });
                }
            });

            const totalCredit = creditList.reduce((sum, item) => sum + (item.total || 0), 0);

            const debitList = [];

            if (openingBalance < 0) {
                debitList.push({
                    particulars: 'OB',
                    quantity: null,
                    rate: null,
                    total: Math.abs(openingBalance)
                });
            }

            // 1. Farmer purchases
            const rangePurchases = purchaseRecords.filter(p => p.salesmanId === salesman.id && p.date >= fromDate && p.date <= toDate);
            rangePurchases.forEach(p => {
                p.items.forEach(item => {
                    const fl = flowers.find(f => f.name === item.flowerType);
                    const flowerName = fl ? (lang === 'ta' ? (fl.taName || item.flowerType) : item.flowerType) : item.flowerType;
                    debitList.push({
                        particulars: `${flowerName} (${lang === 'ta' ? 'விவசாயி' : 'Farmer'}: ${p.farmerName || '---'})`,
                        quantity: Number(item.quantity) || 0,
                        rate: Number(item.price) || 0,
                        total: Number(item.total) || 0
                    });
                });
            });

            // 2. Vendor payments
            const rangePayments = payments.filter(p => p.type === 'vendor' && p.salesmanId === salesman.id && p.date >= fromDate && p.date <= toDate);
            rangePayments.forEach(p => {
                const vendor = vendors.find(v => v.id === p.entityId);
                const vendorName = vendor 
                    ? (lang === 'ta' ? (vendor.nameTa || vendor.name) : vendor.name) 
                    : (p.note || (lang === 'ta' ? 'விற்பனையாளர்' : 'Vendor'));
                const noteSuffix = (vendor && p.note && p.note !== '---') ? ` (${p.note})` : '';

                debitList.push({
                    particulars: `${vendorName}${noteSuffix}`,
                    quantity: null,
                    rate: null,
                    total: Number(p.amount) || 0
                });
            });

            // 3. Expenses
            const rangeExpenses = expenses.filter(e => e.salesmanId === salesman.id && e.date >= fromDate && e.date <= toDate);
            rangeExpenses.forEach(e => {
                const detail = [e.category, e.notes].filter(val => val && val !== '---').join(' - ') || '---';
                debitList.push({
                    particulars: `${lang === 'ta' ? 'செலவு' : 'Expense'} (${detail})`,
                    quantity: null,
                    rate: null,
                    total: Number(e.amount) || 0
                });
            });

            // 4. Transfers Out
            const rangeTransOut = transfers.filter(t => t.fromSalesmanId === salesman.id && t.date >= fromDate && t.date <= toDate);
            rangeTransOut.forEach(t => {
                const toSales = salesmen.find(s => s.id === t.toSalesmanId);
                const toName = toSales ? (lang === 'ta' ? (toSales.nameTa || toSales.name) : toSales.name) : '---';
                debitList.push({
                    particulars: toName,
                    quantity: null,
                    rate: null,
                    total: Number(t.amount) || 0
                });
            });

            // 5. Cash Purchases
            const rangeCashPurchases = cashPurchases.filter(cp => cp.salesmanId === salesman.id && cp.date >= fromDate && cp.date <= toDate);
            rangeCashPurchases.forEach(cp => {
                if (cp.items && cp.items.length > 0) {
                    cp.items.forEach(item => {
                        const fl = flowers.find(f => f.name === item.flowerType);
                        const flowerName = fl ? (lang === 'ta' ? (fl.taName || item.flowerType) : item.flowerType) : item.flowerType;
                        debitList.push({
                            particulars: `${flowerName} (${item.quantity}*${item.price || item.rate})`,
                            quantity: Number(item.quantity) || 0,
                            rate: Number(item.price) || 0,
                            total: Number(item.total) || 0
                        });
                    });
                } else {
                    debitList.push({
                        particulars: `${lang === 'ta' ? 'ரொக்கக் கொள்முதல்' : 'Cash Purchase'}: ${cp.vendorName || '---'}`,
                        quantity: null,
                        rate: null,
                        total: Number(cp.grandTotal) || 0
                    });
                }
            });

            const totalDebit = debitList.reduce((sum, item) => sum + (item.total || 0), 0);
            const totalDebitKg = debitList.reduce((sum, item) => sum + (item.quantity || 0), 0);

            const netBalanceAmount = totalCredit - totalDebit;

            return {
                salesmanId: salesman.id,
                salesmanName: lang === 'ta' ? (salesman.nameTa || salesman.name) : salesman.name,
                creditList,
                debitList,
                totalCredit,
                totalDebit,
                totalDebitKg,
                netBalanceAmount
            };
        });
    }, [salesmen, cashRecords, purchaseRecords, payments, expenses, transfers, flowers, vendors, buyers, fromDate, toDate, lang, selectedSalesmanId, cashPurchases, cashSales]);

    const handlePrintSingleSalesman = (group) => {
        try {
            const printWindow = window.open('', '_blank');
            const biz = { name: 'S.V.M', motto: 'SRI RAMA JAYAM', type: 'Sri Valli Flower Merchant', address: 'B-7, Flower Market, Tindivanam.', phone1: '', phone2: '' };
            const formattedFrom = fromDate.split('-').reverse().join('/');
            const formattedTo = toDate.split('-').reverse().join('/');
            const title = lang === 'ta' ? 'விற்பனையாளர் அறிக்கை' : 'Salesman Report';
            const salesmanText = `${lang === 'ta' ? 'விற்பனையாளர் பெயர்' : 'Salesman Name'}: ${group.salesmanName}`;
            const dateRangeText = `${formattedFrom} - ${formattedTo}`;

            let debitRows = '';
            if (group.debitList.length === 0) {
                debitRows = `<tr><td colspan="2" style="text-align:center; font-style:italic; padding:10px; color:#94a3b8;">${lang === 'ta' ? 'பற்று எதுவும் இல்லை' : 'No debits.'}</td></tr>`;
            } else {
                debitRows = group.debitList.map(item => `
                    <tr>
                        <td>${item.particulars}</td>
                        <td class="right">${fmt(item.total)}</td>
                    </tr>
                `).join('');
            }

            let creditRows = '';
            if (group.creditList.length === 0) {
                creditRows = `<tr><td colspan="2" style="text-align:center; font-style:italic; padding:10px; color:#94a3b8;">${lang === 'ta' ? 'வரவு எதுவும் இல்லை' : 'No credits.'}</td></tr>`;
            } else {
                creditRows = group.creditList.map(item => `
                    <tr>
                        <td>${item.particulars}</td>
                        <td class="right">${fmt(item.total)}</td>
                    </tr>
                `).join('');
            }

            const contentHtml = `
                <div class="salesman-group" style="margin-bottom:40px; border:1px solid #e2e8f0; padding:20px; border-radius:12px; page-break-inside:avoid; background:#fff;">
                    <h2 style="margin:0 0 15px 0; font-size:18px; border-bottom:2px solid #f1f5f9; padding-bottom:10px; color:#0f172a; display:flex; align-items:center; gap:8px;">👤 ${group.salesmanName}</h2>
                    <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:space-between; margin-bottom:15px;">
                        <div style="flex:1; min-width:250px;">
                            <h3 style="margin:0 0 10px 0; font-size:11px; font-weight:800; color:#16a34a; text-transform:uppercase; letter-spacing:0.05em;">📤 ${lang === 'ta' ? 'வரவு (Cr) / விற்பனை' : 'Credit (Cr) / Sales'}</h3>
                            <table style="width:100%; border-collapse:collapse; font-size:11px; table-layout:fixed;">
                                <colgroup>
                                    <col style="width:65%;" />
                                    <col style="width:35%;" />
                                </colgroup>
                                <thead>
                                    <tr style="background:#f8fafc;">
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:left; padding:8px; color:#475569;">${lang === 'ta' ? 'விவரம்' : 'Particulars'}</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">${lang === 'ta' ? 'தொகை' : 'Amount'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${creditRows}
                                </tbody>
                            </table>
                        </div>

                        <div style="flex:1; min-width:250px;">
                            <h3 style="margin:0 0 10px 0; font-size:11px; font-weight:800; color:#ef4444; text-transform:uppercase; letter-spacing:0.05em;">📥 ${lang === 'ta' ? 'பற்று (Dr) / கொள்முதல்' : 'Debit (Dr) / Purchase'}</h3>
                            <table style="width:100%; border-collapse:collapse; font-size:11px; table-layout:fixed;">
                                <colgroup>
                                    <col style="width:65%;" />
                                    <col style="width:35%;" />
                                </colgroup>
                                <thead>
                                    <tr style="background:#f8fafc;">
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:left; padding:8px; color:#475569;">${lang === 'ta' ? 'விவரம்' : 'Particulars'}</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">${lang === 'ta' ? 'தொகை' : 'Amount'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${debitRows}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:space-between; border-top:1.5px solid #f1f5f9; padding-top:10px; font-size:11px; font-weight:bold;">
                        <div style="flex:1; min-width:250px; display:flex; justify-content:space-between; background:#f0fdf4; padding:6px 12px; border-radius:8px; border:1px solid #bbf7d0;">
                            <span style="color:#15803d;">${lang === 'ta' ? 'மொத்த வரவு (Cr):' : 'Total Sales:'}</span>
                            <span style="color:#16a34a;">${fmt(group.totalCredit)}</span>
                        </div>
                        <div style="flex:1; min-width:250px; display:flex; justify-content:space-between; background:#fff5f5; padding:6px 12px; border-radius:8px; border:1px solid #fecdd3;">
                            <span style="color:#b91c1c;">${lang === 'ta' ? 'மொத்த பற்று (Dr):' : 'Total Purchase:'}</span>
                            <span style="color:#ef4444;">${fmt(group.totalDebit)}</span>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:center; margin-top:15px;">
                        <div style="display:inline-flex; flex-direction:column; align-items:center; background:${group.netBalanceAmount >= 0 ? '#f0fdf4' : '#fff5f5'}; border:${group.netBalanceAmount >= 0 ? '1px solid #bbf7d0' : '1px solid #fecdd3'}; border-radius:10px; padding:6px 20px; text-align:center;">
                            <span style="font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; font-weight:800;">Net Balance</span>
                            <span style="font-size:14px; font-weight:900; color:${group.netBalanceAmount >= 0 ? '#16a34a' : '#ef4444'}; margin-top:2px;">
                                ${group.netBalanceAmount >= 0 ? '+' : ''}${fmt(group.netBalanceAmount)}
                            </span>
                        </div>
                    </div>
                </div>
            `;

            printWindow.document.write(`
                <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; background: #fff; color: #1e293b; }
                        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
                        .header-table td { padding: 0; vertical-align: top; }
                        h1 { margin: 0; font-size: 22px; font-weight: 850; letter-spacing: -0.02em; color: #0f172a; }
                        .subtitle { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-top: 3px; }
                        .meta-info { font-size: 11px; color: #475569; font-weight: 500; text-align: right; line-height: 1.4; }
                        table th { font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1.5px solid #e2e8f0; padding: 6px 8px; color: #475569; }
                        table td { padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #334155; }
                        .right { text-align: right; }
                    </style>
                </head>
                <body>
                    <table class="header-table">
                        <tr>
                            <td>
                                <h1>${biz.name}</h1>
                                <div class="subtitle">${biz.type}</div>
                                <div style="font-size:10px; color:#64748b; margin-top:2px;">${biz.address}</div>
                            </td>
                            <td class="meta-info">
                                <div style="font-weight: 800; font-size:12px; color:#0f172a;">${title.toUpperCase()}</div>
                                <div style="margin-top:2px;">${salesmanText}</div>
                                <div>${dateRangeText}</div>
                            </td>
                        </tr>
                    </table>
                    ${contentHtml}
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch (e) {
            alert('Printing failed: ' + e.message);
        }
    };

    const handlePrintAll = () => {
        if (salesmanCardsData.length === 0) return alert('No data to print.');

        try {
            const printWindow = window.open('', '_blank');
            const biz = { name: 'S.V.M', motto: 'SRI RAMA JAYAM', type: 'Sri Valli Flower Merchant', address: 'B-7, Flower Market, Tindivanam.', phone1: '', phone2: '' };
            const formattedFrom = fromDate.split('-').reverse().join('/');
            const formattedTo = toDate.split('-').reverse().join('/');
            const title = lang === 'ta' ? 'பணியாளர் அறிக்கைகள்' : 'Staff Reports';
            const dateRangeText = `${formattedFrom} - ${formattedTo}`;

            const pagesHtml = salesmanCardsData.map(group => {
                let debitRows = '';
                if (group.debitList.length === 0) {
                    debitRows = `<tr><td colspan="2" style="text-align:center; font-style:italic; padding:10px; color:#94a3b8;">${lang === 'ta' ? 'பற்று எதுவும் இல்லை' : 'No debits.'}</td></tr>`;
                } else {
                    debitRows = group.debitList.map(item => `
                        <tr>
                            <td>${item.particulars}</td>
                            <td class="right">${fmt(item.total)}</td>
                        </tr>
                    `).join('');
                }

                let creditRows = '';
                if (group.creditList.length === 0) {
                    creditRows = `<tr><td colspan="2" style="text-align:center; font-style:italic; padding:10px; color:#94a3b8;">${lang === 'ta' ? 'வரவு எதுவும் இல்லை' : 'No credits.'}</td></tr>`;
                } else {
                    creditRows = group.creditList.map(item => `
                        <tr>
                            <td>${item.particulars}</td>
                            <td class="right">${fmt(item.total)}</td>
                        </tr>
                    `).join('');
                }

                return `
                    <div class="salesman-group" style="margin-bottom:40px; border:1px solid #e2e8f0; padding:20px; border-radius:12px; page-break-inside:avoid; background:#fff;">
                        <h2 style="margin:0 0 15px 0; font-size:18px; border-bottom:2px solid #f1f5f9; padding-bottom:10px; color:#0f172a; display:flex; align-items:center; gap:8px;">👤 ${group.salesmanName}</h2>
                        <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:space-between; margin-bottom:15px;">
                            <div style="flex:1; min-width:250px;">
                                <h3 style="margin:0 0 10px 0; font-size:11px; font-weight:800; color:#16a34a; text-transform:uppercase; letter-spacing:0.05em;">📤 ${lang === 'ta' ? 'வரவு (Cr) / விற்பனை' : 'Credit (Cr) / Sales'}</h3>
                                <table style="width:100%; border-collapse:collapse; font-size:11px; table-layout:fixed;">
                                    <colgroup>
                                        <col style="width:65%;" />
                                        <col style="width:35%;" />
                                    </colgroup>
                                    <thead>
                                        <tr style="background:#f8fafc;">
                                            <th style="border-bottom:1.5px solid #e2e8f0; text-align:left; padding:8px; color:#475569;">${lang === 'ta' ? 'விவரம்' : 'Particulars'}</th>
                                            <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">${lang === 'ta' ? 'தொகை' : 'Amount'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${creditRows}
                                    </tbody>
                                </table>
                            </div>

                            <div style="flex:1; min-width:250px;">
                                <h3 style="margin:0 0 10px 0; font-size:11px; font-weight:800; color:#ef4444; text-transform:uppercase; letter-spacing:0.05em;">📥 ${lang === 'ta' ? 'பற்று (Dr) / கொள்முதல்' : 'Debit (Dr) / Purchase'}</h3>
                                <table style="width:100%; border-collapse:collapse; font-size:11px; table-layout:fixed;">
                                    <colgroup>
                                        <col style="width:65%;" />
                                        <col style="width:35%;" />
                                    </colgroup>
                                    <thead>
                                        <tr style="background:#f8fafc;">
                                            <th style="border-bottom:1.5px solid #e2e8f0; text-align:left; padding:8px; color:#475569;">${lang === 'ta' ? 'விவரம்' : 'Particulars'}</th>
                                            <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">${lang === 'ta' ? 'தொகை' : 'Amount'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${debitRows}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:space-between; border-top:1.5px solid #f1f5f9; padding-top:10px; font-size:11px; font-weight:bold;">
                            <div style="flex:1; min-width:250px; display:flex; justify-content:space-between; background:#f0fdf4; padding:6px 12px; border-radius:8px; border:1px solid #bbf7d0;">
                                <span style="color:#15803d;">${lang === 'ta' ? 'மொத்த வரவு (Cr):' : 'Total Sales:'}</span>
                                <span style="color:#16a34a;">${fmt(group.totalCredit)}</span>
                            </div>
                            <div style="flex:1; min-width:250px; display:flex; justify-content:space-between; background:#fff5f5; padding:6px 12px; border-radius:8px; border:1px solid #fecdd3;">
                                <span style="color:#b91c1c;">${lang === 'ta' ? 'மொத்த பற்று (Dr):' : 'Total Purchase:'}</span>
                                <span style="color:#ef4444;">${fmt(group.totalDebit)}</span>
                            </div>
                        </div>

                        <div style="display:flex; justify-content:center; margin-top:15px;">
                            <div style="display:inline-flex; flex-direction:column; align-items:center; background:${group.netBalanceAmount >= 0 ? '#f0fdf4' : '#fff5f5'}; border:${group.netBalanceAmount >= 0 ? '1px solid #bbf7d0' : '1px solid #fecdd3'}; border-radius:10px; padding:6px 20px; text-align:center;">
                                <span style="font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; font-weight:800;">Net Balance</span>
                                <span style="font-size:14px; font-weight:900; color:${group.netBalanceAmount >= 0 ? '#16a34a' : '#ef4444'}; margin-top:2px;">
                                    ${group.netBalanceAmount >= 0 ? '+' : ''}${fmt(group.netBalanceAmount)}
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            printWindow.document.write(`
                <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; background: #fff; color: #1e293b; }
                        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
                        .header-table td { padding: 0; vertical-align: top; }
                        h1 { margin: 0; font-size: 22px; font-weight: 850; letter-spacing: -0.02em; color: #0f172a; }
                        .subtitle { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-top: 3px; }
                        .meta-info { font-size: 11px; color: #475569; font-weight: 500; text-align: right; line-height: 1.4; }
                        table th { font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1.5px solid #e2e8f0; padding: 6px 8px; color: #475569; }
                        table td { padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #334155; }
                        .right { text-align: right; }
                        @media print {
                            body { padding: 0; }
                            .salesman-group { border: none !important; padding: 0 !important; box-shadow: none !important; page-break-after: always; }
                            .salesman-group:last-child { page-break-after: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <table class="header-table">
                        <tr>
                            <td>
                                <h1>${biz.name}</h1>
                                <div class="subtitle">${biz.type}</div>
                                <div style="font-size:10px; color:#64748b; margin-top:2px;">${biz.address}</div>
                            </td>
                            <td class="meta-info">
                                <div style="font-weight: 800; font-size:12px; color:#0f172a;">${title.toUpperCase()}</div>
                                <div>${dateRangeText}</div>
                            </td>
                        </tr>
                    </table>
                    ${pagesHtml}
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch (e) {
            alert('Printing failed: ' + e.message);
        }
    };

    const handleExportExcel = () => {
        if (salesmanCardsData.length === 0) return alert('No data to export.');

        const filename = `Staff_Reports_${Date.now()}.xlsx`;
        const wsData = salesmanCardsData.map(group => ({
            'Staff Name': group.salesmanName,
            'Total Credit (Inflow) (₹)': group.totalCredit,
            'Total Debit (Outflow) (₹)': group.totalDebit,
            'Total Purchase (KG)': group.totalDebitKg,
            'Net Balance (₹)': group.netBalanceAmount
        }));

        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Staff Summary');
        XLSX.writeFile(wb, filename);
    };

    return (
        <div style={S.page}>
            <style>{`
                div[style*="overflow-x"] table.salesman-report-table,
                div[style*="overflow: auto"] table.salesman-report-table,
                div[style*="overflow:auto"] table.salesman-report-table,
                div:has(> table) table.salesman-report-table,
                table.salesman-report-table {
                    min-width: 0px !important;
                    width: 100% !important;
                }
            `}</style>
            {/* Title & Exports */}
            <div style={S.header}>
                <div style={S.titleRow}>
                    <BarChart2 size={22} color="#0d9488" />
                    <div style={S.titleCol}>
                        <h2 style={S.title}>{lang === 'ta' ? 'பணியாளர் அறிக்கைகள்' : 'Staff Reports'}</h2>
                        <span style={S.subtitle}>{lang === 'ta' ? 'வரவு மற்றும் பற்று விவரங்கள்' : 'Credit and Debit Details'}</span>
                    </div>
                </div>

                {salesmanCardsData.length > 0 && (
                    <div style={S.actions}>
                        <button style={S.btnAction} onClick={handlePrintAll}
                            onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'}
                            onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                        >
                            <Printer size={14} /> {lang === 'ta' ? 'அனைத்தும் அச்சிடு' : 'Print All'}
                        </button>
                        <button style={S.btnAction} onClick={handleExportExcel}
                            onMouseEnter={e => e.currentTarget.style.background='#ecfdf5'}
                            onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                        >
                            <Download size={14} color="#10b981" /> Excel
                        </button>
                    </div>
                )}
            </div>

            {/* Filters Toolbar */}
            <div style={S.toolbar}>
                <div style={S.filterGroup}>
                    <label style={S.label}>{lang === 'ta' ? 'தேதி முதல்' : 'From Date'}</label>
                    <input 
                        type="date"
                        style={S.input}
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                    />
                </div>
                <div style={S.filterGroup}>
                    <label style={S.label}>{lang === 'ta' ? 'தேதி வரை' : 'To Date'}</label>
                    <input 
                        type="date"
                        style={S.input}
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                    />
                </div>

                <div style={S.filterGroup}>
                    <label style={S.label}>{lang === 'ta' ? 'பணியாளர் வடிகட்டி' : 'Filter Staff'}</label>
                    <select
                        style={{...S.input, minWidth: '200px'}}
                        value={selectedSalesmanId}
                        onChange={(e) => setSelectedSalesmanId(e.target.value)}
                    >
                        <option value="">{lang === 'ta' ? 'அனைத்து பணியாளர்களும்...' : 'All Staff...'}</option>
                        {salesmen.filter(s => s.status === 'Active').map(s => (
                            <option key={s.id} value={s.id}>
                                {lang === 'ta' ? (s.nameTa || s.name) : s.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Salesmen Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {salesmanCardsData.length === 0 ? (
                    <div style={S.emptyRow}>
                        {lang === 'ta' ? 'பதிவுகள் எதுவும் இல்லை' : 'No records found matching the selected filters.'}
                    </div>
                ) : (
                    salesmanCardsData.map(group => (
                        <div
                            key={group.salesmanId}
                            style={{
                                background: '#fff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '16px',
                                padding: '16px 20px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            {/* Heading */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '24px' }}>👤</span>
                                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                                        {group.salesmanName}
                                    </h2>
                                </div>
                                <button
                                    onClick={() => handlePrintSingleSalesman(group)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1',
                                        background: '#f8fafc', color: '#475569', fontSize: '12px', fontWeight: 800,
                                        cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-sans)',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                                >
                                    <Printer size={13} color="#475569" />
                                    {lang === 'ta' ? 'அச்சிடு' : 'Print'}
                                </button>
                            </div>

                            {/* Strictly 2 Tables in Single Row */}
                            <div style={{ overflowX: 'auto', width: '100%' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', minWidth: '550px', marginTop: '16px' }}>
                                    {/* Credits column */}
                                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '500px', minWidth: 0 }}>
                                        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            📤 {lang === 'ta' ? 'வரவு (Cr)/விற்பனை' : 'Credit (Cr)/Sales'}
                                        </h4>
                                        <table className="salesman-report-table" style={{ width: '100%', minWidth: 0, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ ...TH_S, whiteSpace: 'normal', wordBreak: 'break-word', width: '75%' }}>{lang === 'ta' ? 'விவரம் (வாடிக்கையாளர்/ஆரம்ப இருப்பு)' : 'Particulars (Customer/Inflow)'}</th>
                                                    <th style={{ ...TH_S, textAlign: 'right', width: '25%' }}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.creditList.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={2} style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                                            {lang === 'ta' ? 'வரவு எதுவும் இல்லை' : 'No credits.'}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    group.creditList.map((item, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '8px 10px', fontSize: '12px', color: '#334155', wordBreak: 'break-word' }}>{item.particulars}</td>
                                                            <td style={{ padding: '8px 10px', fontSize: '12px', color: '#16a34a', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(item.total)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Debits column */}
                                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '500px', minWidth: 0 }}>
                                        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            📥 {lang === 'ta' ? 'பற்று (Dr)/கொள்முதல்' : 'Debit (Dr)/Purchase'}
                                        </h4>
                                        <table className="salesman-report-table" style={{ width: '100%', minWidth: 0, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ ...TH_S, whiteSpace: 'normal', wordBreak: 'break-word', width: '75%' }}>{lang === 'ta' ? 'விவரம் (விவசாயி/விற்பனையாளர்)' : 'Particulars (Farmer/Vendor)'}</th>
                                                    <th style={{ ...TH_S, textAlign: 'right', width: '25%' }}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.debitList.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={2} style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                                            {lang === 'ta' ? 'பற்று எதுவும் இல்லை' : 'No debits.'}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    group.debitList.map((item, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '8px 10px', fontSize: '12px', color: '#334155', wordBreak: 'break-word' }}>{item.particulars}</td>
                                                            <td style={{ padding: '8px 10px', fontSize: '12px', color: '#ef4444', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(item.total)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Aligned Subtotals Bar (Single Row Side-by-Side) */}
                            <div style={{ overflowX: 'auto', width: '100%', marginTop: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', minWidth: '550px', borderTop: '1.5px solid #f1f5f9', paddingTop: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', padding: '8px 14px', borderRadius: '10px', border: '1px solid #bbf7d0', width: '100%', maxWidth: '500px', boxSizing: 'border-box' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#15803d' }}>
                                            {lang === 'ta' ? `மொத்த வரவு (Cr):` : `Total Sales:`}
                                        </span>
                                        <span style={{ fontSize: '13px', fontWeight: 900, color: '#16a34a' }}>{fmt(group.totalCredit)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff5f5', padding: '8px 14px', borderRadius: '10px', border: '1px solid #fecdd3', width: '100%', maxWidth: '500px', boxSizing: 'border-box' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#b91c1c' }}>
                                            {lang === 'ta' ? `மொத்த பற்று (Dr):` : `Total Purchase:`}
                                        </span>
                                        <span style={{ fontSize: '13px', fontWeight: 900, color: '#ef4444' }}>{fmt(group.totalDebit)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Center Net Balance for this salesman */}
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                                <div style={{
                                    display: 'inline-flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    background: group.netBalanceAmount >= 0 ? '#f0fdf4' : '#fff5f5',
                                    border: group.netBalanceAmount >= 0 ? '1px solid #bbf7d0' : '1px solid #fecdd3',
                                    borderRadius: '10px',
                                    padding: '5px 14px',
                                    textAlign: 'center'
                                }}>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {lang === 'ta' ? 'நிகர மதிப்பு' : 'Net Balance'}
                                    </span>
                                    <div style={{
                                        fontSize: '15px',
                                        fontWeight: 900,
                                        color: group.netBalanceAmount >= 0 ? '#16a34a' : '#ef4444',
                                        marginTop: '2px'
                                    }}>
                                        {group.netBalanceAmount >= 0 ? '+' : ''}
                                        {fmt(group.netBalanceAmount)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default SalesmanReports;
