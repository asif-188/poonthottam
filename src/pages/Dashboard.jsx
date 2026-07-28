import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { LangContext } from '../components/Layout';

const Dashboard = () => {
    const navigate = useNavigate();
    const { lang } = useContext(LangContext);

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
        }
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-[75vh] w-full px-4 py-8 animate-in fade-in zoom-in duration-500 relative">
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
                            {lang === 'ta' ? (
                                <span className={`text-lg sm:text-2xl font-black ${card.textClass} tracking-tight block font-display break-words leading-tight`}>
                                    {card.labelTa}
                                </span>
                            ) : (
                                <span className={`text-lg sm:text-2xl font-black ${card.textClass} tracking-tight block font-sans break-words leading-tight`}>
                                    {card.labelEn}
                                </span>
                            )}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
