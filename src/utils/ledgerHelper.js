// Helper functions for ledger compilation

// Helper to format currency
export const fmtCurrency = (n) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);
};

// Helper to format date display: DD/MM/YYYY
export const displayDateStr = (isoDate) => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

// Parse Firestore timestamp or date safely to string YYYY-MM-DD
export const getTxnDateStr = (txn) => {
    if (txn.date) return txn.date.substring(0, 10);
    if (txn.timestamp) {
        const d = txn.timestamp.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        }
    }
    return '';
};

// Get transaction time HH:MM
export const getTxnTimeStr = (txn) => {
    if (txn.timestamp) {
        const d = txn.timestamp.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
        if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }
    }
    return '';
};

// Get sort value (millis) for a transaction
export const getTxnMillis = (txn) => {
    if (txn.timestamp) {
        const d = txn.timestamp.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
        if (!isNaN(d.getTime())) {
            return d.getTime();
        }
    }
    return 0;
};

// Extract rate, qty and name for flower items
export const getFlowerLabel = (item, products = [], lang = 'en') => {
    let name = item.flowerType || '';
    if (lang === 'ta') {
        const found = products.find(f => f.name?.trim().toLowerCase() === name.trim().toLowerCase());
        name = item.flowerTypeTa || found?.taName || name;
    }
    const qty = parseFloat(item.quantity || 0);
    const rate = parseFloat(item.price || item.rate || 0);
    
    const qtyLabel = lang === 'ta' ? `${qty} கிலோ` : `${qty} KG`;
    return `${name} (₹${rate} × ${qtyLabel})`;
};

/**
 * Compiles a detailed, chronological ledger for a specific entity.
 * Supports types: 'buyer' (customer), 'farmer', 'vendor', 'salesman' (staff)
 */
