import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { LangContext } from '../components/Layout';

const MENU_ITEMS = [
    {
        emoji: '👥',
        label: 'Vendor',
        labelTa: 'விற்பனையாளர்',
        color: { border: '#2563eb', text: '#2563eb', bg: '#eff6ff', glow: 'rgba(37,99,235,0.15)' },
        route: '/app/outside-shop',
        state: { tab: 'vendors' }
    },
    {
        emoji: '💰',
        label: 'Cash Paid',
        labelTa: 'பணம் செலுத்தியது',
        color: { border: '#7c3aed', text: '#7c3aed', bg: '#faf5ff', glow: 'rgba(124,58,237,0.15)' },
        route: '/app/outside-shop',
        state: { tab: 'vendor-payments' }
    },
    {
        emoji: '📦',
        label: 'Purchase',
        labelTa: 'கொள்முதல்',
        color: { border: '#0891b2', text: '#0891b2', bg: '#ecfeff', glow: 'rgba(8,145,178,0.15)' },
        route: '/app/outside-shop',
        state: { tab: 'purchase' }
    },
    {
        emoji: '🛒',
        label: 'Cash Purchase',
        labelTa: 'ரொக்கக் கொள்முதல்',
        color: { border: '#10b981', text: '#10b981', bg: '#ecfdf5', glow: 'rgba(16,185,129,0.15)' },
        route: '/app/cash-purchase',
    },
    {
        emoji: '📊',
        label: 'Vendor Report',
        labelTa: 'விற்பனையாளர் அறிக்கை',
        color: { border: '#d97706', text: '#d97706', bg: '#fffbeb', glow: 'rgba(217,119,6,0.15)' },
        route: '/app/outside-shop',
        state: { tab: 'reports' }
    },
    {
        emoji: '🌸',
        label: 'Flowers',
        labelTa: 'பூக்கள் பட்டியல்',
        color: { border: '#db2777', text: '#db2777', bg: '#fdf2f8', glow: 'rgba(219,39,119,0.15)' },
        route: '/app/flowers',
    },
    {
        emoji: '📂',
        label: 'Daily Report',
        labelTa: 'தினசரி அறிக்கை',
        color: { border: '#0d9488', text: '#0d9488', bg: '#f0fdfa', glow: 'rgba(13,148,136,0.15)' },
        route: '/app/daily-report',
    },
    {
        emoji: '📖',
        label: 'Daily Statement',
        labelTa: 'தினசரி கணக்கு அறிக்கை',
        color: { border: '#0369a1', text: '#0369a1', bg: '#f0f9ff', glow: 'rgba(3,105,161,0.15)' },
        route: '/app/daily-statement',
    },
];

const CARD_W = 320;

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
                padding: '18px 20px',
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
                width: '54px', height: '54px', flexShrink: 0,
                display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: hovered ? '#ffffff' : '#f8fafc',
                border: '1px solid #e2e8f0', borderRadius: '12px',
                transition: 'all 0.25s',
                transform: hovered ? 'rotate(6deg) scale(1.08)' : 'none',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
                <span style={{ fontSize: '28px', lineHeight: 1 }}>{emoji}</span>
            </div>

            <span style={{
                fontSize: '14px',
                fontWeight: 850,
                color: color.text,
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
                textAlign: 'left',
                flex: 1,
                wordBreak: 'keep-all',
                overflowWrap: 'normal',
            }}>
                {label}
            </span>
        </button>
    );
};

const VendorMenu = () => {
    const navigate = useNavigate();
    const { lang } = useContext(LangContext);

    // Grid layout: 3, 3, 2
    const row1 = MENU_ITEMS.slice(0, 3);
    const row2 = MENU_ITEMS.slice(3, 6);
    const row3 = MENU_ITEMS.slice(6);

    const handleNavigate = (item) => {
        if (item.state) {
            navigate(item.route, { state: item.state });
        } else {
            navigate(item.route);
        }
    };

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
            <div style={{ position:'absolute', top:'5%', left:'10%', width:'300px', height:'300px', background:'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }} />
            <div style={{ position:'absolute', bottom:'10%', right:'10%', width:'350px', height:'350px', background:'radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }} />

            {/* Floating emojis */}
            <div className="animate-float" style={{position:'absolute',top:'12%',left:'6%',fontSize:'28px',opacity:0.25,pointerEvents:'none'}}>🌸</div>
            <div className="animate-drift" style={{position:'absolute',top:'25%',right:'8%',fontSize:'36px',opacity:0.12,pointerEvents:'none',animationDelay:'1.5s'}}>🌸</div>
            <div className="animate-float" style={{position:'absolute',bottom:'25%',left:'14%',fontSize:'22px',opacity:0.3,pointerEvents:'none',animationDelay:'0.8s'}}>🌼</div>
            <div className="animate-drift" style={{position:'absolute',bottom:'38%',right:'16%',fontSize:'28px',opacity:0.1,pointerEvents:'none',animationDelay:'2s'}}>🌺</div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', position: 'relative', zIndex: 10, padding: '16px' }}>
                {/* Row 1: 3 cards */}
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {row1.map((item, i) => (
                        <div key={item.label} className="animate-in fade-in" style={{ animationDelay: `${i * 0.08}s`, animationDuration: '0.4s' }}>
                            <MenuCard
                                emoji={item.emoji}
                                label={lang === 'ta' ? item.labelTa : item.label}
                                color={item.color}
                                onClick={() => handleNavigate(item)}
                                delay={`${i * 0.08}s`}
                            />
                        </div>
                    ))}
                </div>

                {/* Row 2: 3 cards */}
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {row2.map((item, i) => (
                        <div key={item.label} className="animate-in fade-in" style={{ animationDelay: `${(i + 3) * 0.08}s`, animationDuration: '0.4s' }}>
                            <MenuCard
                                emoji={item.emoji}
                                label={lang === 'ta' ? item.labelTa : item.label}
                                color={item.color}
                                onClick={() => handleNavigate(item)}
                                delay={`${(i + 3) * 0.08}s`}
                            />
                        </div>
                    ))}
                </div>

                {/* Row 3: 2 cards centered */}
                <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {row3.map((item, i) => (
                        <div key={item.label} className="animate-in fade-in" style={{ animationDelay: `${(i + 6) * 0.08}s`, animationDuration: '0.4s' }}>
                            <MenuCard
                                emoji={item.emoji}
                                label={lang === 'ta' ? item.labelTa : item.label}
                                color={item.color}
                                onClick={() => handleNavigate(item)}
                                delay={`${(i + 6) * 0.08}s`}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default VendorMenu;
