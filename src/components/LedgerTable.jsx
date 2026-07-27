import React from 'react';
import { displayDateStr, fmtCurrency } from '../utils/ledgerHelper';

const LedgerTable = ({ ledgerData, personType, lang = 'en' }) => {
    const { dailyData = [], openingBalance = 0, labels = {} } = ledgerData || {};
    const isTamil = lang === 'ta';

    // Theme color mappings based on entity type to match existing styling
    const colors = {
        buyer: { primary: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' }, // green
        vendor: { primary: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' }, // blue
        farmer: { primary: '#ea580c', bg: '#fff7ed', border: '#ffedd5', text: '#c2410c' }, // orange/orange
        salesman: { primary: '#d97706', bg: '#fffbeb', border: '#fef3c7', text: '#b45309' }, // amber
    }[personType] || { primary: '#6366f1', bg: '#f5f3ff', border: '#ddd6fe', text: '#4338ca' };

    if (!dailyData || dailyData.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '14px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                {isTamil ? 'இந்த காலகட்டத்தில் பரிவர்த்தனைகள் எதுவும் இல்லை.' : 'No ledger entries found for the selected parameters.'}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-sans)', width: '100%' }}>
            
            {/* Global Statement Period Summary */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px 20px', 
                background: '#f8fafc', 
                borderRadius: '12px', 
                border: '1px solid #e2e8f0',
                fontSize: '13px'
            }}>
                <span style={{ fontWeight: 700, color: '#475569' }}>
                    {isTamil ? 'தொடக்க இருப்பு:' : 'Period Opening Balance:'}
                </span>
                <span style={{ 
                    fontWeight: 900, 
                    fontSize: '15px',
                    color: openingBalance >= 0 ? '#1e293b' : '#dc2626' 
                }}>
                    {fmtCurrency(openingBalance)}
                </span>
            </div>

            {/* Daily Ledger Blocks */}
            {dailyData.map((day, dIdx) => (
                <div 
                    key={day.date} 
                    style={{ 
                        background: '#ffffff', 
                        borderRadius: '16px', 
                        border: `1.5px solid ${colors.border}`, 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                        overflow: 'hidden'
                    }}
                >
                    {/* Date Header */}
                    <div style={{ 
                        padding: '12px 20px', 
                        background: colors.bg, 
                        borderBottom: `1px solid ${colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '16px' }}>📅</span>
                            <span style={{ fontWeight: 800, color: colors.text, fontSize: '14px' }}>
                                {displayDateStr(day.date)}
                            </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', fontWeight: 700 }}>
                            {isTamil ? 'அன்றைய ஆரம்ப இருப்பு:' : 'Day Opening:'} 
                            <span style={{ marginLeft: '6px', color: '#1e293b', fontWeight: 800 }}>
                                {fmtCurrency(day.openingBalance)}
                            </span>
                        </div>
                    </div>

                    {/* Transaction Table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 700, width: '70px' }}>
                                        {isTamil ? 'நேரம்' : 'Time'}
                                    </th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#16a34a', fontWeight: 800, borderRight: '1px dashed #e2e8f0' }}>
                                        {isTamil ? 'வரவு (Credit)' : 'Credit (Inflow / Receipts)'}
                                    </th>
                                    <th style={{ padding: '8px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 800, width: '110px', borderRight: '1.5px solid #cbd5e1' }}>
                                        {isTamil ? 'தொகை' : 'Amount'}
                                    </th>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#dc2626', fontWeight: 800 }}>
                                        {isTamil ? 'பற்று (Debit)' : 'Debit (Outflow / Expenses)'}
                                    </th>
                                    <th style={{ padding: '8px 12px', textAlign: 'right', color: '#dc2626', fontWeight: 800, width: '110px', borderRight: '1.5px solid #cbd5e1' }}>
                                        {isTamil ? 'தொகை' : 'Amount'}
                                    </th>
                                    <th style={{ padding: '8px 12px', textAlign: 'right', color: '#475569', fontWeight: 800, width: '130px', background: '#fafafa' }}>
                                        {isTamil ? 'மீதி இருப்பு' : 'Running Balance'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {day.rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                            {isTamil ? 'பரிவர்த்தனைகள் எதுவும் இல்லை' : 'No transactions recorded on this day'}
                                        </td>
                                    </tr>
                                ) : (
                                    day.rows.map((row, rIdx) => (
                                        <tr 
                                            key={row.id} 
                                            style={{ 
                                                borderBottom: rIdx < day.rows.length - 1 ? '1px solid #f1f5f9' : 'none',
                                                background: rIdx % 2 === 0 ? '#ffffff' : '#fcfcfc',
                                            }}
                                            className="hover-row"
                                        >
                                            {/* Time */}
                                            <td style={{ padding: '10px 12px', color: '#64748b', fontWeight: 500 }}>
                                                {row.time || '—'}
                                            </td>

                                            {/* Credit Side */}
                                            <td style={{ 
                                                padding: '10px 12px', 
                                                color: '#334155', 
                                                fontWeight: row.credit ? 600 : 400,
                                                borderRight: '1px dashed #e2e8f0',
                                                opacity: row.credit ? 1 : 0.4
                                            }}>
                                                {row.credit ? row.credit.particulars : '—'}
                                            </td>
                                            <td style={{ 
                                                padding: '10px 12px', 
                                                textAlign: 'right', 
                                                fontWeight: 700, 
                                                color: '#16a34a',
                                                borderRight: '1.5px solid #cbd5e1',
                                                opacity: row.credit ? 1 : 0.4
                                            }}>
                                                {row.credit ? fmtCurrency(row.credit.amount) : '—'}
                                            </td>

                                            {/* Debit Side */}
                                            <td style={{ 
                                                padding: '10px 12px', 
                                                color: '#334155', 
                                                fontWeight: row.debit ? 600 : 400,
                                                opacity: row.debit ? 1 : 0.4
                                            }}>
                                                {row.debit ? row.debit.particulars : '—'}
                                            </td>
                                            <td style={{ 
                                                padding: '10px 12px', 
                                                textAlign: 'right', 
                                                fontWeight: 700, 
                                                color: '#dc2626',
                                                borderRight: '1.5px solid #cbd5e1',
                                                opacity: row.debit ? 1 : 0.4
                                            }}>
                                                {row.debit ? fmtCurrency(row.debit.amount) : '—'}
                                            </td>

                                            {/* Running Balance */}
                                            <td style={{ 
                                                padding: '10px 12px', 
                                                textAlign: 'right', 
                                                fontWeight: 800, 
                                                color: '#1e293b',
                                                background: '#fcfcfc'
                                            }}>
                                                {fmtCurrency(row.runningBalance)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Closing Balance Footer */}
                    <div style={{ 
                        padding: '10px 20px', 
                        background: '#f8fafc', 
                        borderTop: '1.5px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center'
                    }}>
                        <div style={{ fontSize: '12.5px', color: '#475569', fontWeight: 800 }}>
                            {isTamil ? 'அன்றைய முடிவு இருப்பு:' : 'Day Closing Balance:'} 
                            <span style={{ 
                                marginLeft: '8px', 
                                fontSize: '14px', 
                                fontWeight: 900,
                                color: colors.text
                            }}>
                                {fmtCurrency(day.closingBalance)}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default LedgerTable;
