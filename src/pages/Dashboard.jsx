import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LangContext } from '../components/Layout';
import { Settings } from 'lucide-react';
import BusinessSettings from './BusinessSettings';

const Dashboard = () => {
    const navigate = useNavigate();
    const { lang } = useContext(LangContext);
    const [showBizModal, setShowBizModal] = useState(false);

    const cards = [
        {
            labelTa: 'விற்பனை',
            labelEn: 'Sales',
            icon: '💰',
            path: '/app/sales-menu',
            borderClass: 'border-orange-100 hover:border-orange-400 hover:shadow-orange-100',
            textClass: 'text-orange-800',
            textSubClass: 'text-orange-600'
        },
        {
            labelTa: 'கொள்முதல்',
            labelEn: 'Purchase',
            icon: '🚚',
            path: '/app/vendor-menu',
            borderClass: 'border-emerald-100 hover:border-emerald-400 hover:shadow-emerald-100',
            textClass: 'text-emerald-800',
            textSubClass: 'text-emerald-600'
        },
        {
            labelTa: 'பணியாளர் பிரிவு',
            labelEn: 'Staff',
            icon: '👨💼',
            path: '/app/salesman-menu',
            borderClass: 'border-indigo-100 hover:border-indigo-400 hover:shadow-indigo-100',
            textClass: 'text-indigo-800',
            textSubClass: 'text-indigo-600'
        },
        {
            labelTa: 'பணம் செலுத்துதல்',
            labelEn: 'Payments',
            icon: '💳',
            path: '/app/payments',
            borderClass: 'border-rose-100 hover:border-rose-400 hover:shadow-rose-100',
            textClass: 'text-rose-800',
            textSubClass: 'text-rose-600'
        },
        {
            labelTa: 'பூ அறிக்கை',
            labelEn: 'Flower Report',
            icon: '🌸',
            path: '/app/flower-wise-report',
            borderClass: 'border-pink-100 hover:border-pink-400 hover:shadow-pink-100',
            textClass: 'text-pink-800',
            textSubClass: 'text-pink-600'
        },
        {
            labelTa: 'விரைவு பதிவு',
            labelEn: 'Quick Entry',
            icon: '⚡',
            path: '/app/quick-entry',
            borderClass: 'border-amber-100 hover:border-amber-400 hover:shadow-amber-100',
            textClass: 'text-amber-800',
            textSubClass: 'text-amber-600'
        },
        {
            labelTa: 'மற்றவை',
            labelEn: 'Others',
            icon: '📁',
            path: '/app/others-menu',
            borderClass: 'border-slate-100 hover:border-slate-400 hover:shadow-slate-100',
            textClass: 'text-slate-800',
            textSubClass: 'text-slate-600'
        },
        {
            labelTa: 'அமைப்புகள்',
            labelEn: 'Settings',
            icon: '⚙️',
            path: '/app/business-info',
            borderClass: 'border-cyan-100 hover:border-cyan-400 hover:shadow-cyan-100',
            textClass: 'text-cyan-800',
            textSubClass: 'text-cyan-600'
        }
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-[75vh] w-full px-4 py-8 animate-in fade-in zoom-in duration-500 relative">
            
            {/* Small business settings/info icon in top right corner */}
            <button
                onClick={() => setShowBizModal(true)}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(8px)',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '50%',
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s',
                    zIndex: 10
                }}
                onMouseEnter={e => Object.assign(e.currentTarget.style, { background: '#f1f5f9', color: '#10b981', borderColor: '#a7f3d0' })}
                onMouseLeave={e => Object.assign(e.currentTarget.style, { background: 'rgba(255, 255, 255, 0.8)', color: '#64748b', borderColor: '#e2e8f0' })}
                title="Business Settings"
            >
                <Settings size={20} />
            </button>

            {/* Main Selection Containers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 w-full max-w-7xl">
                {cards.map((card, index) => (
                    <button
                        key={index}
                        onClick={() => navigate(card.path)}
                        className={`group relative overflow-hidden bg-white/80 backdrop-blur-md border-4 ${card.borderClass} p-4 sm:p-5 rounded-[32px] shadow-2xl transition-all transform hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center gap-2 cursor-pointer min-h-[160px] sm:min-h-[190px]`}
                    >
                        <span className="text-3xl sm:text-4xl mb-1 filter drop-shadow-sm group-hover:scale-110 transition-transform duration-200">
                            {card.icon}
                        </span>
                        <div className="text-center w-full px-1">
                            {/* Tamil Name */}
                            <span className={`text-base sm:text-lg font-black ${card.textClass} tracking-tight block mb-0.5 font-display break-words leading-tight`}>
                                {card.labelTa}
                            </span>
                            {/* English Name */}
                            <span className={`text-xs sm:text-sm font-semibold ${card.textSubClass} tracking-wide block font-sans break-words leading-tight`}>
                                {card.labelEn}
                            </span>
                        </div>
                    </button>
                ))}
            </div>

            {/* Business Info Modal */}
            {showBizModal && (
                <BusinessSettings isModal={true} onClose={() => setShowBizModal(false)} />
            )}
        </div>
    );
};

export default Dashboard;
