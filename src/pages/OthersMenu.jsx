import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { LangContext } from '../components/Layout';

const MENU_ITEMS = [
    {
        emoji: '📜',
        label: 'History Log',
        labelTa: 'வரலாறு',
        color: { border: '#10b981', text: '#047857', bg: '#ecfdf5', glow: 'rgba(16,185,129,0.15)' },
        route: '/app/history',
    },
    {
        emoji: '🗑️',
        label: 'Recycle Bin',
        labelTa: 'குப்பைத் தொட்டி',
        color: { border: '#ef4444', text: '#b91c1c', bg: '#fef2f2', glow: 'rgba(239,68,68,0.15)' },
        route: '/app/recycle-bin',
    }
];

const CARD_W = 320;

const MenuCard = ({ emoji, label, color, onClick }) => {
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

const OthersMenu = () => {
    const navigate = useNavigate();
    const { lang } = useContext(LangContext);

    return (
        <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            padding: '24px 0',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
        }}>
            {MENU_ITEMS.map((item, idx) => (
                <MenuCard
                    key={idx}
                    emoji={item.emoji}
                    label={lang === 'ta' ? item.labelTa : item.label}
                    color={item.color}
                    onClick={() => navigate(item.route)}
                />
            ))}
        </div>
    );
};

export default OthersMenu;
