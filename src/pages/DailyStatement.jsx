import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Printer, Calendar, Search, Download } from 'lucide-react';
import { subscribeToCollection } from '../utils/storage';
import { LangContext } from '../components/Layout';
import { useTenant } from '../utils/TenantContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const fmt = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const toDateStr = (d) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

const parseDateStr = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val.substring(0, 10);
    if (val.toDate) {
        return toDateStr(val.toDate());
    }
    return '';
};

const DailyStatement = () => {
    const { lang } = useContext(LangContext);
    const { tenantData } = useTenant();

    const [fromDate, setFromDate] = useState(toDateStr(new Date()));
    const [toDate, setToDate]     = useState(toDateStr(new Date()));
    const [searchText, setSearchText] = useState('');

    const [sales, setSales]       = useState([]);
    const [buyers, setBuyers]     = useState([]);
    const [payments, setPayments] = useState([]);
    const [outsidePurchases, setOutsidePurchases] = useState([]);
    const [vendors, setVendors]   = useState([]);
    
    // Additional collections
    const [farmers, setFarmers]   = useState([]);
    const [salesmen, setSalesmen] = useState([]);
    const [intakes, setIntakes]   = useState([]);
    const [salesmanCash, setSalesmanCash] = useState([]);
    const [salesmanPurchases, setSalesmanPurchases] = useState([]);

    useEffect(() => {
        const u1 = subscribeToCollection('sales', setSales, true);
        const u2 = subscribeToCollection('buyers', setBuyers, true);
        const u3 = subscribeToCollection('payments', setPayments, true);
        const u4 = subscribeToCollection('outside_purchases', setOutsidePurchases, true);
        const u5 = subscribeToCollection('vendors', setVendors, true);
        const u6 = subscribeToCollection('farmers', setFarmers, true);
        const u7 = subscribeToCollection('salesmen', setSalesmen, true);
        const u8 = subscribeToCollection('intakes', setIntakes, true);
        const u9 = subscribeToCollection('salesman_cash', setSalesmanCash, true);
        const u10 = subscribeToCollection('salesman_purchases', setSalesmanPurchases, true);

        return () => {
            u1();
            u2();
            u3();
            u4();
            u5();
            u6();
            u7();
            u8();
            u9();
            u10();
        };
    }, []);

    // 1. Calculate past aggregates to get Opening Balance before fromDate
    const openingBalance = useMemo(() => {
        const pastSales = sales
            .filter(s => (s.date || parseDateStr(s.timestamp)) < fromDate)
            .reduce((sum, s) => sum + (s.grandTotal || 0), 0);

        const pastBuyerPayments = payments
            .filter(p => p.type === 'buyer' && (p.date || parseDateStr(p.timestamp)) < fromDate)
            .reduce((sum, p) => sum + (p.amount || 0) + (p.cashLess || 0), 0);

        const pastVendorPayments = payments
            .filter(p => p.type === 'vendor' && (p.date || parseDateStr(p.timestamp)) < fromDate)
            .reduce((sum, p) => sum + (p.amount || 0), 0);

        const pastFarmerPayments = payments
            .filter(p => p.type === 'farmer' && (p.date || parseDateStr(p.timestamp)) < fromDate)
            .reduce((sum, p) => sum + (p.amount || 0), 0);

        const pastPurchases = outsidePurchases
            .filter(p => (p.date || parseDateStr(p.timestamp)) < fromDate)
            .reduce((sum, p) => sum + (p.grandTotal || 0), 0);

        const pastIntakes = intakes
            .filter(p => (p.date || parseDateStr(p.timestamp)) < fromDate)
            .reduce((sum, p) => sum + (p.summary?.totalCost || 0), 0);

        const pastSalesmanCash = salesmanCash
            .filter(p => (p.date || parseDateStr(p.timestamp)) < fromDate)
            .reduce((sum, p) => sum + (p.openingCash || 0), 0);

        const pastSalesmanPurchases = salesmanPurchases
            .filter(p => (p.date || parseDateStr(p.timestamp)) < fromDate)
            .reduce((sum, p) => sum + (p.grandTotal || 0), 0);

        return (pastSales + pastBuyerPayments) - 
               (pastVendorPayments + pastPurchases + pastFarmerPayments + pastIntakes + pastSalesmanCash + pastSalesmanPurchases);
    }, [sales, payments, outsidePurchases, intakes, salesmanCash, salesmanPurchases, fromDate]);

    // 2. Map and filter items for selected range
    const statementItems = useMemo(() => {
        const rangeSales = sales
            .filter(s => {
                const d = s.date || parseDateStr(s.timestamp);
                return d >= fromDate && d <= toDate;
            })
            .map(s => {
                const buyer = buyers.find(b => b.id === s.buyerId);
                const name = buyer ? (lang === 'ta' ? (buyer.nameTa || buyer.name) : buyer.name) : (s.buyerName || 'Customer');
                return {
                    id: s.id,
                    date: s.date || parseDateStr(s.timestamp),
                    desc: lang === 'ta' ? `விற்பனை: ${name}` : `Sale: ${name}`,
                    ref: name,
                    type: 'SALE',
                    debit: 0,
                    credit: s.grandTotal || 0,
                    timestamp: s.timestamp
                };
            });

        const rangePayments = payments
            .filter(p => {
                const d = p.date || parseDateStr(p.timestamp);
                return d >= fromDate && d <= toDate;
            })
            .flatMap(p => {
                const items = [];
                if (p.type === 'buyer') {
                    const buyer = buyers.find(b => b.id === p.entityId);
                    const name = buyer ? (lang === 'ta' ? (buyer.nameTa || buyer.name) : buyer.name) : 'Customer';
                    if (p.amount > 0) {
                        items.push({
                            id: `${p.id}-pay`,
                            date: p.date || parseDateStr(p.timestamp),
                            desc: lang === 'ta' ? `வரவு பணம்: ${name}` : `Receipt: ${name}`,
                            ref: name,
                            type: 'COLLECTION',
                            debit: 0,
                            credit: p.amount || 0,
                            timestamp: p.timestamp
                        });
                    }
                    if (p.cashLess > 0) {
                        items.push({
                            id: `${p.id}-less`,
                            date: p.date || parseDateStr(p.timestamp),
                            desc: lang === 'ta' ? `தள்ளுபடி: ${name}` : `Discount: ${name}`,
                            ref: name,
                            type: 'DISCOUNT',
                            debit: 0,
                            credit: p.cashLess || 0,
                            timestamp: p.timestamp
                        });
                    }
                } else if (p.type === 'vendor') {
                    const vendor = vendors.find(v => v.id === p.entityId);
                    const name = vendor ? (lang === 'ta' ? (vendor.nameTa || vendor.name) : vendor.name) : 'Vendor';
                    items.push({
                        id: p.id,
                        date: p.date || parseDateStr(p.timestamp),
                        desc: lang === 'ta' ? `செலுத்திய பணம் (விற்பனையாளர்): ${name}` : `Paid to Vendor: ${name}`,
                        ref: name,
                        type: 'PAYMENT',
                        debit: p.amount || 0,
                        credit: 0,
                        timestamp: p.timestamp
                    });
                } else if (p.type === 'farmer') {
                    const farmer = farmers.find(f => f.id === p.entityId);
                    const name = farmer ? (lang === 'ta' ? (farmer.nameTa || farmer.name) : farmer.name) : 'Farmer';
                    items.push({
                        id: p.id,
                        date: p.date || parseDateStr(p.timestamp),
                        desc: lang === 'ta' ? `செலுத்திய பணம் (விவசாயி): ${name}` : `Paid to Farmer: ${name}`,
                        ref: name,
                        type: 'FARMER PAYMENT',
                        debit: p.amount || 0,
                        credit: 0,
                        timestamp: p.timestamp
                    });
                }
                return items;
            });

        const rangePurchases = outsidePurchases
            .filter(p => {
                const d = p.date || parseDateStr(p.timestamp);
                return d >= fromDate && d <= toDate;
            })
            .map(p => {
                const vendor = vendors.find(v => v.id === p.vendorId);
                const name = vendor ? (lang === 'ta' ? (vendor.nameTa || vendor.name) : vendor.name) : 'Vendor';
                return {
                    id: p.id,
                    date: p.date || parseDateStr(p.timestamp),
                    desc: lang === 'ta' ? `கொள்முதல்: ${name}` : `Purchase: ${name}`,
                    ref: name,
                    type: 'PURCHASE',
                    debit: p.grandTotal || 0,
                    credit: 0,
                    timestamp: p.timestamp
                };
            });

        const rangeIntakes = intakes
            .filter(p => {
                const d = p.date || parseDateStr(p.timestamp);
                return d >= fromDate && d <= toDate;
            })
            .map(p => {
                const farmer = farmers.find(f => f.id === p.farmerId);
                const name = farmer ? (lang === 'ta' ? (farmer.nameTa || farmer.name) : farmer.name) : (p.farmerName || 'Farmer');
                return {
                    id: p.id,
                    date: p.date || parseDateStr(p.timestamp),
                    desc: lang === 'ta' ? `விவசாயி கொள்முதல்: ${name}` : `Farmer Intake: ${name}`,
                    ref: name,
                    type: 'FARMER INTAKE',
                    debit: p.summary?.totalCost || 0,
                    credit: 0,
                    timestamp: p.timestamp
                };
            });

        const rangeSalesmanCash = salesmanCash
            .filter(p => {
                const d = p.date || parseDateStr(p.timestamp);
                return d >= fromDate && d <= toDate;
            })
            .map(p => {
                const salesman = salesmen.find(s => s.id === p.salesmanId);
                const name = salesman ? (lang === 'ta' ? (salesman.nameTa || salesman.name) : salesman.name) : (p.salesmanName || 'Staff');
                return {
                    id: p.id,
                    date: p.date || parseDateStr(p.timestamp),
                    desc: lang === 'ta' ? `பணியாளர் பணம் வழங்கியது: ${name}` : `Cash to Staff: ${name}`,
                    ref: name,
                    type: 'STAFF CASH',
                    debit: p.openingCash || 0,
                    credit: 0,
                    timestamp: p.timestamp
                };
            });

        const rangeSalesmanPurchases = salesmanPurchases
            .filter(p => {
                const d = p.date || parseDateStr(p.timestamp);
                return d >= fromDate && d <= toDate;
            })
            .map(p => {
                const salesman = salesmen.find(s => s.id === p.salesmanId);
                const name = salesman ? (lang === 'ta' ? (salesman.nameTa || salesman.name) : salesman.name) : (p.salesmanName || 'Staff');
                return {
                    id: p.id,
                    date: p.date || parseDateStr(p.timestamp),
                    desc: lang === 'ta' ? `பணியாளர் கொள்முதல்: ${name}` : `Staff Purchase: ${name}`,
                    ref: name,
                    type: 'STAFF PURCHASE',
                    debit: p.grandTotal || 0,
                    credit: 0,
                    timestamp: p.timestamp
                };
            });

        // Combine and sort chronologically
        const combined = [
            ...rangeSales, 
            ...rangePayments, 
            ...rangePurchases,
            ...rangeIntakes,
            ...rangeSalesmanCash,
            ...rangeSalesmanPurchases
        ];
        combined.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.id.localeCompare(b.id);
        });

        // Compute running balance
        let balance = openingBalance;
        return combined.map(item => {
            balance = balance - item.debit + item.credit;
            return {
                ...item,
                balance
            };
        });
    }, [sales, payments, outsidePurchases, intakes, salesmanCash, salesmanPurchases, buyers, vendors, farmers, salesmen, fromDate, toDate, lang, openingBalance]);

    // Totals for range
    const totals = useMemo(() => {
        const dr = statementItems.reduce((sum, item) => sum + item.debit, 0);
        const cr = statementItems.reduce((sum, item) => sum + item.credit, 0);
        const closing = openingBalance - dr + cr;
        return { debits: dr, credits: cr, closing };
    }, [statementItems, openingBalance]);

    const filteredStatementItems = useMemo(() => {
        if (!searchText.trim()) return statementItems;
        const q = searchText.toLowerCase();
        return statementItems.filter(item => 
            (item.desc || '').toLowerCase().includes(q) ||
            (item.ref || '').toLowerCase().includes(q) ||
            (item.type || '').toLowerCase().includes(q)
        );
    }, [statementItems, searchText]);

    const handlePrint = () => {
        const biz = tenantData || { name: 'S.V.M', motto: 'SRI RAMA JAYAM', type: 'Sri Valli Flower Merchant', address: 'B-7, Flower Market, Tindivanam.', phone1: '', phone2: '' };
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
            <head>
                <title>Account Statement - ${fromDate} to ${toDate}</title>
                <style>
                    @page { size: auto; margin: 0; }
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 15mm; line-height: 1.4; margin: 0; font-size: 11pt; color: #1e293b; }
                    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
                    .motto { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px; }
                    .shop-name { font-size: 26px; font-weight: 900; color: #1e1b4b; }
                    .shop-type { font-size: 13px; font-weight: 700; color: #4f46e5; text-transform: uppercase; }
                    .shop-addr { font-size: 11px; color: #64748b; }
                    .title { font-size: 18px; font-weight: 800; margin-top: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; }
                    .period { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 4px; }
                    
                    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; border: 1px solid #e2e8f0; padding: 15px; borderRadius: 12px; background: #f8fafc; }
                    .summary-card { display: flex; flex-direction: column; }
                    .summary-lbl { font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
                    .summary-val { font-size: 16px; font-weight: 800; color: #1e293b; margin-top: 2px; }

                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; font-size: 12px; }
                    th { background: #f1f5f9; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #475569; text-align: left; }
                    td { font-weight: 500; }
                    .amt { text-align: right; font-weight: 700; }
                    .dr-color { color: #dc2626; }
                    .cr-color { color: #16a34a; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="header">
                    <div class="motto">${biz.motto || ''}</div>
                    <div class="shop-name">${biz.name || 'S.V.M'}</div>
                    <div class="shop-type">${biz.type || ''}</div>
                    <div class="shop-addr">${biz.address || ''}</div>
                    <div style="font-size: 11px; margin-top: 4px; color: #64748b;">
                        ${biz.phone1 ? `CELL: ${biz.phone1}` : ''} ${biz.phone2 ? ` | CELL: ${biz.phone2}` : ''}
                    </div>
                    <div class="title">${lang === 'ta' ? 'தினசரி கணக்கு அறிக்கை' : 'Daily Account Statement'}</div>
                    <div class="period">${fromDate.split('-').reverse().join('/')} - ${toDate.split('-').reverse().join('/')}</div>
                </div>

                <div class="summary-grid">
                    <div class="summary-card">
                        <span class="summary-lbl">${lang === 'ta' ? 'துவக்க இருப்பு' : 'Opening Balance'}</span>
                        <span class="summary-val">${fmt(openingBalance)}</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-lbl">${lang === 'ta' ? 'வரவு தொகை (Cr)' : 'Total Credits (Cr)'}</span>
                        <span class="summary-val" style="color: #16a34a">+ ${fmt(totals.credits)}</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-lbl">${lang === 'ta' ? 'பற்று தொகை (Dr)' : 'Total Debits (Dr)'}</span>
                        <span class="summary-val" style="color: #dc2626">- ${fmt(totals.debits)}</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-lbl">${lang === 'ta' ? 'இறுதி இருப்பு' : 'Closing Balance'}</span>
                        <span class="summary-val" style="color: #4f46e5">${fmt(totals.closing)}</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 80px;">${lang === 'ta' ? 'தேதி' : 'Date'}</th>
                            <th>${lang === 'ta' ? 'விவரம்' : 'Particulars'}</th>
                            <th>${lang === 'ta' ? 'வகை' : 'Type'}</th>
                            <th class="amt" style="width: 100px;">${lang === 'ta' ? 'பற்று (Dr)' : 'Debit (Dr)'}</th>
                            <th class="amt" style="width: 100px;">${lang === 'ta' ? 'வரவு (Cr)' : 'Credit (Cr)'}</th>
                            <th class="amt" style="width: 110px;">${lang === 'ta' ? 'இருப்பு' : 'Balance'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredStatementItems.map(item => `
                            <tr>
                                <td>${item.date.split('-').reverse().join('/')}</td>
                                <td>${item.desc}</td>
                                <td><span style="font-size: 10px; font-weight:800; background:#f1f5f9; padding:2px 6px; borderRadius:4px;">${item.type}</span></td>
                                <td class="amt dr-color">${item.debit > 0 ? fmt(item.debit) : '---'}</td>
                                <td class="amt cr-color">${item.credit > 0 ? fmt(item.credit) : '---'}</td>
                                <td class="amt" style="color:#1e1b4b">${fmt(item.balance)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;
        printWindow.document.write(content);
        printWindow.document.close();
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const biz = tenantData || { name: 'S.V.M', motto: 'SRI RAMA JAYAM', type: 'Sri Valli Flower Merchant', address: 'B-7, Flower Market, Tindivanam.', phone1: '', phone2: '' };
        
        doc.setFontSize(10);
        doc.text(biz.motto || '', 105, 10, { align: 'center' });
        doc.setFontSize(18);
        doc.text(biz.name || 'S.V.M', 105, 18, { align: 'center' });
        doc.setFontSize(11);
        doc.text(biz.type || '', 105, 24, { align: 'center' });
        doc.setFontSize(9);
        doc.text(biz.address || '', 105, 29, { align: 'center' });
        const cellInfo = (biz.phone1 ? `CELL: ${biz.phone1}` : '') + (biz.phone2 ? ` | CELL: ${biz.phone2}` : '');
        doc.text(cellInfo, 105, 34, { align: 'center' });
        
        doc.setFontSize(14);
        doc.text(lang === 'ta' ? 'தினசரி கணக்கு அறிக்கை' : 'Daily Account Statement', 105, 44, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`${fromDate.split('-').reverse().join('/')} - ${toDate.split('-').reverse().join('/')}`, 105, 49, { align: 'center' });
        
        doc.setFontSize(9);
        doc.rect(14, 55, 182, 18);
        doc.text(`${lang === 'ta' ? 'துவக்க இருப்பு' : 'Opening Bal'}: ${fmt(openingBalance)}`, 20, 66);
        doc.text(`${lang === 'ta' ? 'வரவு (Cr)' : 'Total Cr'}: +${fmt(totals.credits)}`, 68, 66);
        doc.text(`${lang === 'ta' ? 'பற்று (Dr)' : 'Total Dr'}: -${fmt(totals.debits)}`, 114, 66);
        doc.text(`${lang === 'ta' ? 'இறுதி இருப்பு' : 'Closing Bal'}: ${fmt(totals.closing)}`, 160, 66);
        
        const headers = [
            lang === 'ta' ? 'தேதி' : 'Date',
            lang === 'ta' ? 'விவரம்' : 'Particulars',
            lang === 'ta' ? 'வகை' : 'Type',
            lang === 'ta' ? 'பற்று (Dr)' : 'Debit (Dr)',
            lang === 'ta' ? 'வரவு (Cr)' : 'Credit (Cr)',
            lang === 'ta' ? 'இருப்பு' : 'Balance'
        ];
        
        const rows = filteredStatementItems.map(item => [
            item.date.split('-').reverse().join('/'),
            item.desc,
            item.type,
            item.debit > 0 ? fmt(item.debit) : '---',
            item.credit > 0 ? fmt(item.credit) : '---',
            fmt(item.balance)
        ]);
        
        doc.autoTable({
            startY: 78,
            head: [headers],
            body: rows,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], halign: 'left' },
            columnStyles: {
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' }
            }
        });
        
        doc.save(`DailyStatement_${fromDate}_to_${toDate}.pdf`);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
            
            {/* Filter controls */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', background: '#fff', border: '1px solid #f1f5f9', padding: '20px 24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                    
                    {/* From Date */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={12} color="#6366f1" />
                            {lang === 'ta' ? 'தொடக்க தேதி' : 'From Date'}
                        </span>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={e => setFromDate(e.target.value)}
                            style={{ padding: '10px 14px', borderRadius: '12px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '13px', fontWeight: 700, color: '#334155' }}
                        />
                    </div>

                    {/* To Date */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={12} color="#6366f1" />
                            {lang === 'ta' ? 'முடிவு தேதி' : 'To Date'}
                        </span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={e => setToDate(e.target.value)}
                            style={{ padding: '10px 14px', borderRadius: '12px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '13px', fontWeight: 700, color: '#334155' }}
                        />
                    </div>

                    {/* Search Input Box */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Search size={12} color="#6366f1" />
                            {lang === 'ta' ? 'தேடல்' : 'Search Ledger'}
                        </span>
                        <input
                            type="text"
                            placeholder={lang === 'ta' ? 'விவரம், வகை...' : 'Search by name, type, details...'}
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            style={{ padding: '10px 14px', borderRadius: '12px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '13px', fontWeight: 700, color: '#334155' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleDownloadPDF}
                        style={{
                            padding: '12px 20px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            border: 'none', borderRadius: '14px', color: '#fff', fontSize: '12px', fontWeight: 800,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                            boxShadow: '0 4px 12px rgba(99,102,241,0.2)', transition: 'all 0.2s'
                        }}
                    >
                        <Download size={14} />
                        {lang === 'ta' ? 'பிடிஎஃப் பதிவிறக்கம்' : 'Download PDF'}
                    </button>
                    <button
                        onClick={handlePrint}
                        style={{
                            padding: '12px 20px', background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none', borderRadius: '14px', color: '#fff', fontSize: '12px', fontWeight: 800,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                            boxShadow: '0 4px 12px rgba(16,185,129,0.2)', transition: 'all 0.2s'
                        }}
                    >
                        <Printer size={14} />
                        {lang === 'ta' ? 'அச்சிடு' : 'Print'}
                    </button>
                </div>
            </div>

            {/* Summary Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', width: '100%' }}>
                {/* Opening Balance */}
                <div style={{ background: '#fff', border: '1px solid #f1f5f9', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {lang === 'ta' ? 'துவக்க இருப்பு' : 'Opening Balance'}
                    </span>
                    <h3 style={{ margin: '8px 0 0', fontSize: '20px', fontWeight: 900, color: '#1e293b' }}>
                        {fmt(openingBalance)}
                    </h3>
                </div>

                {/* Total Credits */}
                <div style={{ background: '#fff', border: '1px solid #f1f5f9', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {lang === 'ta' ? 'வரவு தொகை (Cr)' : 'Total Credits (Cr)'}
                    </span>
                    <h3 style={{ margin: '8px 0 0', fontSize: '20px', fontWeight: 900, color: '#10b981' }}>
                        + {fmt(totals.credits)}
                    </h3>
                </div>

                {/* Total Debits */}
                <div style={{ background: '#fff', border: '1px solid #f1f5f9', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {lang === 'ta' ? 'பற்று தொகை (Dr)' : 'Total Debits (Dr)'}
                    </span>
                    <h3 style={{ margin: '8px 0 0', fontSize: '20px', fontWeight: 900, color: '#ef4444' }}>
                        - {fmt(totals.debits)}
                    </h3>
                </div>

                {/* Closing Balance */}
                <div style={{ background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', border: '1px solid #ddd6fe', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(124,58,237,0.05)' }}>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {lang === 'ta' ? 'இறுதி இருப்பு' : 'Closing Balance'}
                    </span>
                    <h3 style={{ margin: '8px 0 0', fontSize: '20px', fontWeight: 900, color: '#4f46e5' }}>
                        {fmt(totals.closing)}
                    </h3>
                </div>
            </div>

            {/* Table Box Wrapper */}
            <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.02)', width: '100%', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #f1f5f9' }}>
                                    {lang === 'ta' ? 'தேதி' : 'Date'}
                                </th>
                                <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #f1f5f9' }}>
                                    {lang === 'ta' ? 'விவரம்' : 'Particulars'}
                                </th>
                                <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #f1f5f9' }}>
                                    {lang === 'ta' ? 'வகை' : 'Type'}
                                </th>
                                <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                                    {lang === 'ta' ? 'பற்று (Dr)' : 'Debit (Dr)'}
                                </th>
                                <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                                    {lang === 'ta' ? 'வரவு (Cr)' : 'Credit (Cr)'}
                                </th>
                                <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                                    {lang === 'ta' ? 'இருப்பு' : 'Balance'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStatementItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '48px 24px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>
                                        {lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட தேதியில் எந்த பரிவர்த்தனையும் இல்லை.' : 'No transactions recorded for the selected dates.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredStatementItems.map((item) => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                        <td style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                                            {item.date.split('-').reverse().join('/')}
                                        </td>
                                        <td style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                                            {item.desc}
                                        </td>
                                        <td style={{ padding: '16px 20px', fontSize: '12px' }}>
                                            <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 800, letterSpacing: '0.04em', background: '#f1f5f9', color: '#475569' }}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#dc2626', textAlign: 'right' }}>
                                            {item.debit > 0 ? fmt(item.debit) : '---'}
                                        </td>
                                        <td style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#16a34a', textAlign: 'right' }}>
                                            {item.credit > 0 ? fmt(item.credit) : '---'}
                                        </td>
                                        <td style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, color: '#0f172a', textAlign: 'right' }}>
                                            {fmt(item.balance)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DailyStatement;