export const generateUniversalLedger = ({
    personId,
    personType,
    fromDate,
    toDate,
    personObj, // The master object from Firestore (to fetch opening/live balance)
    sales = [],
    purchases = [], // outside_purchases
    intakes = [],
    payments = [],
    expenses = [],
    transfers = [],
    cashRecords = [], // salesman_cash
    cashPurchases = [],
    cashSales = [],
    products = [],
    lang = 'en'
}) => {
    if (!personId) return [];

    const isTamil = lang === 'ta';
    const txnList = [];

    // Localized labels
    const LABELS = {
        cashRec: isTamil ? 'வரவு பணம்' : 'Cash Received',
        cashPaid: isTamil ? 'செலுத்திய பணம்' : 'Cash Paid',
        cashLess: isTamil ? 'சரிகட்டுதல்/தள்ளுபடி' : 'Discount / Cashless',
        expense: isTamil ? 'செலவு' : 'Expense',
        cashIssued: isTamil ? 'ஆரம்ப ரொக்கம் (வழங்கியது)' : 'Cash Issued to Staff',
        transferIn: isTamil ? 'பணியாளரிடமிருந்து வரவு' : 'Transfer Received',
        transferOut: isTamil ? 'பணியாளருக்கு மாற்றம்' : 'Transfer Sent',
        opening: isTamil ? 'ஆரம்ப இருப்பு' : 'Opening Balance',
        closing: isTamil ? 'முடிவு இருப்பு' : 'Closing Balance',
        purchase: isTamil ? 'கொள்முதல்' : 'Purchase',
        sale: isTamil ? 'விற்பனை' : 'Sale',
        other: isTamil ? 'இதர விவரம்' : 'Other'
    };

    // --- 1. Gather all transactions belonging to this person ---

    if (personType === 'buyer') {
        // Customer Ledger:
        // Debits (Right): Flower Sales
        // Credits (Left): Payments (amount + cashLess)
        
        sales.filter(s => s.buyerId === personId).forEach(s => {
            const date = getTxnDateStr(s);
            const time = getTxnTimeStr(s);
            const millis = getTxnMillis(s);
            
            // Add each flower item individually for detailed particulars as requested
            (s.items || []).forEach((item, idx) => {
                txnList.push({
                    id: `${s.id}-${idx}`,
                    date,
                    time,
                    millis,
                    type: 'DEBIT', // Sales are debits for customer
                    particulars: getFlowerLabel(item, products, lang),
                    amount: Number(item.total || 0),
                    rawTxn: s
                });
            });
        });

        payments.filter(p => p.entityId === personId && p.type === 'buyer').forEach(p => {
            const date = getTxnDateStr(p);
            const time = getTxnTimeStr(p);
            const millis = getTxnMillis(p);
            const remarkStr = p.note ? ` (${p.note})` : '';
            const methodStr = p.method ? ` - ${p.method}` : '';

            if (p.amount > 0) {
                txnList.push({
                    id: `${p.id}-amt`,
                    date,
                    time,
                    millis,
                    type: 'CREDIT', // Payments are credits for customer
                    particulars: `${LABELS.cashRec}${methodStr}${remarkStr}`,
                    amount: Number(p.amount || 0),
                    rawTxn: p
                });
            }
            if (p.cashLess > 0) {
                txnList.push({
                    id: `${p.id}-less`,
                    date,
                    time,
                    millis,
                    type: 'CREDIT',
                    particulars: `${LABELS.cashLess}${remarkStr}`,
                    amount: Number(p.cashLess || 0),
                    rawTxn: p
                });
            }
        });

    } else if (personType === 'vendor') {
        // Vendor Ledger:
        // Credits (Left): Flower Purchases
        // Debits (Right): Payments (amount)
        
        purchases.filter(p => p.vendorId === personId).forEach(p => {
            const date = getTxnDateStr(p);
            const time = getTxnTimeStr(p);
            const millis = getTxnMillis(p);
            
            (p.items || []).forEach((item, idx) => {
                txnList.push({
                    id: `${p.id}-${idx}`,
                    date,
                    time,
                    millis,
                    type: 'CREDIT', // Purchases are credits for vendor
                    particulars: getFlowerLabel(item, products, lang),
                    amount: Number(item.total || 0),
                    rawTxn: p
                });
            });
        });

        payments.filter(p => p.entityId === personId && p.type === 'vendor').forEach(p => {
            const date = getTxnDateStr(p);
            const time = getTxnTimeStr(p);
            const millis = getTxnMillis(p);
            const remarkStr = p.note ? ` (${p.note})` : '';
            const methodStr = p.method ? ` - ${p.method}` : '';

            txnList.push({
                id: p.id,
                date,
                time,
                millis,
                type: 'DEBIT', // Cash paid to vendor is debit
                particulars: `${LABELS.cashPaid}${methodStr}${remarkStr}`,
                amount: Number(p.amount || 0),
                rawTxn: p
            });
        });

    } else if (personType === 'farmer') {
        // Farmer Ledger:
        // Credits (Left): Flower Intakes (Purchases)
        // Debits (Right): Payments (amount)
        
        intakes.filter(i => i.farmerId === personId).forEach(intake => {
            const date = getTxnDateStr(intake);
            const time = getTxnTimeStr(intake);
            const millis = getTxnMillis(intake);
            
            (intake.items || []).forEach((item, idx) => {
                txnList.push({
                    id: `${intake.id}-${idx}`,
                    date,
                    time,
                    millis,
                    type: 'CREDIT', // Intakes are credits for farmer
                    particulars: getFlowerLabel(item, products, lang),
                    amount: Number(item.total || 0),
                    rawTxn: intake
                });
            });
        });

        payments.filter(p => p.entityId === personId && p.type === 'farmer').forEach(p => {
            const date = getTxnDateStr(p);
            const time = getTxnTimeStr(p);
            const millis = getTxnMillis(p);
            const remarkStr = p.note ? ` (${p.note})` : '';
            const methodStr = p.method ? ` - ${p.method}` : '';

            txnList.push({
                id: p.id,
                date,
                time,
                millis,
                type: 'DEBIT', // Cash paid to farmer is debit
                particulars: `${LABELS.cashPaid}${methodStr}${remarkStr}`,
                amount: Number(p.amount || 0),
                rawTxn: p
            });
        });

    } else if (personType === 'salesman') {
        // Staff Cash Box Ledger:
        // Credits (Left): Cash Inflows (issued cash, transfer in)
        // Debits (Right): Cash Outflows (purchases, expenses, transfer out, vendor payments)
        
        cashRecords.filter(c => c.salesmanId === personId).forEach(c => {
            const date = getTxnDateStr(c);
            const time = getTxnTimeStr(c);
            const millis = getTxnMillis(c);
            const remarkStr = c.notes ? ` (${c.notes})` : '';
            
            if (c.openingCash > 0) {
                txnList.push({
                    id: `${c.id}-issued`,
                    date,
                    time,
                    millis,
                    type: 'CREDIT',
                    particulars: `${LABELS.cashIssued}${remarkStr}`,
                    amount: Number(c.openingCash || 0),
                    rawTxn: c
                });
            }
        });

        // Transfers in and out
        transfers.forEach(t => {
            const date = getTxnDateStr(t);
            const time = getTxnTimeStr(t);
            const millis = getTxnMillis(t);
            const remarkStr = t.notes ? ` (${t.notes})` : '';

            if (t.toSalesmanId === personId) {
                txnList.push({
                    id: `${t.id}-in`,
                    date,
                    time,
                    millis,
                    type: 'CREDIT',
                    particulars: `${LABELS.transferIn}${remarkStr}`,
                    amount: Number(t.amount || 0),
                    rawTxn: t
                });
            }
            if (t.fromSalesmanId === personId) {
                txnList.push({
                    id: `${t.id}-out`,
                    date,
                    time,
                    millis,
                    type: 'DEBIT',
                    particulars: `${LABELS.transferOut}${remarkStr}`,
                    amount: Number(t.amount || 0),
                    rawTxn: t
                });
            }
        });

        // Expenses paid by salesman
        expenses.filter(e => e.salesmanId === personId).forEach(e => {
            const date = getTxnDateStr(e);
            const time = getTxnTimeStr(e);
            const millis = getTxnMillis(e);
            const remarkStr = e.remarks ? ` (${e.remarks})` : '';

            txnList.push({
                id: e.id,
                date,
                time,
                millis,
                type: 'DEBIT',
                particulars: `${LABELS.expense}: ${e.expenseType || ''}${remarkStr}`,
                amount: Number(e.amount || 0),
                rawTxn: e
            });
        });

        // Vendor Payments paid by salesman cash box
        payments.filter(p => p.salesmanId === personId && p.type === 'vendor').forEach(p => {
            const date = getTxnDateStr(p);
            const time = getTxnTimeStr(p);
            const millis = getTxnMillis(p);
            const remarkStr = p.note ? ` (${p.note})` : '';
            
            txnList.push({
                id: `${p.id}-vpay`,
                date,
                time,
                millis,
                type: 'DEBIT',
                particulars: `${LABELS.cashPaid} to Vendor${remarkStr}`,
                amount: Number(p.amount || 0),
                rawTxn: p
            });
        });

        // Purchases made by salesman cash box
        purchases.filter(p => p.salesmanId === personId).forEach(p => {
            const date = getTxnDateStr(p);
            const time = getTxnTimeStr(p);
            const millis = getTxnMillis(p);
            
            txnList.push({
                id: `${p.id}-spur`,
                date,
                time,
                millis,
                type: 'DEBIT',
                particulars: `${LABELS.purchase}: ${p.vendorName || 'Vendor'}`,
                amount: Number(p.grandTotal || 0),
                rawTxn: p
            });
        });

        // Cash Purchases (Spot Purchases) made by salesman cash box
        cashPurchases.filter(cp => cp.salesmanId === personId).forEach(cp => {
            const date = getTxnDateStr(cp);
            const time = getTxnTimeStr(cp);
            const millis = getTxnMillis(cp);
            
            if (cp.items && cp.items.length > 0) {
                cp.items.forEach((item, index) => {
                    const flower = isTamil ? (item.flowerTypeTa || item.flowerType) : (item.flowerType || item.flowerTypeTa || '');
                    txnList.push({
                        id: `${cp.id}-cashpur-${index}`,
                        date,
                        time,
                        millis,
                        type: 'DEBIT',
                        particulars: `${flower} (${item.quantity}*${item.price || item.rate})`,
                        amount: Number(item.total || 0),
                        rawTxn: cp
                    });
                });
            } else {
                txnList.push({
                    id: `${cp.id}-cashpur`,
                    date,
                    time,
                    millis,
                    type: 'DEBIT',
                    particulars: `${isTamil ? 'ரொக்கக் கொள்முதல்' : 'Cash Purchase'}: ${cp.vendorName || 'Vendor'}`,
                    amount: Number(cp.grandTotal || 0),
                    rawTxn: cp
                });
            }
        });

        // Cash Sales (Spot Sales) received into salesman cash box
        cashSales.filter(cs => cs.salesmanId === personId).forEach(cs => {
            const date = getTxnDateStr(cs);
            const time = getTxnTimeStr(cs);
            const millis = getTxnMillis(cs);
            
            if (cs.items && cs.items.length > 0) {
                cs.items.forEach((item, index) => {
                    const flower = isTamil ? (item.flowerTypeTa || item.flowerType) : (item.flowerType || item.flowerTypeTa || '');
                    txnList.push({
                        id: `${cs.id}-cashsale-${index}`,
                        date,
                        time,
                        millis,
                        type: 'CREDIT',
                        particulars: `${flower} (${item.quantity}*${item.price || item.rate})`,
                        amount: Number(item.total || 0),
                        rawTxn: cs
                    });
                });
            } else {
                txnList.push({
                    id: `${cs.id}-cashsale`,
                    date,
                    time,
                    millis,
                    type: 'CREDIT',
                    particulars: `${isTamil ? 'ரொக்க விற்பனை' : 'Cash Sale'}: ${cs.customerName || 'Customer'}`,
                    amount: Number(cs.grandTotal || 0),
                    rawTxn: cs
                });
            }
        });
    }

    // --- 2. Calculate Opening Balance at start date ---
    let openingBalance = 0;

    if (personType === 'salesman') {
        // Staff Ledger: Walk forward from the beginning of time
        const baseOpening = Number(personObj?.openingCash) || 0;
        const priorTxns = txnList.filter(t => t.date < fromDate);
        let calcBal = baseOpening;
        priorTxns.forEach(t => {
            if (t.type === 'CREDIT') calcBal += t.amount;
            else calcBal -= t.amount;
        });
        openingBalance = calcBal;
    } else {
        // Buyer, Vendor, Farmer: Walk backward from the current live balance
        const liveBalance = Number(personObj?.balance) || 0;
        const futureTxns = txnList.filter(t => t.date >= fromDate);
        
        let sumDebits = 0;
        let sumCredits = 0;
        futureTxns.forEach(t => {
            if (t.type === 'DEBIT') sumDebits += t.amount;
            else sumCredits += t.amount;
        });

        if (personType === 'buyer') {
            // Customer: live = base + Debit(Sales) - Credit(Payments)
            // So: base = live - Debit + Credit
            openingBalance = liveBalance - sumDebits + sumCredits;
        } else {
            // Farmer / Vendor: live = base + Credit(Purchases) - Debit(Payments)
            // So: base = live - Credit + Debit
            openingBalance = liveBalance - sumCredits + sumDebits;
        }
    }

    // --- 3. Process date range and generate segments ---

    // Filter to selected range and sort chronologically (oldest to newest within day)
    const rangeTxns = txnList.filter(t => t.date >= fromDate && t.date <= toDate);
    
    // Sort logic: first by date string, then by millis, then by ID to be deterministic
    rangeTxns.sort((a, b) => {
        const dCompare = a.date.localeCompare(b.date);
        if (dCompare !== 0) return dCompare;
        const mCompare = a.millis - b.millis;
        if (mCompare !== 0) return mCompare;
        return a.id.localeCompare(b.id);
    });

    // Get all unique dates in the range that have activity or are inside the range
    const activeDates = Array.from(new Set(rangeTxns.map(t => t.date))).sort();

    // Group transactions by date
    const dailyData = [];
    let carryForward = openingBalance;

    // Create segments for each active date
    activeDates.forEach(date => {
        const dayTxns = rangeTxns.filter(t => t.date === date);
        const dayOpening = carryForward;
        let currentBal = dayOpening;

        const rows = dayTxns.map(t => {
            let credit = null;
            let debit = null;

            if (t.type === 'CREDIT') {
                credit = { particulars: t.particulars, amount: t.amount };
                if (personType === 'buyer' || personType === 'salesman') {
                    // Customer: Credit reduces dues
                    // Staff: Credit (Inflow) increases cash
                    currentBal = personType === 'buyer' ? currentBal - t.amount : currentBal + t.amount;
                } else {
                    // Vendor/Farmer: Credit increases our dues to them
                    currentBal = currentBal + t.amount;
                }
            } else {
                debit = { particulars: t.particulars, amount: t.amount };
                if (personType === 'buyer' || personType === 'salesman') {
                    // Customer: Debit increases dues
                    // Staff: Debit (Outflow) reduces cash
                    currentBal = personType === 'buyer' ? currentBal + t.amount : currentBal - t.amount;
                } else {
                    // Vendor/Farmer: Debit decreases our dues to them
                    currentBal = currentBal - t.amount;
                }
            }

            return {
                id: t.id,
                time: t.time,
                credit,
                debit,
                runningBalance: currentBal
            };
        });

        const dayClosing = currentBal;
        carryForward = dayClosing;

        dailyData.push({
            date,
            openingBalance: dayOpening,
            rows,
            closingBalance: dayClosing
        });
    });

    return {
        openingBalance,
        dailyData,
        closingBalance: carryForward,
        labels: LABELS
    };
};
