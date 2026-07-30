import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Calendar, Layers, ShoppingCart, Tag, FileText, Download, Printer } from 'lucide-react';
import { subscribeToCollection } from '../utils/storage';
import { LangContext } from '../components/Layout';
import { useTenant } from '../utils/TenantContext';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

const fmt = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const toDateStr = (d) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

const getItemRate = (item) => {
    const qty = parseFloat(item.quantity || 0);
    const tot = parseFloat(item.total || item.totalPrice || 0);
    const rateVal = parseFloat(item.price || item.rate || 0);
    return rateVal || (qty > 0 ? tot / qty : 0);
};

const mergeListByNameAndRate = (list) => {
    const mergedMap = {};
    list.forEach(item => {
        const rateKey = parseFloat(item.rate || 0).toFixed(2);
        const key = `${item.name}_${rateKey}`;
        if (!mergedMap[key]) {
            mergedMap[key] = {
                ...item,
                quantity: 0,
                total: 0
            };
        }
        mergedMap[key].quantity += item.quantity;
        mergedMap[key].total += item.total;
    });
    return Object.values(mergedMap);
};

const FlowerWiseReport = () => {
    const { lang } = useContext(LangContext);
    const { tenantData } = useTenant();
    const [fromDate, setFromDate] = useState(toDateStr(new Date()));
    const [toDate, setToDate] = useState(toDateStr(new Date()));
    const [selectedFlower, setSelectedFlower] = useState('all');

    const [products, setProducts] = useState([]);
    const [intakes, setIntakes] = useState([]);
    const [outsidePurchases, setOutsidePurchases] = useState([]);
    const [sales, setSales] = useState([]);
    const [cashPurchases, setCashPurchases] = useState([]);
    const [cashSales, setCashSales] = useState([]);
    
    const [farmers, setFarmers] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [buyers, setBuyers] = useState([]);

    useEffect(() => {
        const u1 = subscribeToCollection('products', setProducts, true);
        const u2 = subscribeToCollection('intakes', setIntakes, true);
        const u3 = subscribeToCollection('outside_purchases', setOutsidePurchases, true);
        const u4 = subscribeToCollection('sales', setSales, true);
        const u5 = subscribeToCollection('farmers', setFarmers, true);
        const u6 = subscribeToCollection('vendors', setVendors, true);
        const u7 = subscribeToCollection('buyers', setBuyers, true);
        const u8 = subscribeToCollection('cash_purchases', setCashPurchases, true);
        const u9 = subscribeToCollection('cash_sales', setCashSales, true);

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
        };
    }, []);

    // Helper to match selected flower across English, Tamil, and Case differences
    const matchesFlower = useMemo(() => {
        if (selectedFlower === 'all' || selectedFlower === '') {
            return () => true;
        }
        const activeProd = products.find(p => p.name === selectedFlower);
        const nameEn = activeProd ? activeProd.name : selectedFlower;
        const nameTa = activeProd ? activeProd.taName : '';

        return (type) => {
            if (!type) return false;
            const t = type.trim().toLowerCase();
            const matchEn = nameEn && nameEn.trim().toLowerCase() === t;
            const matchTa = nameTa && nameTa.trim().toLowerCase() === t;
            return matchEn || matchTa;
        };
    }, [products, selectedFlower]);

    // Compute Purchase list (Farmers + Vendors) for selected date range and flower
    const purchaseData = useMemo(() => {
        const list = [];
        
        // 1. Farmer intakes
        intakes.forEach(intake => {
            const dateStr = (intake.date || '').substring(0, 10);
            if (dateStr >= fromDate && dateStr <= toDate) {
                (intake.items || []).forEach(item => {
                    if (matchesFlower(item.flowerType)) {
                        const farmer = farmers.find(f => f.id === intake.farmerId);
                        const name = farmer ? (lang === 'ta' ? (farmer.nameTa || farmer.name) : farmer.name) : (intake.farmerName || 'Farmer');
                        list.push({
                            name,
                            source: lang === 'ta' ? 'விவசாயி' : 'Farmer',
                            quantity: parseFloat(item.quantity || 0),
                            total: parseFloat(item.total || 0),
                            rate: getItemRate(item)
                        });
                    }
                });
            }
        });

        // 2. Outside shop purchases
        outsidePurchases.forEach(p => {
            const dateStr = (p.date || '').substring(0, 10);
            if (dateStr >= fromDate && dateStr <= toDate) {
                (p.items || []).forEach(item => {
                    if (matchesFlower(item.flowerType)) {
                        const vendor = vendors.find(v => v.id === p.vendorId);
                        const name = vendor ? (lang === 'ta' ? (vendor.nameTa || vendor.name) : vendor.name) : 'Vendor';
                        list.push({
                            name,
                            source: lang === 'ta' ? 'விற்பனையாளர்' : 'Vendor',
                            quantity: parseFloat(item.quantity || 0),
                            total: parseFloat(item.total || 0),
                            rate: getItemRate(item)
                        });
                    }
                });
            }
        });

        // 3. Cash Purchases
        cashPurchases.forEach(cp => {
            const dateStr = (cp.date || '').substring(0, 10);
            if (dateStr >= fromDate && dateStr <= toDate) {
                (cp.items || []).forEach(item => {
                    if (matchesFlower(item.flowerType)) {
                        const staffName = cp.salesmanName && cp.salesmanName !== 'Unknown'
                            ? cp.salesmanName
                            : (lang === 'ta' ? 'நேரடி உள்ளீடு' : 'Direct Entry');
                        list.push({
                            name: staffName,
                            source: staffName,
                            quantity: parseFloat(item.quantity || 0),
                            total: parseFloat(item.total || 0),
                            rate: getItemRate(item)
                        });
                    }
                });
            }
        });

        const mergedList = mergeListByNameAndRate(list);
        const totalKg = mergedList.reduce((sum, item) => sum + item.quantity, 0);
        const totalAmount = mergedList.reduce((sum, item) => sum + item.total, 0);

        return { list: mergedList, totalKg, totalAmount };
    }, [intakes, outsidePurchases, cashPurchases, farmers, vendors, fromDate, toDate, matchesFlower, lang]);

    // Compute Sales list (Customers) for selected date range and flower
    const salesData = useMemo(() => {
        const list = [];

        sales.forEach(s => {
            const dateStr = (s.date || '').substring(0, 10);
            if (dateStr >= fromDate && dateStr <= toDate) {
                (s.items || []).forEach(item => {
                    if (matchesFlower(item.flowerType)) {
                        const buyer = buyers.find(b => b.id === s.buyerId);
                        const name = buyer ? (lang === 'ta' ? (buyer.nameTa || buyer.name) : buyer.name) : (s.buyerName || 'Customer');
                        list.push({
                            name,
                            buyer,
                            quantity: parseFloat(item.quantity || 0),
                            total: parseFloat(item.total || item.totalPrice || 0),
                            rate: getItemRate(item)
                        });
                    }
                });
            }
        });

        // Cash Sales
        cashSales.forEach(cs => {
            const dateStr = (cs.date || '').substring(0, 10);
            if (dateStr >= fromDate && dateStr <= toDate) {
                (cs.items || []).forEach(item => {
                    if (matchesFlower(item.flowerType)) {
                        const staffName = cs.salesmanName && cs.salesmanName !== 'Unknown'
                            ? cs.salesmanName
                            : (lang === 'ta' ? 'நேரடி உள்ளீடு' : 'Direct Entry');
                        list.push({
                            name: staffName,
                            quantity: parseFloat(item.quantity || 0),
                            total: parseFloat(item.total || 0),
                            rate: getItemRate(item)
                        });
                    }
                });
            }
        });

        const mergedList = mergeListByNameAndRate(list);
        const totalKg = mergedList.reduce((sum, item) => sum + item.quantity, 0);
        const totalAmount = mergedList.reduce((sum, item) => sum + item.total, 0);

        return { list: mergedList, totalKg, totalAmount };
    }, [sales, cashSales, buyers, fromDate, toDate, matchesFlower, lang]);

    // Compute grouped flower-wise data when selectedFlower is 'all'
    const groupedFlowerData = useMemo(() => {
        if (selectedFlower !== 'all') return [];

        const groups = [];

        products.forEach(p => {
            const matcher = (type) => {
                if (!type) return false;
                const t = type.trim().toLowerCase();
                const matchEn = p.name && p.name.trim().toLowerCase() === t;
                const matchTa = p.taName && p.taName.trim().toLowerCase() === t;
                return matchEn || matchTa;
            };

            // Calculate purchases for this flower
            const pList = [];
            intakes.forEach(intake => {
                const dateStr = (intake.date || '').substring(0, 10);
                if (dateStr >= fromDate && dateStr <= toDate) {
                    (intake.items || []).forEach(item => {
                        if (matcher(item.flowerType)) {
                            const farmer = farmers.find(f => f.id === intake.farmerId);
                            const name = farmer ? (lang === 'ta' ? (farmer.nameTa || farmer.name) : farmer.name) : (intake.farmerName || 'Farmer');
                            pList.push({
                                name,
                                source: lang === 'ta' ? 'விவசாயி' : 'Farmer',
                                quantity: parseFloat(item.quantity || 0),
                                total: parseFloat(item.total || 0),
                                rate: getItemRate(item)
                            });
                        }
                    });
                }
            });

            outsidePurchases.forEach(op => {
                const dateStr = (op.date || '').substring(0, 10);
                if (dateStr >= fromDate && dateStr <= toDate) {
                    (op.items || []).forEach(item => {
                        if (matcher(item.flowerType)) {
                            const vendor = vendors.find(v => v.id === op.vendorId);
                            const name = vendor ? (lang === 'ta' ? (vendor.nameTa || vendor.name) : vendor.name) : 'Vendor';
                            pList.push({
                                name,
                                source: lang === 'ta' ? 'விற்பனையாளர்' : 'Vendor',
                                quantity: parseFloat(item.quantity || 0),
                                total: parseFloat(item.total || 0),
                                rate: getItemRate(item)
                            });
                        }
                    });
                }
            });

            cashPurchases.forEach(cp => {
                const dateStr = (cp.date || '').substring(0, 10);
                if (dateStr >= fromDate && dateStr <= toDate) {
                    (cp.items || []).forEach(item => {
                        if (matcher(item.flowerType)) {
                            const staffName = cp.salesmanName && cp.salesmanName !== 'Unknown'
                                ? cp.salesmanName
                                : (lang === 'ta' ? 'நேரடி உள்ளீடு' : 'Direct Entry');
                            pList.push({
                                name: staffName,
                                source: staffName,
                                quantity: parseFloat(item.quantity || 0),
                                total: parseFloat(item.total || 0),
                                rate: getItemRate(item)
                            });
                        }
                    });
                }
            });

            const mergedPList = mergeListByNameAndRate(pList);
            const pTotalKg = mergedPList.reduce((sum, item) => sum + item.quantity, 0);
            const pTotalAmount = mergedPList.reduce((sum, item) => sum + item.total, 0);

            // Calculate sales for this flower
            const sList = [];
            sales.forEach(s => {
                const dateStr = (s.date || '').substring(0, 10);
                if (dateStr >= fromDate && dateStr <= toDate) {
                    (s.items || []).forEach(item => {
                        if (matcher(item.flowerType)) {
                            const buyer = buyers.find(b => b.id === s.buyerId);
                            const name = buyer ? (lang === 'ta' ? (buyer.nameTa || buyer.name) : buyer.name) : (s.buyerName || 'Customer');
                            sList.push({
                                name,
                                buyer,
                                quantity: parseFloat(item.quantity || 0),
                                total: parseFloat(item.total || item.totalPrice || 0),
                                rate: getItemRate(item)
                            });
                        }
                    });
                }
            });

            cashSales.forEach(cs => {
                const dateStr = (cs.date || '').substring(0, 10);
                if (dateStr >= fromDate && dateStr <= toDate) {
                    (cs.items || []).forEach(item => {
                        if (matcher(item.flowerType)) {
                            const staffName = cs.salesmanName && cs.salesmanName !== 'Unknown'
                                ? cs.salesmanName
                                : (lang === 'ta' ? 'நேரடி உள்ளீடு' : 'Direct Entry');
                            sList.push({
                                name: staffName,
                                quantity: parseFloat(item.quantity || 0),
                                total: parseFloat(item.total || 0),
                                rate: getItemRate(item)
                            });
                        }
                    });
                }
            });

            const mergedSList = mergeListByNameAndRate(sList);
            const sTotalKg = mergedSList.reduce((sum, item) => sum + item.quantity, 0);
            const sTotalAmount = mergedSList.reduce((sum, item) => sum + item.total, 0);

            // Only add group if there is at least one transaction
            if (mergedPList.length > 0 || mergedSList.length > 0) {
                groups.push({
                    flowerName: p.name,
                    flowerTaName: p.taName || '',
                    purchases: { list: mergedPList, totalKg: pTotalKg, totalAmount: pTotalAmount },
                    sales: { list: mergedSList, totalKg: sTotalKg, totalAmount: sTotalAmount }
                });
            }
        });

        return groups;
    }, [products, intakes, outsidePurchases, cashPurchases, sales, cashSales, farmers, vendors, buyers, fromDate, toDate, lang]);

    const handlePrint = () => {
        try {
            const printWindow = window.open('', '_blank');
            const biz = tenantData || { name: 'S.V.M', motto: 'SRI RAMA JAYAM', type: 'Sri Valli Flower Merchant', address: 'B-7, Flower Market, Tindivanam.', phone1: '', phone2: '' };
            const formattedFrom = fromDate.split('-').reverse().join('/');
            const formattedTo = toDate.split('-').reverse().join('/');
            const title = lang === 'ta' ? 'பூக்கள் வாரியான அறிக்கை' : 'Flower Wise Report';
            const flowerText = `${lang === 'ta' ? 'பூ பெயர்' : 'Flower Name'}: ${selectedFlower === 'all' ? (lang === 'ta' ? 'அனைத்தும்' : 'All') : selectedFlower}`;
            const dateRangeText = `${formattedFrom} - ${formattedTo}`;
            
            let contentHtml = '';
            
            if (selectedFlower === 'all') {
                if (groupedFlowerData.length === 0) {
                    contentHtml = `<p style="text-align:center; font-style:italic; padding:40px; color:#94a3b8;">${lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட தேதிகளில் பரிவர்த்தனைகள் எதுவும் இல்லை' : 'No transactions found.'}</p>`;
                } else {
                    groupedFlowerData.forEach(group => {
                        const displayName = lang === 'ta' ? (group.flowerTaName || group.flowerName) : group.flowerName;
                        
                        let purchasesRows = '';
                        if (group.purchases.list.length === 0) {
                            purchasesRows = `<tr><td colspan="4" style="text-align:center; font-style:italic; padding:10px; color:#94a3b8;">${lang === 'ta' ? 'கொள்முதல் எதுவும் இல்லை' : 'No purchases.'}</td></tr>`;
                        } else {
                            purchasesRows = group.purchases.list.map((item, idx) => `
                                <tr>
                                    
                                    <td>${item.name}</td>
                                    <td>${item.source}</td>
                                    <td class="right">${item.quantity.toFixed(2)}</td>
                                    <td class="right">${fmt(item.rate)}</td>
                                    <td class="right">${fmt(item.total)}</td>
                                </tr>
                            `).join('');
                        }

                        let salesRows = '';
                        if (group.sales.list.length === 0) {
                            salesRows = `<tr><td colspan="4" style="text-align:center; font-style:italic; padding:10px; color:#94a3b8;">${lang === 'ta' ? 'விற்பனை எதுவும் இல்லை' : 'No sales.'}</td></tr>`;
                        } else {
                            salesRows = group.sales.list.map((item, idx) => `
                                <tr>
                                    
                                    <td>${formatNameForPrint(item, lang)}</td>
                                    <td class="right">${item.quantity.toFixed(2)}</td>
                                    <td class="right">${fmt(item.rate)}</td>
                                    <td class="right">${fmt(item.total)}</td>
                                </tr>
                            `).join('');
                        }

                        contentHtml += `
                            <div class="flower-group" style="margin-bottom:40px; border:1px solid #e2e8f0; padding:20px; border-radius:12px; page-break-inside:avoid; background:#fff; box-shadow: 0 4px 10px rgba(0,0,0,0.01);">
                                <h2 style="margin:0 0 15px 0; font-size:18px; border-bottom:2px solid #f1f5f9; padding-bottom:10px; color:#0f172a; display:flex; align-items:center; gap:8px;">🌸 ${displayName}</h2>
                                <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:space-between; margin-bottom:15px;">
                                    <!-- Purchases -->
                                    <div style="flex:1; min-width:300px;">
                                        <h3 style="margin:0 0 10px 0; font-size:11px; font-weight:800; color:#ef4444; text-transform:uppercase; letter-spacing:0.05em;">📥 Debit (Dr) / Purchase</h3>
                                        <table style="width:100%; border-collapse:collapse; font-size:11px;">
                                            <thead>
                                                <tr style="background:#f8fafc;">
                                                    
                                                    <th style="border-bottom:1.5px solid #e2e8f0; text-align:left; padding:8px; color:#475569;">Vendor/Farmer</th>
                                                    <th style="border-bottom:1.5px solid #e2e8f0; text-align:left; padding:8px; color:#475569;">Source</th>
                                                    <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">KG</th>
                                                    <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">Rate</th>
                                                    <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${purchasesRows}
                                            </tbody>
                                        </table>
                                    </div>
                                    <!-- Sales -->
                                    <div style="flex:1; min-width:300px;">
                                        <h3 style="margin:0 0 10px 0; font-size:11px; font-weight:800; color:#16a34a; text-transform:uppercase; letter-spacing:0.05em;">📤 Credit (Cr) / Sales</h3>
                                        <table style="width:100%; border-collapse:collapse; font-size:11px;">
                                            <thead>
                                                <tr style="background:#f8fafc;">
                                                    
                                                    <th style="border-bottom:1.5px solid #e2e8f0; text-align:left; padding:8px; color:#475569;">Customer</th>
                                                    <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">KG</th>
                                                    <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">Rate</th>
                                                    <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${salesRows}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <!-- Print Subtotal row aligned -->
                                <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:space-between; border-top:1px solid #ddd; padding-top:12px; margin-top:10px;">
                                    <div style="flex:1; min-width:300px; display:flex; justify-content:space-between; font-weight:bold; font-size:11px; background:#f9f9f9; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box;">
                                        <span>Total ${displayName} Purchase:</span>
                                        <span>${group.purchases.totalKg.toFixed(2)} KG | ${fmt(group.purchases.totalAmount)}</span>
                                    </div>
                                    <div style="flex:1; min-width:300px; display:flex; justify-content:space-between; font-weight:bold; font-size:11px; background:#f9f9f9; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box;">
                                        <span>Total ${displayName} Sales:</span>
                                        <span>${group.sales.totalKg.toFixed(2)} KG | ${fmt(group.sales.totalAmount)}</span>
                                    </div>
                                </div>
                                <!-- Print Net Balance Centered -->
                                <div style="display:flex; justify-content:center; margin-top:8px;">
                                    <div style="text-align:center; font-weight:bold; font-size:11px; padding:6px 16px; border:1px solid #ddd; border-radius:6px; background:#fafafa; display:inline-block; min-width:200px; box-sizing:border-box;">
                                        <span style="color:#64748b; font-size:9px; text-transform:uppercase; display:block; margin-bottom:2px;">Net Balance (Sales - Purchase)</span>
                                        <span style="color:${(group.sales.totalAmount - group.purchases.totalAmount) >= 0 ? '#16a34a' : '#ef4444'}; font-size:13px; font-weight:900; display:block; margin-bottom:2px;">
                                            ${(group.sales.totalAmount - group.purchases.totalAmount) >= 0 ? '+' : ''}${fmt(group.sales.totalAmount - group.purchases.totalAmount)}
                                        </span>
                                        <span style="color:${(group.sales.totalKg - group.purchases.totalKg) >= 0 ? '#16a34a' : '#ef4444'}; font-size:10px; display:block;">
                                            ${(group.sales.totalKg - group.purchases.totalKg) >= 0 ? '+' : ''}${(group.sales.totalKg - group.purchases.totalKg).toFixed(2)} KG
                                        </span>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                }
            } else {
                let purchasesRows = purchaseData.list.map((item, idx) => `
                    <tr>
                        
                        <td>${item.name}</td>
                        <td>${item.source}</td>
                        <td class="right">${item.quantity.toFixed(2)}</td>
                        <td class="right">${fmt(item.rate)}</td>
                        <td class="right">${fmt(item.total)}</td>
                    </tr>
                `).join('');
                if (purchaseData.list.length === 0) {
                    purchasesRows = `<tr><td colspan="4" style="text-align:center; font-style:italic; padding:10px; color:#94a3b8;">No records found.</td></tr>`;
                }

                let salesRows = salesData.list.map((item, idx) => `
                    <tr>
                        
                        <td>${formatNameForPrint(item, lang)}</td>
                        <td class="right">${item.quantity.toFixed(2)}</td>
                        <td class="right">${fmt(item.rate)}</td>
                        <td class="right">${fmt(item.total)}</td>
                    </tr>
                `).join('');
                if (salesData.list.length === 0) {
                    salesRows = `<tr><td colspan="4" style="text-align:center; font-style:italic; padding:10px; color:#94a3b8;">No records found.</td></tr>`;
                }

                contentHtml = `
                    <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:space-between;">
                        <!-- Purchases -->
                        <div style="flex:1; min-width:300px;">
                            <h3 style="margin:0 0 10px 0; font-size:11px; font-weight:800; color:#ef4444; text-transform:uppercase; letter-spacing:0.05em;">📥 Debit (Dr) / Purchase</h3>
                            <table style="width:100%; border-collapse:collapse; font-size:11px;">
                                <thead>
                                    <tr style="background:#f8fafc;">
                                        
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:left; padding:8px; color:#475569;">Vendor/Farmer</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:left; padding:8px; color:#475569;">Source</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">KG</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">Rate</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${purchasesRows}
                                </tbody>
                                <tfoot>
                                    <tr style="font-weight:bold; background:#f8fafc;">
                                        <td colspan="3" style="padding:8px; border-top:1.5px solid #e2e8f0; color:#1e293b;">Total:</td>
                                        <td style="text-align:right; padding:8px; border-top:1.5px solid #e2e8f0; color:#0f172a;">${purchaseData.totalKg.toFixed(2)}</td>
                                        <td style="border-top:1.5px solid #e2e8f0;"></td>
                                        <td style="text-align:right; padding:8px; border-top:1.5px solid #e2e8f0; color:#ef4444;">${fmt(purchaseData.totalAmount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <!-- Sales -->
                        <div style="flex:1; min-width:300px;">
                            <h3 style="margin:0 0 10px 0; font-size:11px; font-weight:800; color:#16a34a; text-transform:uppercase; letter-spacing:0.05em;">📤 Credit (Cr) / Sales</h3>
                            <table style="width:100%; border-collapse:collapse; font-size:11px;">
                                <thead>
                                    <tr style="background:#f8fafc;">
                                        
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:left; padding:8px; color:#475569;">Customer</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">KG</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">Rate</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${salesRows}
                                </tbody>
                                <tfoot>
                                    <tr style="font-weight:bold; background:#f8fafc;">
                                        <td colspan="2" style="padding:8px; border-top:1.5px solid #e2e8f0; color:#1e293b;">Total:</td>
                                        <td style="text-align:right; padding:8px; border-top:1.5px solid #e2e8f0; color:#0f172a;">${salesData.totalKg.toFixed(2)}</td>
                                        <td style="border-top:1.5px solid #e2e8f0;"></td>
                                        <td style="text-align:right; padding:8px; border-top:1.5px solid #e2e8f0; color:#16a34a;">${fmt(salesData.totalAmount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                `;
            }

            printWindow.document.write(`
                <html>
                    <head>
                        <title>${title}</title>
                        <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #334155; margin: 20px; line-height: 1.5; }
                            table { margin-bottom: 20px; width: 100%; border-collapse: collapse; }
                            th { font-weight: bold; background: #f8fafc; color: #475569; }
                            td, th { padding: 8px; border: 1px solid #e2e8f0; text-align: left; }
                            td.right, th.right { text-align: right; }
                            h1, h2, h3 { margin: 5px 0; }
                            .header { margin-bottom: 30px; text-align: center; }
                            .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; }
                            @media print {
                                .no-print { display: none; }
                                body { margin: 10mm; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h4 style="margin: 0; font-style: italic; color: #64748b; font-weight: normal;">${biz.motto || ''}</h4>
                            <h1 style="margin: 5px 0; font-size: 24px; color: #0f172a; font-weight: 800;">${biz.name || 'S.V.M'}</h1>
                            <h3 style="margin: 0; font-size: 13px; font-weight: bold; color: #475569;">${biz.type || ''}</h3>
                            <p style="margin: 2px 0; font-size: 11px; color: #64748b;">${biz.address || ''}</p>
                            <p style="margin: 2px 0; font-size: 11px; color: #64748b;">${(biz.phone1 ? `CELL: ${biz.phone1}` : '') + (biz.phone2 ? ` | CELL: ${biz.phone2}` : '')}</p>
                            <hr style="border: 0; border-top: 1.5px solid #cbd5e1; margin: 15px 0;" />
                            <h2 style="margin: 0; font-size: 18px; color: #0f172a;">${title}</h2>
                            <p style="margin: 5px 0; font-size: 13px; font-weight: bold; color: #1e293b;">${flowerText}</p>
                            <p style="margin: 2px 0; font-size: 12px; color: #64748b; font-weight: bold;">${dateRangeText}</p>
                        </div>
                        
                        <div class="content">
                            ${contentHtml}
                        </div>

                        <!-- Grand Summary -->
                        <div style="margin-top:30px; border-top:2px solid #0f172a; padding-top:15px; display:flex; justify-content:space-between; font-size:12px; font-weight:bold; color:#1e293b; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                            <div>Total Purchases: ${purchaseData.totalKg.toFixed(2)} KG | ${fmt(purchaseData.totalAmount)}</div>
                            <div>Total Sales: ${salesData.totalKg.toFixed(2)} KG | ${fmt(salesData.totalAmount)}</div>
                            <div>Net Balance: ${(salesData.totalAmount - purchaseData.totalAmount) >= 0 ? '+' : ''}${fmt(salesData.totalAmount - purchaseData.totalAmount)}</div>
                        </div>

                        <div class="footer">
                            Printed on ${new Date().toLocaleString()}
                        </div>
                        
                        <script>
                            window.onload = function() {
                                window.print();
                                window.close();
                            }
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        } catch (e) {
            alert('Printing failed: ' + e.message);
        }
    };

    const handlePrintSingleFlower = (group) => {
        try {
            const printWindow = window.open('', '_blank');
            const biz = tenantData || { name: 'S.V.M', motto: 'SRI RAMA JAYAM', type: 'Sri Valli Flower Merchant', address: 'B-7, Flower Market, Tindivanam.', phone1: '', phone2: '' };
            const formattedFrom = fromDate.split('-').reverse().join('/');
            const formattedTo = toDate.split('-').reverse().join('/');
            const title = lang === 'ta' ? 'பூக்கள் வாரியான அறிக்கை' : 'Flower Wise Report';
            const displayName = lang === 'ta' ? (group.flowerTaName || group.flowerName) : group.flowerName;
            const flowerText = `${lang === 'ta' ? 'பூ பெயர்' : 'Flower Name'}: ${displayName}`;
            const dateRangeText = `${formattedFrom} - ${formattedTo}`;

            let purchasesRows = '';
            if (group.purchases.list.length === 0) {
                purchasesRows = `<tr><td colspan="4" style="text-align:center; font-style:italic; padding:10px; color:#94a3b8;">${lang === 'ta' ? 'கொள்முதல் எதுவும் இல்லை' : 'No purchases.'}</td></tr>`;
            } else {
                purchasesRows = group.purchases.list.map((item, idx) => `
                    <tr>
                        
                        <td>${item.name}</td>
                        <td>${item.source}</td>
                        <td class="right">${item.quantity.toFixed(2)}</td>
                        <td class="right">${fmt(item.rate)}</td>
                        <td class="right">${fmt(item.total)}</td>
                    </tr>
                `).join('');
            }

            let salesRows = '';
            if (group.sales.list.length === 0) {
                salesRows = `<tr><td colspan="4" style="text-align:center; font-style:italic; padding:10px; color:#94a3b8;">${lang === 'ta' ? 'விற்பனை எதுவும் இல்லை' : 'No sales.'}</td></tr>`;
            } else {
                salesRows = group.sales.list.map((item, idx) => `
                    <tr>
                        
                        <td>${formatNameForPrint(item, lang)}</td>
                        <td class="right">${item.quantity.toFixed(2)}</td>
                        <td class="right">${fmt(item.rate)}</td>
                        <td class="right">${fmt(item.total)}</td>
                    </tr>
                `).join('');
            }

            const contentHtml = `
                <div class="flower-group" style="margin-bottom:40px; border:1px solid #e2e8f0; padding:20px; border-radius:12px; page-break-inside:avoid; background:#fff;">
                    <h2 style="margin:0 0 15px 0; font-size:18px; border-bottom:2px solid #f1f5f9; padding-bottom:10px; color:#0f172a; display:flex; align-items:center; gap:8px;">🌸 ${displayName}</h2>
                    <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:space-between; margin-bottom:15px;">
                        <!-- Purchases -->
                        <div style="flex:1; min-width:300px;">
                            <h3 style="margin:0 0 10px 0; font-size:11px; font-weight:800; color:#ef4444; text-transform:uppercase; letter-spacing:0.05em;">📥 Debit (Dr) / Purchase</h3>
                            <table style="width:100%; border-collapse:collapse; font-size:11px;">
                                <thead>
                                    <tr style="background:#f8fafc;">
                                        
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:left; padding:8px; color:#475569;">Vendor/Farmer</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:left; padding:8px; color:#475569;">Source</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">KG</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">Rate</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${purchasesRows}
                                </tbody>
                            </table>
                        </div>
                        <!-- Sales -->
                        <div style="flex:1; min-width:300px;">
                            <h3 style="margin:0 0 10px 0; font-size:11px; font-weight:800; color:#16a34a; text-transform:uppercase; letter-spacing:0.05em;">📤 Credit (Cr) / Sales</h3>
                            <table style="width:100%; border-collapse:collapse; font-size:11px;">
                                <thead>
                                    <tr style="background:#f8fafc;">
                                        
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:left; padding:8px; color:#475569;">Customer</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">KG</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">Rate</th>
                                        <th style="border-bottom:1.5px solid #e2e8f0; text-align:right; padding:8px; color:#475569;">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${salesRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <!-- Print Subtotal row aligned -->
                    <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:space-between; border-top:1px solid #ddd; padding-top:12px; margin-top:10px;">
                        <div style="flex:1; min-width:300px; display:flex; justify-content:space-between; font-weight:bold; font-size:11px; background:#f9f9f9; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box;">
                            <span>Total ${displayName} Purchase:</span>
                            <span>${group.purchases.totalKg.toFixed(2)} KG | ${fmt(group.purchases.totalAmount)}</span>
                        </div>
                        <div style="flex:1; min-width:300px; display:flex; justify-content:space-between; font-weight:bold; font-size:11px; background:#f9f9f9; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box;">
                            <span>Total ${displayName} Sales:</span>
                            <span>${group.sales.totalKg.toFixed(2)} KG | ${fmt(group.sales.totalAmount)}</span>
                        </div>
                    </div>
                    <!-- Print Net Balance Centered -->
                    <div style="display:flex; justify-content:center; margin-top:8px;">
                        <div style="text-align:center; font-weight:bold; font-size:11px; padding:6px 16px; border:1px solid #ddd; border-radius:6px; background:#fafafa; display:inline-block; min-width:200px; box-sizing:border-box;">
                            <span style="color:#64748b; font-size:9px; text-transform:uppercase; display:block; margin-bottom:2px;">Net Balance (Sales - Purchase)</span>
                            <span style="color:${(group.sales.totalAmount - group.purchases.totalAmount) >= 0 ? '#16a34a' : '#ef4444'}; font-size:13px; font-weight:900; display:block; margin-bottom:2px;">
                                ${(group.sales.totalAmount - group.purchases.totalAmount) >= 0 ? '+' : ''}${fmt(group.sales.totalAmount - group.purchases.totalAmount)}
                            </span>
                            <span style="color:${(group.sales.totalKg - group.purchases.totalKg) >= 0 ? '#16a34a' : '#ef4444'}; font-size:10px; display:block;">
                                ${(group.sales.totalKg - group.purchases.totalKg) >= 0 ? '+' : ''}${(group.sales.totalKg - group.purchases.totalKg).toFixed(2)} KG
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
                            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #334155; margin: 20px; line-height: 1.5; }
                            table { margin-bottom: 20px; width: 100%; border-collapse: collapse; }
                            th { font-weight: bold; background: #f8fafc; color: #475569; }
                            td, th { padding: 8px; border: 1px solid #e2e8f0; text-align: left; }
                            td.right, th.right { text-align: right; }
                            h1, h2, h3 { margin: 5px 0; }
                            .header { margin-bottom: 30px; text-align: center; }
                            .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; }
                            @media print {
                                .no-print { display: none; }
                                body { margin: 10mm; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h4 style="margin: 0; font-style: italic; color: #64748b; font-weight: normal;">${biz.motto || ''}</h4>
                            <h1 style="margin: 5px 0; font-size: 24px; color: #0f172a; font-weight: 800;">${biz.name || 'S.V.M'}</h1>
                            <h3 style="margin: 0; font-size: 13px; font-weight: bold; color: #475569;">${biz.type || ''}</h3>
                            <p style="margin: 2px 0; font-size: 11px; color: #64748b;">${biz.address || ''}</p>
                            <p style="margin: 2px 0; font-size: 11px; color: #64748b;">${(biz.phone1 ? `CELL: ${biz.phone1}` : '') + (biz.phone2 ? ` | CELL: ${biz.phone2}` : '')}</p>
                            <hr style="border: 0; border-top: 1.5px solid #cbd5e1; margin: 15px 0;" />
                            <h2 style="margin: 0; font-size: 18px; color: #0f172a;">${title}</h2>
                            <p style="margin: 5px 0; font-size: 13px; font-weight: bold; color: #1e293b;">${flowerText}</p>
                            <p style="margin: 2px 0; font-size: 12px; color: #64748b; font-weight: bold;">${dateRangeText}</p>
                        </div>
                        
                        <div class="content">
                            ${contentHtml}
                        </div>

                        <div class="footer">
                            Printed on ${new Date().toLocaleString()}
                        </div>
                        
                        <script>
                            window.onload = function() {
                                window.print();
                                window.close();
                            }
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        } catch (err) {
            alert('❌ Failed to print: ' + err.message);
        }
    };

    const handleDownloadPDF = () => {
        try {
            const doc = new jsPDF();
            const biz = tenantData || { name: 'S.V.M', motto: 'SRI RAMA JAYAM', type: 'Sri Valli Flower Merchant', address: 'B-7, Flower Market, Tindivanam.', phone1: '', phone2: '' };
            
            // Header
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
            doc.text(lang === 'ta' ? 'பூக்கள் வாரியான அறிக்கை' : 'Flower Wise Report', 105, 44, { align: 'center' });
            doc.setFontSize(11);
            doc.text(`${lang === 'ta' ? 'பூ பெயர்' : 'Flower Name'}: ${selectedFlower === 'all' ? (lang === 'ta' ? 'அனைத்தும்' : 'All') : selectedFlower}`, 105, 50, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`${fromDate.split('-').reverse().join('/')} - ${toDate.split('-').reverse().join('/')}`, 105, 55, { align: 'center' });
            
            let y = 65;

            if (selectedFlower === 'all') {
                if (groupedFlowerData.length === 0) {
                    doc.setFontSize(12);
                    doc.text(lang === 'ta' ? 'பரிவர்த்தனைகள் எதுவும் இல்லை' : 'No transactions found.', 105, y, { align: 'center' });
                } else {
                    groupedFlowerData.forEach((group) => {
                        // Check if we need a new page for the next flower header
                        if (y > 230) { doc.addPage(); y = 20; }
                        
                        doc.setFontSize(13);
                        doc.setFont('Helvetica', 'bold');
                        doc.text(`🌸 ${lang === 'ta' ? (group.flowerTaName || group.flowerName) : group.flowerName}`, 14, y);
                        y += 6;

                        // 1. Purchases for this flower
                        doc.setFontSize(10);
                        doc.text(lang === 'ta' ? 'பற்று (Dr) / கொள்முதல்' : 'Debit (Dr) / Purchase', 14, y);
                        y += 4;

                        doc.setFillColor(240, 240, 240);
                        doc.rect(14, y, 182, 7, 'F');
                        doc.setFontSize(8);
                        
                        doc.text(lang === 'ta' ? 'விற்பனையாளர்/விவசாயி' : 'Vendor/Farmer', 16, y + 4.5);
                        doc.text(lang === 'ta' ? 'வகை' : 'Source', 96, y + 4.5);
                        doc.text('KG', 132, y + 4.5, { align: 'right' });
                        doc.text(lang === 'ta' ? 'விலை' : 'Rate', 156, y + 4.5, { align: 'right' });
                        doc.text(lang === 'ta' ? 'பற்று (Dr)' : 'Debit (Dr)', 182, y + 4.5, { align: 'right' });
                        y += 7;
                        doc.setFont('Helvetica', 'normal');

                        if (group.purchases.list.length === 0) {
                            doc.text(lang === 'ta' ? 'கொள்முதல் எதுவும் இல்லை' : 'No purchases.', 16, y + 4.5);
                            y += 7;
                        } else {
                            group.purchases.list.forEach((item, idx) => {
                                if (y > 270) { doc.addPage(); y = 20; }
                                doc.line(14, y, 196, y);
                                
                                doc.text(item.name || '', 16, y + 4.5);
                                doc.text(item.source || '', 96, y + 4.5);
                                doc.text((item.quantity || 0).toFixed(2), 132, y + 4.5, { align: 'right' });
                                doc.text(fmt(item.rate), 156, y + 4.5, { align: 'right' });
                                doc.text(fmt(item.total), 182, y + 4.5, { align: 'right' });
                                y += 7;
                            });
                        }
                        
                        doc.line(14, y, 196, y);
                        doc.setFont('Helvetica', 'bold');
                        doc.text(lang === 'ta' ? `மொத்த கொள்முதல்:` : `Total ${group.flowerName} Purchase:`, 46, y + 4.5);
                        doc.text((group.purchases.totalKg || 0).toFixed(2), 132, y + 4.5, { align: 'right' });
                        doc.text(fmt(group.purchases.totalAmount), 182, y + 4.5, { align: 'right' });
                        doc.line(14, y + 7, 196, y + 7);
                        y += 12;

                        // 2. Sales for this flower
                        if (y > 230) { doc.addPage(); y = 20; }
                        doc.setFontSize(10);
                        doc.text(lang === 'ta' ? 'வரவு (Cr) / விற்பனை' : 'Credit (Cr) / Sales', 14, y);
                        y += 4;

                        doc.setFillColor(240, 240, 240);
                        doc.rect(14, y, 182, 7, 'F');
                        doc.setFontSize(8);
                        
                        doc.text(lang === 'ta' ? 'வாடிக்கையாளர்' : 'Customer Name', 16, y + 4.5);
                        doc.text('KG', 132, y + 4.5, { align: 'right' });
                        doc.text(lang === 'ta' ? 'விலை' : 'Rate', 156, y + 4.5, { align: 'right' });
                        doc.text(lang === 'ta' ? 'வரவு (Cr)' : 'Credit (Cr)', 182, y + 4.5, { align: 'right' });
                        y += 7;
                        doc.setFont('Helvetica', 'normal');

                        if (group.sales.list.length === 0) {
                            doc.text(lang === 'ta' ? 'விற்பனை எதுவும் இல்லை' : 'No sales.', 16, y + 4.5);
                            y += 7;
                        } else {
                            group.sales.list.forEach((item, idx) => {
                                if (y > 270) { doc.addPage(); y = 20; }
                                doc.line(14, y, 196, y);
                                
                                doc.text(item.name || '', 16, y + 4.5);
                                doc.text((item.quantity || 0).toFixed(2), 132, y + 4.5, { align: 'right' });
                                doc.text(fmt(item.rate), 156, y + 4.5, { align: 'right' });
                                doc.text(fmt(item.total), 182, y + 4.5, { align: 'right' });
                                y += 7;
                            });
                        }

                        doc.line(14, y, 196, y);
                        doc.setFont('Helvetica', 'bold');
                        doc.text(lang === 'ta' ? `மொத்த விற்பனை:` : `Total ${group.flowerName} Sales:`, 46, y + 4.5);
                        doc.text((group.sales.totalKg || 0).toFixed(2), 132, y + 4.5, { align: 'right' });
                        doc.text(fmt(group.sales.totalAmount), 182, y + 4.5, { align: 'right' });
                        doc.line(14, y + 7, 196, y + 7);
                        
                        y += 18; // Page/flower separator margin
                    });
                }
            } else {
                doc.setFontSize(12);
                doc.text(lang === 'ta' ? 'பற்று (Dr) / கொள்முதல்' : 'Debit (Dr) / Purchase', 14, y);
                y += 4;

                doc.setFillColor(240, 240, 240);
                doc.rect(14, y, 182, 8, 'F');
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(9);
                
                doc.text(lang === 'ta' ? 'விற்பனையாளர்/விவசாயி' : 'Vendor/Farmer', 16, y + 5.5);
                doc.text(lang === 'ta' ? 'வகை' : 'Source', 96, y + 5.5);
                doc.text('KG', 132, y + 5.5, { align: 'right' });
                doc.text(lang === 'ta' ? 'விலை' : 'Rate', 156, y + 5.5, { align: 'right' });
                doc.text(lang === 'ta' ? 'பற்று (Dr)' : 'Debit (Dr)', 182, y + 5.5, { align: 'right' });

                y += 8;
                doc.setFont('Helvetica', 'normal');

                purchaseData.list.forEach((item, idx) => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.line(14, y, 196, y);
                    
                    doc.text(item.name || '', 16, y + 5.5);
                    doc.text(item.source || '', 96, y + 5.5);
                    doc.text((item.quantity || 0).toFixed(2), 132, y + 5.5, { align: 'right' });
                    doc.text(fmt(item.rate), 156, y + 5.5, { align: 'right' });
                    doc.text(fmt(item.total), 182, y + 5.5, { align: 'right' });
                    y += 8;
                });

                // Total Row
                doc.line(14, y, 196, y);
                doc.setFont('Helvetica', 'bold');
                doc.text(lang === 'ta' ? 'மொத்தம்' : 'Total', 16, y + 5.5);
                doc.text((purchaseData.totalKg || 0).toFixed(2), 132, y + 5.5, { align: 'right' });
                doc.text(fmt(purchaseData.totalAmount), 182, y + 5.5, { align: 'right' });
                doc.line(14, y + 8, 196, y + 8);
                y += 18;

                if (y > 240) { doc.addPage(); y = 20; }

                // 2. Sales Table
                doc.setFontSize(12);
                doc.text(lang === 'ta' ? 'வரவு (Cr) / விற்பனை' : 'Credit (Cr) / Sales', 14, y);
                y += 4;

                doc.setFillColor(240, 240, 240);
                doc.rect(14, y, 182, 8, 'F');
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(9);
                
                doc.text(lang === 'ta' ? 'வாடிக்கையாளர்' : 'Customer Name', 16, y + 5.5);
                doc.text('KG', 132, y + 5.5, { align: 'right' });
                doc.text(lang === 'ta' ? 'விலை' : 'Rate', 156, y + 5.5, { align: 'right' });
                doc.text(lang === 'ta' ? 'வரவு (Cr)' : 'Credit (Cr)', 182, y + 5.5, { align: 'right' });

                y += 8;
                doc.setFont('Helvetica', 'normal');

                salesData.list.forEach((item, idx) => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.line(14, y, 196, y);
                    
                    doc.text(item.name || '', 16, y + 5.5);
                    doc.text((item.quantity || 0).toFixed(2), 132, y + 5.5, { align: 'right' });
                    doc.text(fmt(item.rate), 156, y + 5.5, { align: 'right' });
                    doc.text(fmt(item.total), 182, y + 5.5, { align: 'right' });
                    y += 8;
                });

                // Total Row
                doc.line(14, y, 196, y);
                doc.setFont('Helvetica', 'bold');
                doc.text(lang === 'ta' ? 'மொத்தம்' : 'Total', 16, y + 5.5);
                doc.text((salesData.totalKg || 0).toFixed(2), 132, y + 5.5, { align: 'right' });
                doc.text(fmt(salesData.totalAmount), 182, y + 5.5, { align: 'right' });
                doc.line(14, y + 8, 196, y + 8);
            }
            
            doc.save(`FlowerReport_${selectedFlower}_${Date.now()}.pdf`);
        } catch (e) {
            alert('PDF Generation failed: ' + e.message);
        }
    };

    const handleDownloadExcel = () => {
        try {
            const wb = XLSX.utils.book_new();

            if (selectedFlower === 'all') {
                const dataRows = [];
                dataRows.push(['FLOWER WISE REPORT']);
                dataRows.push(['From Date:', fromDate.split('-').reverse().join('/')]);
                dataRows.push(['To Date:', toDate.split('-').reverse().join('/')]);
                dataRows.push([]); // blank

                groupedFlowerData.forEach(group => {
                    const displayName = lang === 'ta' ? (group.flowerTaName || group.flowerName) : group.flowerName;
                    dataRows.push([`🌸 ${displayName.toUpperCase()}`]);
                    
                    dataRows.push(['Debit (Dr) / Purchase']);
                    dataRows.push(['Vendor/Farmer', 'Source', 'KG', 'Rate', 'Amount (INR)']);
                    if (group.purchases.list.length === 0) {
                        dataRows.push(['No purchases']);
                    } else {
                        group.purchases.list.forEach((item, idx) => {
                            dataRows.push([idx + 1, item.name, item.source, item.quantity, item.rate, item.total]);
                        });
                    }
                    dataRows.push([`Total ${group.flowerName} Purchase`, '', '', group.purchases.totalKg, '', group.purchases.totalAmount]);
                    dataRows.push([]); // spacer

                    dataRows.push(['Credit (Cr) / Sales']);
                    dataRows.push(['Customer', 'KG', 'Rate', 'Amount (INR)']);
                    if (group.sales.list.length === 0) {
                        dataRows.push(['No sales']);
                    } else {
                        group.sales.list.forEach((item, idx) => {
                            dataRows.push([idx + 1, item.name, item.quantity, item.rate, item.total]);
                        });
                    }
                    dataRows.push([`Total ${group.flowerName} Sales`, '', group.sales.totalKg, '', group.sales.totalAmount]);
                    dataRows.push([]); // spacer
                    dataRows.push(['====================================================']);
                    dataRows.push([]); // spacer
                });

                const ws = XLSX.utils.aoa_to_sheet(dataRows);
                XLSX.utils.book_append_sheet(wb, ws, 'Flower Wise Report');
            } else {
                // 1. Purchase Sheet
                const purchaseRows = purchaseData.list.map((item, idx) => ({
                    'Vendor/Farmer Name': item.name,
                    'Source (Farmer/Vendor)': item.source,
                    'Quantity (KG)': item.quantity,
                    'Rate': item.rate,
                    'Purchase Amount (INR)': item.total
                }));
                purchaseRows.push({
                    'Vendor/Farmer Name': '',
                    'Source (Farmer/Vendor)': '',
                    'Quantity (KG)': purchaseData.totalKg,
                    'Rate': '',
                    'Purchase Amount (INR)': purchaseData.totalAmount
                });
                const wsPurchase = XLSX.utils.json_to_sheet(purchaseRows);
                XLSX.utils.book_append_sheet(wb, wsPurchase, 'Purchases (Dr)');

                // 2. Sales Sheet
                const salesRows = salesData.list.map((item, idx) => ({
                    'Customer Name': item.name,
                    'Quantity (KG)': item.quantity,
                    'Rate': item.rate,
                    'Sales Amount (INR)': item.total
                }));
                salesRows.push({
                    'Customer Name': '',
                    'Quantity (KG)': salesData.totalKg,
                    'Rate': '',
                    'Sales Amount (INR)': salesData.totalAmount
                });
                const wsSales = XLSX.utils.json_to_sheet(salesRows);
                XLSX.utils.book_append_sheet(wb, wsSales, 'Sales (Cr)');
            }

            XLSX.writeFile(wb, `FlowerReport_${selectedFlower}_${Date.now()}.xlsx`);
        } catch (e) {
            alert('Excel Generation failed: ' + e.message);
        }
    };

    const TH_S = {
        padding: '7px 10px', textAlign: 'left',
        fontSize: '11px', fontWeight: 700, color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        borderBottom: '1.5px solid #e2e8f0', background: '#f8fafc'
    };

    const TD_S = {
        padding: '7px 10px', fontSize: '13px',
        color: '#334155', borderBottom: '1px solid #f1f5f9',
        fontWeight: 650
    };

    const formatNameForPrint = (item, lang) => {
        let displayName = item.name || '';
        let displayPlace = '';
        if (item.buyer) {
            const { name, nameTa, place, placeTa } = item.buyer;
            const rawName = lang === 'ta' ? (nameTa || name) : name;
            const rawPlace = lang === 'ta' ? (placeTa || place) : place;
            displayName = rawName || '';
            displayPlace = rawPlace || '';

            if (displayName.includes('[') && displayName.includes(']')) {
                const startIdx = displayName.indexOf('[');
                const endIdx = displayName.indexOf(']');
                if (endIdx > startIdx) {
                    const bracketContent = displayName.substring(startIdx + 1, endIdx).trim();
                    displayName = displayName.substring(0, startIdx).trim();
                    if (!displayPlace) displayPlace = bracketContent;
                }
            }

            if (displayPlace) {
                const cleanPlace = displayPlace.trim().toLowerCase();
                const cleanName = displayName.trim();
                if (cleanName.toLowerCase().endsWith(cleanPlace)) {
                    displayName = cleanName.substring(0, cleanName.length - cleanPlace.length).trim();
                }
            }
        } else {
            if (displayName.includes('[') && displayName.includes(']')) {
                const startIdx = displayName.indexOf('[');
                const endIdx = displayName.indexOf(']');
                if (endIdx > startIdx) {
                    displayPlace = displayName.substring(startIdx + 1, endIdx).trim();
                    displayName = displayName.substring(0, startIdx).trim();
                }
            }
        }

        if (displayPlace) {
            return `${displayName} <span style="font-size:10px; color:#64748b; font-weight:normal; margin-left:4px;">${displayPlace}</span>`;
        }
        return displayName;
    };

    const BuyerNameCell = ({ item }) => {
        let displayName = item.name || '';
        let displayPlace = '';

        if (item.buyer) {
            const { name, nameTa, place, placeTa } = item.buyer;
            const rawName = lang === 'ta' ? (nameTa || name) : name;
            const rawPlace = lang === 'ta' ? (placeTa || place) : place;

            displayName = rawName || '';
            displayPlace = rawPlace || '';

            // 1. Bracket Parsing: e.g. "karthi[chengalpattu]" -> Name: "karthi", Place: "chengalpattu"
            if (displayName.includes('[') && displayName.includes(']')) {
                const startIdx = displayName.indexOf('[');
                const endIdx = displayName.indexOf(']');
                if (endIdx > startIdx) {
                    const bracketContent = displayName.substring(startIdx + 1, endIdx).trim();
                    displayName = displayName.substring(0, startIdx).trim();
                    if (!displayPlace) {
                        displayPlace = bracketContent;
                    }
                }
            }

            // 2. Suffix Matching: e.g. "Chandru kottaipattinam" and place is "kottaipattinam"
            if (displayPlace) {
                const cleanPlace = displayPlace.trim().toLowerCase();
                const cleanName = displayName.trim();
                if (cleanName.toLowerCase().endsWith(cleanPlace)) {
                    displayName = cleanName.substring(0, cleanName.length - cleanPlace.length).trim();
                }
            }
        } else {
            // Fallback for raw string names
            // If the name string itself has brackets, e.g. "karthi[chengalpattu]"
            if (displayName.includes('[') && displayName.includes(']')) {
                const startIdx = displayName.indexOf('[');
                const endIdx = displayName.indexOf(']');
                if (endIdx > startIdx) {
                    displayPlace = displayName.substring(startIdx + 1, endIdx).trim();
                    displayName = displayName.substring(0, startIdx).trim();
                }
            }
        }

        return (
            <td style={TD_S}>
                <span>{displayName || '—'}</span>
                {displayPlace && (
                    <span style={{ 
                        fontSize: '11px', 
                        color: '#94a3b8', 
                        fontWeight: 500,
                        marginLeft: '6px'
                    }}>
                        {displayPlace}
                    </span>
                )}
            </td>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            
            {/* Filter Panel */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end', background: '#fff', border: '1px solid #f1f5f9', padding: '20px 24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                {/* From Date Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} color="#db2777" />
                        {lang === 'ta' ? 'தொடக்க தேதி' : 'From Date'}
                    </span>
                    <input
                        type="date"
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        style={{ padding: '10px 14px', borderRadius: '12px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '13px', fontWeight: 700, color: '#334155' }}
                    />
                </div>

                {/* To Date Filter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} color="#db2777" />
                        {lang === 'ta' ? 'முடிவு தேதி' : 'To Date'}
                    </span>
                    <input
                        type="date"
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                        style={{ padding: '10px 14px', borderRadius: '12px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '13px', fontWeight: 700, color: '#334155' }}
                    />
                </div>

                {/* Flower Dropdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Tag size={12} color="#db2777" />
                        {lang === 'ta' ? 'பூ பெயர்' : 'Flower Name'}
                    </span>
                    <select
                        value={selectedFlower}
                        onChange={e => setSelectedFlower(e.target.value)}
                        style={{ padding: '10px 14px', borderRadius: '12px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '13px', fontWeight: 700, color: '#334155', background: '#fff' }}
                    >
                        <option value="all">
                            {lang === 'ta' ? 'அனைத்தும்' : 'All'}
                        </option>
                        {products.map(p => (
                            <option key={p.name} value={p.name}>
                                {lang === 'ta' ? (p.taName || p.name) : p.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Download Actions */}
                <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', alignSelf: 'flex-end', height: '42px' }}>
                    <button
                        onClick={handlePrint}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #cbd5e1',
                            background: '#f8fafc', color: '#475569', fontSize: '13px', fontWeight: 800,
                            cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-sans)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                    >
                        <Printer size={15} color="#475569" />
                        {lang === 'ta' ? 'அச்சிடு' : 'Print'}
                    </button>
                </div>
            </div>

            {selectedFlower === 'all' ? (
                groupedFlowerData.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                        <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', fontStyle: 'italic', fontWeight: 600 }}>
                            {lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட தேதிகளில் பரிவர்த்தனைகள் எதுவும் இல்லை' : 'No transactions found for the selected date range.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
                        {groupedFlowerData.map((group) => {
                            const displayName = lang === 'ta' ? (group.flowerTaName || group.flowerName) : group.flowerName;
                            return (
                                <div 
                                    key={group.flowerName}
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
                                    {/* Flower Heading */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '24px' }}>🌸</span>
                                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                                                {displayName}
                                            </h2>
                                        </div>
                                        <button
                                            onClick={() => handlePrintSingleFlower(group)}
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

                                    {/* Two Columns Grid for Purchase and Sales */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '16px' }}>
                                        {/* Purchase Section */}
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                📥 {lang === 'ta' ? 'கொள்முதல் (Dr)' : 'Debit (Dr) / Purchase'}
                                            </h4>
                                            <div style={{ overflowX: 'auto', width: '100%' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr>
                                                        
                                                        <th style={{ ...TH_S, width: '120px' }}>{lang === 'ta' ? 'வழங்குநர்' : 'Vendor/Farmer'}</th>
                                                        <th style={{ ...TH_S, textAlign: 'right', width: '55px' }}>KG</th>
                                                        <th style={{ ...TH_S, textAlign: 'right', width: '65px' }}>{lang === 'ta' ? 'விலை' : 'Rate'}</th>
                                                        <th style={{ ...TH_S, textAlign: 'right', width: '80px' }}>Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.purchases.list.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                                                {lang === 'ta' ? 'கொள்முதல் எதுவும் இல்லை' : 'No purchases.'}
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        group.purchases.list.map((item, idx) => (
                                                            <tr key={idx}>
                                                                
                                                                <td style={TD_S}>
                                                                    <div>{item.name}</div>
                                                                    
                                                                </td>
                                                                <td style={{ ...TD_S, textAlign: 'right', color: '#0f172a' }}>{item.quantity.toFixed(2)}</td>
                                                                <td style={{ ...TD_S, textAlign: 'right', color: '#475569' }}>{fmt(item.rate)}</td>
                                                                <td style={{ ...TD_S, textAlign: 'right', color: '#ef4444' }}>{fmt(item.total)}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                            </div>
                                        </div>

                                        {/* Sales Section */}
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                📤 {lang === 'ta' ? 'விற்பனை (Cr)' : 'Credit (Cr) / Sales'}
                                            </h4>
                                            <div style={{ overflowX: 'auto', width: '100%' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr>
                                                        
                                                        <th style={{ ...TH_S, width: '120px' }}>{lang === 'ta' ? 'வாடிக்கையாளர்' : 'Customer'}</th>
                                                        <th style={{ ...TH_S, textAlign: 'right', width: '55px' }}>KG</th>
                                                        <th style={{ ...TH_S, textAlign: 'right', width: '65px' }}>{lang === 'ta' ? 'விலை' : 'Rate'}</th>
                                                        <th style={{ ...TH_S, textAlign: 'right', width: '80px' }}>Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.sales.list.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                                                {lang === 'ta' ? 'விற்பனை எதுவும் இல்லை' : 'No sales.'}
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        group.sales.list.map((item, idx) => (
                                                            <tr key={idx}>
                                                                
                                                                <BuyerNameCell item={item} />
                                                                <td style={{ ...TD_S, textAlign: 'right', color: '#0f172a' }}>{item.quantity.toFixed(2)}</td>
                                                                <td style={{ ...TD_S, textAlign: 'right', color: '#475569' }}>{fmt(item.rate)}</td>
                                                                <td style={{ ...TD_S, textAlign: 'right', color: '#16a34a' }}>{fmt(item.total)}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Aligned Subtotals Bar */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '16px', borderTop: '1.5px solid #f1f5f9', paddingTop: '10px', marginTop: '4px' }}>
                                        {/* Purchase subtotal */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '6px 12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 850, color: '#475569' }}>
                                                {lang === 'ta' ? `மொத்த கொள்முதல்:` : `Total Purchase:`}
                                            </span>
                                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '13px', fontWeight: 900 }}>
                                                <span style={{ color: '#0f172a' }}>{group.purchases.totalKg.toFixed(2)} KG</span>
                                                <span style={{ color: '#ef4444' }}>{fmt(group.purchases.totalAmount)}</span>
                                            </div>
                                        </div>

                                        {/* Sales subtotal */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '6px 12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 850, color: '#475569' }}>
                                                {lang === 'ta' ? `மொத்த விற்பனை:` : `Total Sales:`}
                                            </span>
                                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '13px', fontWeight: 900 }}>
                                                <span style={{ color: '#0f172a' }}>{group.sales.totalKg.toFixed(2)} KG</span>
                                                <span style={{ color: '#16a34a' }}>{fmt(group.sales.totalAmount)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Center Net Balance for this flower */}
                                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                                        <div style={{
                                            display: 'inline-flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            background: (group.sales.totalAmount - group.purchases.totalAmount) >= 0 ? '#f0fdf4' : '#fff5f5',
                                            border: (group.sales.totalAmount - group.purchases.totalAmount) >= 0 ? '1px solid #bbf7d0' : '1px solid #fecdd3',
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
                                                color: (group.sales.totalAmount - group.purchases.totalAmount) >= 0 ? '#16a34a' : '#ef4444',
                                                marginTop: '2px'
                                            }}>
                                                {(group.sales.totalAmount - group.purchases.totalAmount) >= 0 ? '+' : ''}
                                                {fmt(group.sales.totalAmount - group.purchases.totalAmount)}
                                            </div>
                                            <span style={{
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                color: (group.sales.totalKg - group.purchases.totalKg) >= 0 ? '#16a34a' : '#ef4444'
                                            }}>
                                                {(group.sales.totalKg - group.purchases.totalKg) >= 0 ? '+' : ''}
                                                {(group.sales.totalKg - group.purchases.totalKg).toFixed(2)} KG
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '16px', width: '100%' }}>
                    
                    {/* Left Panel: Purchase Summary (Debit / Dr) */}
                    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', borderBottom: '2px solid #f8fafc', paddingBottom: '8px' }}>
                            <div style={{ width: '36px', height: '36px', background: '#fdf2f8', border: '1.5px solid #fbcfe8', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>📥</div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#1e293b' }}>
                                    {lang === 'ta' ? 'பற்று (Dr) / கொள்முதல்' : 'Debit (Dr) / Purchase'}
                                </h3>
                                <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                                    {lang === 'ta' ? 'விவசாயி & விற்பனையாளர்கள்' : 'Farmers & Vendors'}
                                </p>
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        
                                        <th style={{ ...TH_S, width: '120px' }}>{lang === 'ta' ? 'வழங்குநர்' : 'Vendor/Farmer'}</th>
                                        <th style={{ ...TH_S, textAlign: 'right', width: '55px' }}>KG</th>
                                        <th style={{ ...TH_S, textAlign: 'right', width: '65px' }}>{lang === 'ta' ? 'விலை' : 'Rate'}</th>
                                        <th style={{ ...TH_S, textAlign: 'right', width: '80px' }}>{lang === 'ta' ? 'பற்று (Dr)' : 'Debit (Dr)'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {purchaseData.list.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                                {lang === 'ta' ? 'பரிவர்த்தனைகள் எதுவும் இல்லை' : 'No records found.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        purchaseData.list.map((item, idx) => (
                                            <tr key={idx}>
                                                
                                                <td style={TD_S}>
                                                    <div>{item.name}</div>
                                                    
                                                </td>
                                                <td style={{ ...TD_S, textAlign: 'right', color: '#0f172a' }}>{item.quantity.toFixed(2)}</td>
                                                <td style={{ ...TD_S, textAlign: 'right', color: '#475569' }}>{fmt(item.rate)}</td>
                                                <td style={{ ...TD_S, textAlign: 'right', color: '#ef4444' }}>{fmt(item.total)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {purchaseData.list.length > 0 && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 'auto' }}>
                                    <tfoot>
                                        <tr style={{ background: '#f8fafc', fontWeight: 850 }}>
                                            <td style={{ ...TD_S, color: '#1e293b', borderTop: '2px solid #e2e8f0' }}>{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                                            <td style={{ ...TD_S, textAlign: 'right', color: '#0f172a', borderTop: '2px solid #e2e8f0', width: '55px' }}>{purchaseData.totalKg.toFixed(2)}</td>
                                            <td style={{ ...TD_S, borderTop: '2px solid #e2e8f0', width: '65px' }}></td>
                                            <td style={{ ...TD_S, textAlign: 'right', color: '#ef4444', borderTop: '2px solid #e2e8f0', width: '80px' }}>{fmt(purchaseData.totalAmount)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>
                    </div>
 
                    {/* Right Panel: Sales Summary (Credit / Cr) */}
                    <div style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', borderBottom: '2px solid #f8fafc', paddingBottom: '8px' }}>
                            <div style={{ width: '36px', height: '36px', background: '#fdf2f8', border: '1.5px solid #fbcfe8', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>📤</div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#1e293b' }}>
                                     {lang === 'ta' ? 'வரவு (Cr) / விற்பனை' : 'Credit (Cr) / Sales'}
                                </h3>
                                <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                                    {lang === 'ta' ? 'வாடிக்கையாளர்கள்' : 'Customers'}
                                </p>
                            </div>
                        </div>
 
                        <div style={{ overflowX: 'auto', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        
                                        <th style={{ ...TH_S, width: '120px' }}>{lang === 'ta' ? 'வாடிக்கையாளர்' : 'Customer'}</th>
                                        <th style={{ ...TH_S, textAlign: 'right', width: '55px' }}>KG</th>
                                        <th style={{ ...TH_S, textAlign: 'right', width: '65px' }}>{lang === 'ta' ? 'விலை' : 'Rate'}</th>
                                        <th style={{ ...TH_S, textAlign: 'right', width: '80px' }}>{lang === 'ta' ? 'வரவு (Cr)' : 'Credit (Cr)'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salesData.list.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                                {lang === 'ta' ? 'பரிவர்த்தனைகள் எதுவும் இல்லை' : 'No records found.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        salesData.list.map((item, idx) => (
                                            <tr key={idx}>
                                                
                                                <BuyerNameCell item={item} />
                                                <td style={{ ...TD_S, textAlign: 'right', color: '#0f172a' }}>{item.quantity.toFixed(2)}</td>
                                                <td style={{ ...TD_S, textAlign: 'right', color: '#475569' }}>{fmt(item.rate)}</td>
                                                <td style={{ ...TD_S, textAlign: 'right', color: '#16a34a' }}>{fmt(item.total)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {salesData.list.length > 0 && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 'auto' }}>
                                    <tfoot>
                                        <tr style={{ background: '#f8fafc', fontWeight: 850 }}>
                                            <td style={{ ...TD_S, color: '#1e293b', borderTop: '2px solid #e2e8f0' }}>{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                                            <td style={{ ...TD_S, textAlign: 'right', color: '#0f172a', borderTop: '2px solid #e2e8f0', width: '55px' }}>{salesData.totalKg.toFixed(2)}</td>
                                            <td style={{ ...TD_S, borderTop: '2px solid #e2e8f0', width: '65px' }}></td>
                                            <td style={{ ...TD_S, textAlign: 'right', color: '#16a34a', borderTop: '2px solid #e2e8f0', width: '80px' }}>{fmt(salesData.totalAmount)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>
                    </div>

                </div>
            )}

            {/* Grand Total Summary Box */}
            <div style={{
                background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                border: '1.5px solid #e2e8f0',
                borderRadius: '16px',
                padding: '14px 20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px',
                marginTop: '8px'
            }}>
                {/* Column 1: Purchases */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {lang === 'ta' ? 'மொத்த கொள்முதல் (பற்று)' : 'Total Purchases (Debit)'}
                    </span>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#ef4444' }}>
                        {fmt(purchaseData.totalAmount)}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                        {purchaseData.totalKg.toFixed(2)} KG
                    </span>
                </div>

                {/* Column 2: Sales */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {lang === 'ta' ? 'மொத்த விற்பனை (வரவு)' : 'Total Sales (Credit)'}
                    </span>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#16a34a' }}>
                        {fmt(salesData.totalAmount)}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                        {salesData.totalKg.toFixed(2)} KG
                    </span>
                </div>

                {/* Column 3: Net Difference */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '1.5px solid #cbd5e1', paddingLeft: '16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {lang === 'ta' ? 'நிகர மதிப்பு (விற்பனை - கொள்முதல்)' : 'Net Balance (Sales - Purchase)'}
                    </span>
                    <div style={{
                        fontSize: '22px',
                        fontWeight: 950,
                        color: (salesData.totalAmount - purchaseData.totalAmount) >= 0 ? '#10b981' : '#ef4444'
                    }}>
                        {(salesData.totalAmount - purchaseData.totalAmount) >= 0 ? '+' : ''}
                        {fmt(salesData.totalAmount - purchaseData.totalAmount)}
                    </div>
                    <span style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: (salesData.totalKg - purchaseData.totalKg) >= 0 ? '#10b981' : '#ef4444'
                    }}>
                        {(salesData.totalKg - purchaseData.totalKg) >= 0 ? '+' : ''}
                        {(salesData.totalKg - purchaseData.totalKg).toFixed(2)} KG
                    </span>
                    
                    {/* Flower Wise Net Balance Breakdown */}
                    {selectedFlower === 'all' && products.length > 0 && (
                        <div style={{ marginTop: '8px', borderTop: '1px solid #cbd5e1', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                            {products.map(p => {
                                const group = groupedFlowerData.find(g => g.flowerName === p.name);
                                const diffAmount = group ? (group.sales.totalAmount - group.purchases.totalAmount) : 0;
                                const diffKg = group ? (group.sales.totalKg - group.purchases.totalKg) : 0;
                                const flowerDisp = lang === 'ta' ? (p.taName || p.name) : p.name;
                                const amtColor = diffAmount > 0 ? '#10b981' : diffAmount < 0 ? '#ef4444' : '#64748b';
                                const kgColor = diffKg > 0 ? '#10b981' : diffKg < 0 ? '#ef4444' : '#64748b';
                                return (
                                    <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 700 }}>
                                        <span style={{ color: '#475569' }}>🌸 {flowerDisp}:</span>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <span style={{ color: kgColor }}>
                                                {diffKg > 0 ? '+' : ''}{diffKg.toFixed(2)} kg
                                            </span>
                                            <span style={{ color: amtColor, fontWeight: 800 }}>
                                                ({diffAmount > 0 ? '+' : ''}{fmt(diffAmount)})
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FlowerWiseReport;
