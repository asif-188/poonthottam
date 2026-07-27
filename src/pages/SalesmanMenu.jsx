import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { LangContext } from '../components/Layout';

const MENU_ITEMS = [
    {
        emoji: '👥',
        label: 'Staff List',
        labelTa: 'பணியாளர் பட்டியல்',
        color: { border: '#10b981', text: '#047857', bg: '#ecfdf5', glow: 'rgba(16,185,129,0.15)' },
        route: '/app/salesman-master',
    },
    {
        emoji: '➕',
        label: 'Add Staff',
        labelTa: 'பணியாளர் சேர்க்கவும்',
        color: { border: '#4f46e5', text: '#3730a3', bg: '#eef2ff', glow: 'rgba(79,70,229,0.15)' },
        route: '/app/salesman-master',
        state: { openAddModal: true }
    },
    {
        emoji: '📖',
        label: 'Historical/Ledger Data',
        labelTa: 'வரலாற்று/பேரேடு தரவு',
        color: { border: '#6366f1', text: '#312e81', bg: '#eef2ff', glow: 'rgba(99,102,241,0.15)' },
        route: '/app/salesman-ledger',
    },
    {
        emoji: '💸',
        label: 'Credit / Expenses',
        labelTa: 'கடன் / செலவுகள்',
        color: { border: '#ef4444', text: '#b91c1c', bg: '#fef2f2', glow: 'rgba(239,68,68,0.15)' },
        route: '/app/salesman-credit-expenses',
    },
    {
        emoji: '📈',
        label: 'Reports',
        labelTa: 'அறிக்கைகள்',
        color: { border: '#d97706', text: '#d97706', bg: '#fffbeb', glow: 'rgba(217,119,6,0.15)' },
        route: '/app/salesman-reports',
    }
];

const CARD_W = 320; // slightly wider for long ledger name

const MenuCard = ({ emoji, label, color, onClick, delay }) => {
    const [hovered, setHovered] = React.useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '20px 24px',
                background: hovered ? color.bg : '#ffffff',
                border: `2.5px solid ${color.border}`,
                borderRadius: '18px',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: hovered ? 'translateY(-4px) scale(1.03)' : 'translateY(0) scale(1)',
                boxShadow: hovered
                    ? `0 12px 32px ${color.glow}, 0 2px 8px rgba(0,0,0,0.06)`
                    : '0 2px 8px rgba(0,0,0,0.04)',
                width: `${CARD_W}px`,
                outline: 'none',
                fontFamily: 'var(--font-display)',
                animationDelay: delay,
                flexShrink: 0,
            }}
        >
            <div style={{
                width: '56px', height: '56px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: hovered ? '#ffffff' : '#f8fafc',
                border: '1px solid #e2e8f0', borderRadius: '12px',
                transition: 'all 0.25s',
                transform: hovered ? 'rotate(6deg) scale(1.08)' : 'none',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
                <span style={{ fontSize: '30px', lineHeight: 1 }}>{emoji}</span>
            </div>

            <span style={{
                fontSize: '18px',
                fontWeight: 850,
                color: color.text,
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                textAlign: 'left',
                flex: 1,
            }}>
                {label}
            </span>
        </button>
    );
};

const SalesmanMenu = () => {
    const navigate = useNavigate();
    const { lang } = useContext(LangContext);

    return (
        <div style={{
            minHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Background blobs */}
            <div style={{ position:'absolute', top:'10%', left:'15%', width:'250px', height:'250px', background:'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }} />

            {/* Floating emojis */}
            <div className="animate-float" style={{position:'absolute',top:'15%',left:'8%',fontSize:'28px',opacity:0.2,pointerEvents:'none'}}>📖</div>
            <div className="animate-drift" style={{position:'absolute',bottom:'20%',right:'12%',fontSize:'32px',opacity:0.15,pointerEvents:'none',animationDelay:'1.5s'}}>💼</div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', position: 'relative', zIndex: 10, padding: '16px' }}>
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {MENU_ITEMS.map((item, i) => (
                        <div key={item.label} className="animate-in fade-in" style={{ animationDelay: `${i * 0.08}s`, animationDuration: '0.4s' }}>
                            <MenuCard
                                emoji={item.emoji}
                                label={lang === 'ta' ? item.labelTa : item.label}
                                color={item.color}
                                onClick={() => {
                                    if (item.state) {
                                        navigate(item.route, { state: item.state });
                                    } else {
                                        navigate(item.route);
                                    }
                                }}
                                delay={`${i * 0.08}s`}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SalesmanMenu;
