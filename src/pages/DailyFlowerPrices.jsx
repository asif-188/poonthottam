import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  Calendar, 
  Plus, 
  Save, 
  Download, 
  Printer, 
  Share2, 
  ArrowLeft, 
  ArrowRight, 
  ChevronUp, 
  ChevronDown, 
  Check, 
  X, 
  Search, 
  Copy, 
  RefreshCw,
  Phone,
  Settings,
  Sparkles,
  FileText
} from 'lucide-react';
import { 
  subscribeToCollection, 
  saveProduct, 
  getDailyFlowerPrices, 
  saveDailyFlowerPrices 
} from '../utils/storage';
import { LangContext } from '../components/Layout';
import { useTenant } from '../utils/TenantContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Helper to get formatted date string (YYYY-MM-DD)
const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const DailyFlowerPrices = () => {
  const { lang, t } = useContext(LangContext);
  const { tenantId, tenantData, user } = useTenant();
  
  // Date State
  const [date, setDate] = useState(toDateStr(new Date()));
  
  // Master Flower Data
  const [masterFlowers, setMasterFlowers] = useState([]);
  
  // Prices State (for selected date)
  const [items, setItems] = useState([]);
  const [rateLabel, setRateLabel] = useState('Rate - 1');
  const [footerText, setFooterText] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Loading & UI States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [posterLang, setPosterLang] = useState('ta'); // Poster language independent of app lang
  
  // Inline Flower Add Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFlower, setNewFlower] = useState({ name: '', taName: '', unit: 'kg' });
  const [isSavingFlower, setIsSavingFlower] = useState(false);
  const [transTimeout, setTransTimeout] = useState(null);

  // Subscribe to Master Flowers
  useEffect(() => {
    const unsub = subscribeToCollection('products', (data) => {
      // Sort master flowers alphabetically by default
      const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
      setMasterFlowers(sorted);
    }, true);
    return () => unsub();
  }, []);

  // Set default footer text when poster language changes
  useEffect(() => {
    if (!footerText || footerText === 'Thank you for your continued support!' || footerText === 'தங்களின் தொடர்ந்த ஆதரவிற்கு மனமார்ந்த நன்றி!') {
      setFooterText(posterLang === 'ta' 
        ? 'தங்களின் தொடர்ந்த ஆதரவிற்கு மனமார்ந்த நன்றி!' 
        : 'Thank you for your continued support!');
    }
  }, [posterLang]);

  // Load prices whenever date or masterFlowers list updates
  useEffect(() => {
    if (masterFlowers.length > 0) {
      loadPricesForDate(date);
    } else {
      setLoading(false);
    }
  }, [date, masterFlowers]);

  const loadPricesForDate = async (targetDate) => {
    setLoading(true);
    try {
      const savedDoc = await getDailyFlowerPrices(targetDate);
      if (savedDoc) {
        // Merge saved price items with master flowers
        const savedItems = savedDoc.items || [];
        const merged = masterFlowers.map((master) => {
          const saved = savedItems.find(s => s.flowerId === master.id);
          if (saved) {
            return {
              flowerId: master.id,
              name: master.name,
              taName: master.taName || '',
              price: saved.price || '',
              enabled: saved.enabled !== undefined ? saved.enabled : true,
              sortOrder: saved.sortOrder !== undefined ? saved.sortOrder : 999
            };
          } else {
            // Master flower added since this date's prices were saved
            return {
              flowerId: master.id,
              name: master.name,
              taName: master.taName || '',
              price: '',
              enabled: true,
              sortOrder: 999
            };
          }
        });

        // Sort items by saved display order
        merged.sort((a, b) => a.sortOrder - b.sortOrder);
        setItems(merged);
        setRateLabel(savedDoc.rateLabel || 'Rate - 1');
        if (savedDoc.footerText !== undefined) {
          setFooterText(savedDoc.footerText);
        }
        setCreatedBy(savedDoc.createdBy || '');
        setLastUpdated(savedDoc.updatedAt);
      } else {
        // No saved prices. Generate empty rate list for all master flowers
        const initial = masterFlowers.map((master, idx) => ({
          flowerId: master.id,
          name: master.name,
          taName: master.taName || '',
          price: '',
          enabled: true,
          sortOrder: idx
        }));
        setItems(initial);
        setRateLabel('Rate - 1');
        setFooterText(posterLang === 'ta' 
          ? 'தங்களின் தொடர்ந்த ஆதரவிற்கு மனமார்ந்த நன்றி!' 
          : 'Thank you for your continued support!');
        setCreatedBy('');
        setLastUpdated(null);
      }
    } catch (err) {
      console.error('Error loading prices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (flowerId, val) => {
    setItems(prev => prev.map(item => 
      item.flowerId === flowerId ? { ...item, price: val } : item
    ));
  };

  const handleToggleEnabled = (flowerId) => {
    setItems(prev => prev.map(item => 
      item.flowerId === flowerId ? { ...item, enabled: !item.enabled } : item
    ));
  };

  const handleMoveUp = (idx) => {
    if (idx === 0) return;
    setItems(prev => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx - 1];
      copy[idx - 1] = temp;
      return copy;
    });
  };

  const handleMoveDown = (idx) => {
    if (idx === items.length - 1) return;
    setItems(prev => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[idx + 1];
      copy[idx + 1] = temp;
      return copy;
    });
  };

  const handleSavePrices = async () => {
    setSaving(true);
    try {
      // Set sort order based on current index positions
      const itemsToSave = items.map((item, idx) => ({
        ...item,
        sortOrder: idx
      }));

      const payload = {
        items: itemsToSave,
        rateLabel,
        footerText,
        createdBy: user?.email || 'System'
      };

      await saveDailyFlowerPrices(date, payload);
      await loadPricesForDate(date);
      alert(lang === 'ta' ? '✓ இன்றைய விலை பட்டியல் வெற்றிகரமாகச் சேமிக்கப்பட்டது!' : '✓ Today\'s price list saved successfully!');
    } catch (err) {
      alert('Error saving prices: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Copy latest saved prices from the last 10 days
  const handleCopyLatestPrices = async () => {
    setLoading(true);
    try {
      let currentDate = new Date(date);
      let foundDoc = null;
      
      // Look back up to 10 days
      for (let i = 1; i <= 10; i++) {
        currentDate.setDate(currentDate.getDate() - 1);
        const dateStr = toDateStr(currentDate);
        const docData = await getDailyFlowerPrices(dateStr);
        if (docData && docData.items && docData.items.length > 0) {
          foundDoc = docData;
          break;
        }
      }

      if (foundDoc) {
        setItems(prev => {
          return prev.map(current => {
            const matching = foundDoc.items.find(f => f.flowerId === current.flowerId);
            if (matching) {
              return {
                ...current,
                price: matching.price || '',
                enabled: matching.enabled !== undefined ? matching.enabled : true
              };
            }
            return current;
          });
        });
        alert(lang === 'ta' 
          ? `✓ ${foundDoc.date.split('-').reverse().join('/')} தேதியிலிருந்து விலைகள் நகலெடுக்கப்பட்டன!` 
          : `✓ Prices copied from ${foundDoc.date.split('-').reverse().join('/')}!`);
      } else {
        alert(lang === 'ta' 
          ? '❌ கடந்த 10 நாட்களில் சேமிக்கப்பட்ட விலை பட்டியல் எதுவும் இல்லை!' 
          : '❌ No saved price lists found in the last 10 days!');
      }
    } catch (err) {
      alert('Failed to copy: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add new flower variety inline
  const handleAddFlowerSubmit = async (e) => {
    e.preventDefault();
    if (!newFlower.name.trim() || isSavingFlower) return;

    setIsSavingFlower(true);
    try {
      await saveProduct({
        name: newFlower.name.trim(),
        taName: newFlower.taName.trim(),
        unit: newFlower.unit
      });
      setIsAddModalOpen(false);
      setNewFlower({ name: '', taName: '', unit: 'kg' });
      alert(lang === 'ta' ? '✓ புதிய பூ மாஸ்டரில் சேர்க்கப்பட்டது!' : '✓ New flower variety added to master!');
    } catch (err) {
      alert('Failed to add flower: ' + err.message);
    } finally {
      setIsSavingFlower(false);
    }
  };

  // Auto translate flower name to Tamil
  const translateText = async (text, from, to) => {
    if (!text || text.length < 2) return '';
    try {
      const resp = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
      const data = await resp.json();
      return data[0][0][0];
    } catch { return ''; }
  };

  const handleNameChangeTranslate = (val) => {
    setNewFlower(prev => ({ ...prev, name: val }));
    
    if (transTimeout) clearTimeout(transTimeout);
    
    if (val.trim().length > 2) {
      const timeout = setTimeout(async () => {
        const translated = await translateText(val, 'en', 'ta');
        if (translated) {
          setNewFlower(prev => ({ ...prev, taName: translated }));
        }
      }, 800);
      setTransTimeout(timeout);
    }
  };

  // Poster Image Download
  const handleDownloadImage = async () => {
    const element = document.getElementById('price-poster-canvas-node');
    if (!element) return;
    
    try {
      const canvas = await html2canvas(element, {
        scale: 3, // capture high resolution
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `Rate_List_${date}.png`;
      link.click();
    } catch (err) {
      console.error(err);
      alert('Image generation failed.');
    }
  };

  // Poster PDF Download
  const handleDownloadPDF = async () => {
    const element = document.getElementById('price-poster-canvas-node');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const doc = new jsPDF('p', 'mm', 'a4');
      doc.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      doc.save(`Rate_List_${date}.pdf`);
    } catch (err) {
      console.error(err);
      alert('PDF generation failed.');
    }
  };

  // Poster Printing
  const handlePrint = async () => {
    const element = document.getElementById('price-poster-canvas-node');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Rate List</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: white; }
              img { max-width: 100%; max-height: 100vh; object-fit: contain; }
              @page { size: auto; margin: 0mm; }
              @media print {
                body { margin: 0; }
                img { max-width: 100%; max-height: 100vh; page-break-after: avoid; }
              }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <img src="${imgData}" />
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error(err);
      alert('Printing failed.');
    }
  };

  // Share Image File directly to WhatsApp
  const handleShareImageWhatsApp = async () => {
    const element = document.getElementById('price-poster-canvas-node');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      canvas.toBlob(async (blob) => {
        if (!blob) return alert('Failed to create poster image.');
        const file = new File([blob], `Rate_List_${date}.png`, { type: 'image/png' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Rate List - ${date}`,
              text: `${tenantData?.name || 'Flower Price List'} - ${date}`
            });
          } catch (e) {
            console.log('User cancelled share or share failed', e);
          }
        } else {
          // Fallback to direct download
          const imgData = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = imgData;
          link.download = `Rate_List_${date}.png`;
          link.click();
          alert(lang === 'ta' 
            ? 'வாட்ஸ்அப் நேரடிப் பகிர்வு உங்கள் சாதனத்தில் ஆதரிக்கப்படவில்லை. படம் பதிவிறக்கம் செய்யப்பட்டுள்ளது, நீங்கள் அதை கைமுறையாகப் பகிரலாம்!' 
            : 'Direct WhatsApp share is not supported on this device. The image has been downloaded, you can share it manually!');
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
      alert('Share failed: ' + err.message);
    }
  };

  // Share Text representation to WhatsApp (100% device compatible)
  const handleShareTextWhatsApp = () => {
    const bizName = tenantData?.name || 'Flower Market';
    const bizAddr = tenantData?.address || '';
    const formattedDate = date.split('-').reverse().join('/');
    
    let message = `🌸 *${bizName.toUpperCase()}* 🌸\n`;
    if (bizAddr) message += `📍 ${bizAddr}\n`;
    message += `📅 *${rateLabel} | ${formattedDate}*\n`;
    message += `───────────────────\n`;

    const activeItems = items.filter(i => i.enabled && i.price);
    if (activeItems.length === 0) {
      alert(lang === 'ta' ? 'பகர்வகை விலை எதுவும் உள்ளிடப்படவில்லை!' : 'No prices entered to share!');
      return;
    }

    activeItems.forEach(item => {
      const name = posterLang === 'ta' ? (item.taName || item.name) : item.name;
      message += `• ${name}  -  *${item.price}*\n`;
    });

    message += `───────────────────\n`;
    if (tenantData?.phone1) {
      message += `📞 Contact: ${tenantData.phone1}\n`;
    }
    if (footerText) {
      message += `\n_${footerText}_`;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Filter items based on search input
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.taName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Date Shift Helper
  const shiftDate = (amount) => {
    const current = new Date(date);
    current.setDate(current.getDate() + amount);
    setDate(toDateStr(current));
  };

  // Helper to parse and render phone numbers with proper spacing
  const renderPhoneNumbers = () => {
    const rawP1 = tenantData?.phone1 || '';
    const rawP2 = tenantData?.phone2 || '';
    
    let numbers = [];
    [rawP1, rawP2].forEach(raw => {
      if (raw) {
        // Split by slashes, commas, pipes, or semicolons
        raw.split(/[\/,|;]+/).forEach(p => {
          const cleaned = p.trim();
          if (cleaned && !numbers.includes(cleaned)) {
            numbers.push(cleaned);
          }
        });
      }
    });
    
    if (numbers.length === 0) return null;
    
    return (
      <div style={{ 
        fontSize: '13px', 
        fontWeight: 800, 
        color: '#1e293b', 
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '6px' 
      }}>
        <span>📞</span>
        {numbers.map((num, idx) => (
          <React.Fragment key={num}>
            {idx > 0 && <span style={{ color: '#94a3b8', padding: '0 4px' }}>|</span>}
            <span style={{ letterSpacing: '0.02em' }}>{num}</span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 min-h-[80vh] p-1 lg:p-4">
      {/* LEFT COLUMN: Data Entry & Configuration (58% width) */}
      <div className="w-full xl:w-[58%] bg-white rounded-[28px] border border-slate-100 shadow-xl p-6 flex flex-col justify-between">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Header Panel */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                🌸 {lang === 'ta' ? 'தினசரி பூ விலை திருத்தம்' : 'Daily Prices Entry'}
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                {lang === 'ta' ? 'இன்றைய பூக்களின் விலைகளை உள்ளிட்டு வாட்ஸ்அப் போஸ்டர் உருவாக்கவும்' : 'Update rates and generate printable rate cards for today.'}
              </p>
            </div>

            {/* Date Selector Navigation */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 rounded-2xl p-1.5 shadow-sm">
              <button 
                onClick={() => shiftDate(-1)}
                className="p-2 hover:bg-white rounded-xl text-slate-500 hover:text-slate-700 transition shadow-sm active:scale-95"
                title="Previous Day"
              >
                <ArrowLeft size={16} />
              </button>
              
              <div className="flex items-center gap-1.5 px-3">
                <Calendar size={14} className="text-emerald-500" />
                <input 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent border-none text-slate-700 font-bold text-sm outline-none cursor-pointer"
                />
              </div>

              <button 
                onClick={() => shiftDate(1)}
                className="p-2 hover:bg-white rounded-xl text-slate-500 hover:text-slate-700 transition shadow-sm active:scale-95"
                title="Next Day"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Form Actions bar */}
          <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
            {/* Search Box */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder={lang === 'ta' ? 'தேடுக...' : 'Search flowers...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-medium text-slate-700"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Copy Latest Prices */}
              <button
                type="button"
                onClick={handleCopyLatestPrices}
                className="flex items-center gap-1.5 px-4 py-2 border border-emerald-100 hover:border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold transition active:scale-95"
                title="Loads prices from the most recent day in the last 10 days"
              >
                <Copy size={13} />
                {lang === 'ta' ? 'நேற்றைய விலை நகல்' : 'Copy Latest'}
              </button>

              {/* Add Flower Inline */}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition active:scale-95"
              >
                <Plus size={14} />
                {lang === 'ta' ? 'புதிய பூ சேர்க்க' : 'Add Flower'}
              </button>
            </div>
          </div>

          {/* Price Entries Table */}
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-slate-400 text-xs mt-3 font-semibold uppercase tracking-wider">{lang === 'ta' ? 'விலைகளை ஏற்றுகிறது...' : 'Loading rate list...'}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-2xl">
              <p className="text-slate-400 text-sm italic font-medium">
                {searchTerm ? (lang === 'ta' ? 'பூக்கள் எதுவும் பொருந்தவில்லை' : 'No flowers match search term') : (lang === 'ta' ? 'பூக்கள் மாஸ்டரில் பூக்கள் எதுவும் இல்லை!' : 'No flowers available. Click "Add Flower" to start.')}
              </p>
            </div>
          ) : (
            <div className="border border-slate-100 rounded-2xl overflow-hidden overflow-y-auto shadow-sm flex-1 min-h-[220px] mb-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100">
                    <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-12 text-center">#</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'பூவின் பெயர்' : 'Flower Name'}</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-20">{lang === 'ta' ? 'இயக்கு' : 'Show'}</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-36">{lang === 'ta' ? 'இன்றைய விலை (₹)' : 'Rate (₹)'}</th>
                    <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-20 text-center">{lang === 'ta' ? 'வரிசை' : 'Reorder'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, idx) => (
                    <tr 
                      key={item.flowerId} 
                      className={`hover:bg-slate-50/50 transition-colors ${!item.enabled ? 'opacity-50 bg-slate-50/30' : ''}`}
                    >
                      <td className="py-3.5 px-4 text-slate-400 text-xs font-bold text-center">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700 text-sm">
                        <div className="flex flex-col">
                          <span>{item.name}</span>
                          {item.taName && <span className="text-slate-400 text-xs font-medium">{item.taName}</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleEnabled(item.flowerId)}
                          className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors cursor-pointer mx-auto ${item.enabled ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}`}
                        >
                          <span className="w-5 h-5 bg-white rounded-full shadow-md transform duration-200"></span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <input
                          type="number"
                          placeholder="Rate"
                          value={item.price}
                          disabled={!item.enabled}
                          onChange={(e) => handlePriceChange(item.flowerId, e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 font-bold text-slate-700 disabled:opacity-50"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx === items.length - 1}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
                          >
                            <ChevronDown size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Config Settings Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{lang === 'ta' ? 'பட்டயல் எண்/வகை (எ.கா: Rate - 1)' : 'Rate Card Version (e.g., Rate - 1)'}</label>
              <input
                type="text"
                placeholder="Rate - 1"
                value={rateLabel}
                onChange={(e) => setRateLabel(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{lang === 'ta' ? 'அடிக்குறிப்பு செய்தி' : 'Poster Footer Text'}</label>
              <input
                type="text"
                placeholder={lang === 'ta' ? 'நன்றி...' : 'Footer Message'}
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-medium text-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Footer Meta & Save Button */}
        <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-4 mt-4 gap-4">
          <div className="text-slate-400 text-xs font-semibold">
            {lastUpdated && (
              <span className="flex flex-col">
                <span>{lang === 'ta' ? `கடைசியாக புதுப்பிக்கப்பட்டது: ${new Date(lastUpdated.toDate ? lastUpdated.toDate() : lastUpdated).toLocaleTimeString()}` : `Last updated: ${new Date(lastUpdated.toDate ? lastUpdated.toDate() : lastUpdated).toLocaleTimeString()}`}</span>
                <span>{lang === 'ta' ? `செய்தவர்: ${createdBy}` : `By: ${createdBy}`}</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSavePrices}
            disabled={saving || loading || items.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-600/30 transition duration-150 active:scale-95 disabled:opacity-50"
          >
            <Save size={18} />
            {lang === 'ta' ? 'விலைப்பட்டியல் சேமி' : 'Save Rates'}
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: Real-Time Premium Poster Preview & Actions (42% width) */}
      <div className="w-full xl:w-[42%] flex flex-col items-center gap-6">
        {/* Export and Poster Control Options */}
        <div className="w-full bg-white rounded-[28px] border border-slate-100 shadow-xl p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-bold text-slate-800 text-sm tracking-tight flex items-center gap-1.5">
              🎨 {lang === 'ta' ? 'போஸ்டர் வெளியீடு' : 'Poster Outputs'}
            </h3>
            
            {/* Poster Language Selector */}
            <div className="flex border border-slate-200 rounded-lg overflow-hidden p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setPosterLang('en')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${posterLang === 'en' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setPosterLang('ta')}
                className={`px-2 py-1 text-[10px] font-bold rounded ${posterLang === 'ta' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                தமிழ்
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Download Image */}
            <button
              onClick={handleDownloadImage}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition active:scale-95"
            >
              <Download size={14} />
              {lang === 'ta' ? 'படம் பதிவிறக்கு' : 'Image'}
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95"
            >
              <Printer size={14} />
              {lang === 'ta' ? 'அச்சிடு' : 'Print'}
            </button>
          </div>
        </div>

        {/* Live Poster Preview Wrapper */}
        <div className="w-full flex justify-center">
          <div className="scale-[0.80] md:scale-[0.88] origin-top border border-slate-200/50 shadow-2xl rounded-3xl overflow-hidden bg-white">
            {/* The Actual Poster Element (exactly captured by canvas) */}
            <div 
              id="price-poster-canvas-node"
              style={{
                width: '520px',
                minHeight: '820px',
                background: '#ffffff', // solid white to blend with borders
                padding: '42px 48px',
                boxSizing: 'border-box',
                position: 'relative',
                fontFamily: "'Antique Olive', 'Montserrat', sans-serif",
                color: '#3d2514', // deep warm charcoal-brown
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                overflow: 'hidden'
              }}
            >
              {/* Top and Bottom repeating floral garland borders */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '42px',
                backgroundImage: "url('/images/flower_garland.png')",
                backgroundRepeat: 'repeat-x', backgroundSize: 'contain', zIndex: 5
              }} />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '42px',
                backgroundImage: "url('/images/flower_garland.png')",
                backgroundRepeat: 'repeat-x', backgroundSize: 'contain', zIndex: 5,
                transform: 'rotate(180deg)'
              }} />

              {/* Left and Right vertical rose garlands */}
              <div style={{
                position: 'absolute', top: '38px', bottom: '38px', left: 0, width: '30px',
                backgroundImage: "url('/images/rose_mala.png')",
                backgroundRepeat: 'repeat-y', backgroundSize: 'contain', zIndex: 5
              }} />
              <div style={{
                position: 'absolute', top: '38px', bottom: '38px', right: 0, width: '30px',
                backgroundImage: "url('/images/rose_mala.png')",
                backgroundRepeat: 'repeat-y', backgroundSize: 'contain', zIndex: 5,
                transform: 'scaleX(-1)'
              }} />

              {/* Inner Double Thin Gold Border Card */}
              <div style={{
                border: '2px double #b45309', // amber/gold double frame
                borderRadius: '8px',
                padding: '24px 20px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: '#ffffff', // solid white to blend with border images
                position: 'relative',
                zIndex: 10
              }}>
                {/* Header Section */}
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  {/* Motto (Top text) */}
                  <div style={{
                    fontSize: '15px',
                    fontStyle: 'italic',
                    fontWeight: 'bold',
                    color: '#be123c', // deep rose red
                    marginBottom: '4px',
                    wordSpacing: '4px'
                  }}>
                    {tenantData?.motto || (posterLang === 'ta' ? 'மஷா அல்லாஹ்' : 'Masha Allah')}
                  </div>

                  {/* Company Name */}
                  <h1 style={{
                    fontSize: '26px',
                    fontWeight: 900,
                    color: '#9f1239', // deep cherry red
                    margin: '2px 0 6px 0',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase'
                  }}>
                    {tenantData?.name || 'M.M.A FRESH FLOWERS'}
                  </h1>

                  {/* Market Location */}
                  {tenantData?.address && (
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: '#0369a1', // navy blue
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      marginBottom: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      wordSpacing: '4px'
                    }}>
                      📍 {tenantData.address}
                    </div>
                  )}

                  {/* Date and Rate label pill */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #f0fdf4 0%, #d1fae5 100%)',
                      border: '1.5px solid #10b981',
                      borderRadius: '50px',
                      padding: '7px 22px',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#065f46',
                      boxShadow: '0 2px 4px rgba(16,185,129,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ position: 'relative', top: '-4px' }}>🌼 {rateLabel}</span>
                      <span style={{ color: '#059669', opacity: 0.6, position: 'relative', top: '-4px' }}>|</span>
                      <span style={{ position: 'relative', top: '-4px' }}>{date.split('-').reverse().join('/')} 🌼</span>
                    </div>
                  </div>
                </div>

                {/* Flower Price Table */}
                <div style={{ flex: 1, margin: '10px 0' }}>
                  {items.filter(i => i.enabled && i.price).length === 0 ? (
                    <div style={{ 
                      height: '100%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: '#94a3b8', 
                      fontSize: '13px', 
                      fontStyle: 'italic' 
                    }}>
                      {posterLang === 'ta' ? 'விலைகள் எதுவும் உள்ளிடப்படவில்லை' : 'No prices entered yet.'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {items
                        .filter(i => i.enabled && i.price)
                        .map((item) => {
                          const name = posterLang === 'ta' ? (item.taName || item.name) : item.name;
                          return (
                            <div 
                              key={item.flowerId}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                width: '100%', 
                                fontSize: '15px', 
                                fontWeight: 'bold',
                                margin: '3px 0'
                              }}
                            >
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                whiteSpace: 'nowrap',
                                color: '#1e293b',
                                flexShrink: 0
                              }}>
                                🌸 {name}
                              </span>
                              
                              {/* Dot Leaders (physical gap separator) */}
                              <div style={{ 
                                flex: 1, 
                                borderBottom: '2.5px dotted #ca8a04', // golden yellow dots
                                margin: '0 8px',
                                height: '1px',
                                alignSelf: 'center',
                                opacity: 0.85
                              }} />
                              
                              <span style={{ 
                                color: '#b91c1c', // red rate
                                fontVariantNumeric: 'tabular-nums', 
                                whiteSpace: 'nowrap',
                                fontSize: '16px',
                                fontWeight: 800,
                                flexShrink: 0
                              }}>
                                {item.price}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Footer Section */}
                <div style={{ 
                  textAlign: 'center', 
                  borderTop: '1.5px dashed #e2e8f0', 
                  paddingTop: '12px',
                  marginTop: '12px' 
                }}>
                  {/* Phone contact */}
                  {renderPhoneNumbers()}

                  {/* Thank you fold hands */}
                  <div style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: '#64748b', 
                    fontStyle: 'italic',
                    wordSpacing: posterLang === 'ta' ? '5px' : 'normal',
                    letterSpacing: '0.01em'
                  }}>
                    🙏 {footerText || (posterLang === 'ta' ? 'தங்களின் தொடர்ந்த ஆதரவிற்கு மனமார்ந்த நன்றி!' : 'Thank you for your continued support!')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* INLINE MODAL: Add Flower to Master */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-1.5">
                🌸 {lang === 'ta' ? 'புதிய பூ சேர்க்க' : 'Add New Flower variety'}
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddFlowerSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{lang === 'ta' ? 'பூ பெயர் (English)' : 'Flower Name (English)'}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Yellow Button Rose"
                  value={newFlower.name}
                  onChange={(e) => handleNameChangeTranslate(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{lang === 'ta' ? 'தமிழ் பெயர் (விருப்பம்)' : 'Tamil Name (Optional)'}</label>
                <input
                  type="text"
                  placeholder="எ.கா: மஞ்சள் பட்டன் ரோஸ்"
                  value={newFlower.taName}
                  onChange={(e) => setNewFlower(prev => ({ ...prev, taName: e.target.value }))}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-semibold text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{lang === 'ta' ? 'அலகு (Unit)' : 'Unit'}</label>
                <select
                  value={newFlower.unit}
                  onChange={(e) => setNewFlower(prev => ({ ...prev, unit: e.target.value }))}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-semibold text-slate-700 bg-white"
                >
                  <option value="kg">kg (கிலோ)</option>
                  <option value="bundle">bundle (கட்டு)</option>
                  <option value="piece">piece (எண்ணிக்கை)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition"
                >
                  {lang === 'ta' ? 'ரத்து செய்' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingFlower}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  {isSavingFlower && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                  {lang === 'ta' ? 'பூவைச் சேமி' : 'Save Flower'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyFlowerPrices;
