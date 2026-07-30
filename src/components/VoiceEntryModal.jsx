import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Check, Trash2, X, Plus, AlertCircle, RefreshCw, Search, ChevronDown } from 'lucide-react';

/* ── Smart Name Fuzzy Matcher ── */
const getMatchScore = (spokenText, name, nameTa) => {
    if (!spokenText) return 0;
    const cleanSpoken = spokenText.toLowerCase().replace(/[^a-z0-9\u0b80-\u0bff\s]/g, ' ').trim();
    const cleanName = (name || '').toLowerCase().trim();
    const cleanNameTa = (nameTa || '').toLowerCase().trim();
    
    if (!cleanName && !cleanNameTa) return 0;
    
    const checkContainment = (cand) => {
        if (!cand) return 0;
        if (cleanSpoken === cand) return 1.0;
        const wordRegex = new RegExp(`\\b${cand}\\b`, 'u');
        if (wordRegex.test(cleanSpoken)) return 0.95;
        if (cleanSpoken.includes(cand)) return 0.8;
        
        const candTokens = cand.split(/\s+/).filter(t => t.length > 0);
        const spokenTokens = cleanSpoken.split(/\s+/).filter(t => t.length > 0);
        if (candTokens.length === 0) return 0;
        
        let matchCount = 0;
        candTokens.forEach(ct => {
            if (spokenTokens.some(st => st === ct || st.includes(ct) || ct.includes(st))) {
                matchCount++;
            }
        });
        return matchCount / candTokens.length;
    };
    
    const scoreEng = checkContainment(cleanName);
    const scoreTa = checkContainment(cleanNameTa);
    return Math.max(scoreEng, scoreTa);
};

const isWordPresent = (text, word) => {
    if (!text || !word) return false;
    const t = text.toLowerCase();
    const w = word.toLowerCase();
    const idx = t.indexOf(w);
    if (idx === -1) return false;
    
    if (idx > 0) {
        const leftChar = t.charAt(idx - 1);
        if (/[a-zA-Z0-9\u0b80-\u0bff]/.test(leftChar)) {
            return false;
        }
    }
    const rightIdx = idx + w.length;
    if (rightIdx < t.length) {
        const rightChar = t.charAt(rightIdx);
        if (/[a-zA-Z0-9\u0b80-\u0bff]/.test(rightChar)) {
            return false;
        }
    }
    return true;
};

/* ── Number words converter (Tamil & English) ── */
const parseNumbers = (text) => {
    let clean = text.toLowerCase();
    
    const tamilDigits = {
        'பதினொன்னு': '11', 'பதினொன்று': '11',
        'பன்னிரண்டு': '12', 'பன்னெண்டு': '12',
        'பதின்மூணு': '13', 'பதின்மூன்று': '13',
        'பதினாலு': '14', 'பதினான்கு': '14',
        'பதினஞ்சு': '15', 'பதினைந்து': '15',
        'பதினாறு': '16', 'பதினேழு': '17', 'பதினெட்டு': '18', 'பத்தொன்பது': '19',
        
        'இருபத்தி': '2', 'முப்பத்தி': '3', 'நாற்பத்தி': '4', 'ஐம்பத்தி': '5', 'அறுபத்தி': '6', 'எழுபத்தி': '7', 'எண்பத்தி': '8', 'தொண்ணூற்றி': '9',
        
        'ஒன்னு': '1', 'ஒன்று': '1', 'ரெண்டு': '2', 'இரண்டு': '2', 'மூணு': '3', 'மூன்று': '3', 'நாலு': '4', 'நான்கு': '4', 'அஞ்சு': '5', 'ஐந்து': '5',
        'ஆறு': '6', 'ஏழு': '7', 'எட்டு': '8', 'ஒன்பது': '9', 'பூஜ்யம்': '0',
        
        'பத்து': '10', 'இருபது': '20', 'முப்பது': '30', 'நாற்பது': '40', 'ஐம்பது': '50', 'அறுபது': '60', 'எழுபது': '70', 'எண்பது': '80', 'தொண்ணூறு': '90',
        'நூறு': '100', 'இருநூறு': '200', 'முந்நூறு': '300', 'மூணூறு': '300', 'நானூறு': '400', 'ஐந்நூறு': '500', 'அறுநூறு': '600', 'எழுநூறு': '700', 'எண்ணூறு': '800', 'தொன்னூறு': '900',
        'ஆயிரம்': '1000'
    };
    
    const sortedTamilKeys = Object.keys(tamilDigits).sort((a, b) => b.length - a.length);
    
    const englishDigits = {
        'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19',
        'twenty': '20', 'thirty': '30', 'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70', 'eighty': '80', 'ninety': '90',
        'hundred': '100', 'thousand': '1000',
        'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10', 'zero': '0'
    };
    const sortedEnglishKeys = Object.keys(englishDigits).sort((a, b) => b.length - a.length);

    sortedTamilKeys.forEach(key => {
        const regex = new RegExp(key, 'g');
        clean = clean.replace(regex, ` ${tamilDigits[key]} `);
    });

    sortedEnglishKeys.forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        clean = clean.replace(regex, ` ${englishDigits[key]} `);
    });

    return clean;
};

const collapseDigits = (text) => {
    let prev = text;
    while (true) {
        let next = prev.replace(/\b(\d)\s+(\d)\b/g, '$1$2');
        if (next === prev) break;
        prev = next;
    }
    return prev;
};

const compileMultipliers = (text) => {
    let t = text;
    t = t.replace(/\b(\d+)\s+100\b/g, (match, p1) => String(parseInt(p1) * 100));
    t = t.replace(/\b(\d+)\s+1000\b/g, (match, p1) => String(parseInt(p1) * 1000));
    return t;
};

const extractQtyAndRate = (translatedText) => {
    const numbers = [];
    const numRegex = /\b\d+(?:\.\d+)?\b/g;
    let match;
    while ((match = numRegex.exec(translatedText)) !== null) {
        numbers.push({
            value: parseFloat(match[0]),
            index: match.index,
            text: match[0],
            assigned: false
        });
    }

    let quantity = null;
    let price = null;

    const weightKeywords = ['kilo', 'kilos', 'kg', 'கிலோ', 'அளவு', 'எடை', 'மூட்டை', 'qty', 'quantity', 'கேஜி', 'kilo gram', 'kilogram'];
    const rateKeywords = ['rate', 'price', 'விலை', 'ரேட்', 'ரேட்டு', 'ரூபாய்', 'ரூ', 'rs', 'rupees'];

    const checkContext = (index, numText, keywords) => {
        const leftStart = Math.max(0, index - 15);
        const leftContext = translatedText.substring(leftStart, index).toLowerCase();
        const rightEnd = Math.min(translatedText.length, index + numText.length + 15);
        const rightContext = translatedText.substring(index + numText.length, rightEnd).toLowerCase();
        
        return keywords.some(kw => leftContext.includes(kw) || rightContext.includes(kw));
    };

    numbers.forEach(num => {
        const isWeight = checkContext(num.index, num.text, weightKeywords);
        const isRate = checkContext(num.index, num.text, rateKeywords);
        
        if (isWeight && !isRate) {
            quantity = num.value;
            num.assigned = true;
        } else if (isRate && !isWeight) {
            price = num.value;
            num.assigned = true;
        }
    });

    const unassigned = numbers.filter(n => !n.assigned);
    
    if (quantity === null && unassigned.length > 0) {
        const first = unassigned.shift();
        quantity = first.value;
        first.assigned = true;
    }
    if (price === null && unassigned.length > 0) {
        const second = unassigned.shift();
        price = second.value;
        second.assigned = true;
    }

    return { quantity, price };
};

/* ── Gram & Kilogram Voice Preprocessor ── */
const preprocessWeights = (text) => {
    let t = text.toLowerCase();

    const exactPhrases = {
        'one and half kilo': '1.50 kg',
        'one and a half kilo': '1.50 kg',
        '1 and half kilo': '1.50 kg',
        '1 and a half kilo': '1.50 kg',
        '1.5 kilo': '1.50 kg',
        '1.5 கிலோ': '1.50 kg',
        '1.5 kg': '1.50 kg',
        'ஒன்னரை கிலோ': '1.50 kg',
        'ஒன்றரை கிலோ': '1.50 kg',
        '1ரை கிலோ': '1.50 kg',
        
        'three quarter kilo': '0.75 kg',
        'முக்கால் கிலோ': '0.75 kg',
        
        'half kilo': '0.50 kg',
        'அரை கிலோ': '0.50 kg',
        '0.5 kilo': '0.50 kg',
        '0.5 கிலோ': '0.50 kg',
        '0.5 kg': '0.50 kg',
        
        'quarter kilo': '0.25 kg',
        'கால் கிலோ': '0.25 kg',
        '0.25 kilo': '0.25 kg',
        '0.25 கிலோ': '0.25 kg',
        '0.25 kg': '0.25 kg',
        
        'one kilo': '1.00 kg',
        'ஒரு கிலோ': '1.00 kg'
    };

    for (const [phrase, replacement] of Object.entries(exactPhrases)) {
        t = t.replace(new RegExp(phrase, 'g'), ` ${replacement} `);
    }

    // Match "X kilo Y grams" or "X கிலோ Y கிராம்"
    const kiloGramsRegex = /(\d+(?:\.\d+)?)\s*(?:kilo|kilos|kg|கிலோ)\s*(?:and)?\s*(\d+(?:\.\d+)?)\s*(?:grams|gram|gm|gms|g|கிராம்)/gi;
    t = t.replace(kiloGramsRegex, (match, p1, p2) => {
        const kg = parseFloat(p1);
        const g = parseFloat(p2);
        const total = kg + (g / 1000);
        return ` ${total.toFixed(2)} kg `;
    });

    // Match single kilo numbers "X kilo" or "X kg" or "X கிலோ"
    const kiloRegex = /(\d+(?:\.\d+)?)\s*(?:kilo|kilos|kg|கிலோ)/gi;
    t = t.replace(kiloRegex, (match, p1) => {
        const kg = parseFloat(p1);
        return ` ${kg.toFixed(2)} kg `;
    });

    // Match single gram numbers "X grams" or "X கிராம்"
    const gramsRegex = /(\d+(?:\.\d+)?)\s*(?:grams|gram|gm|gms|g|கிராம்)/gi;
    t = t.replace(gramsRegex, (match, p1) => {
        const g = parseFloat(p1);
        const kg = g / 1000;
        return ` ${kg.toFixed(2)} kg `;
    });

    return t;
};

/* ── Smart Multi-Line & Multi-Type Speech Parser ── */
const parseMultiLineSpeech = (transcript, config) => {
    const { type, entities = [], flowers = [], currentItems = [], salesmen = [], lockedCustomer = null } = config;
    const cleanText = transcript.toLowerCase().trim();

    // 1. Save / Complete checks
    const saveKeywords = ['save', 'finish', 'complete', 'சேமி', 'முடி', 'சேவ்', 'பினிஷ்', 'transaction', 'பதிவு செய்'];
    if (saveKeywords.some(kw => cleanText.includes(kw))) {
        return { intent: 'SAVE' };
    }

    // 2. Cancel checks
    const cancelKeywords = ['cancel', 'close', 'ரத்து', 'கேன்சல்', 'மூடு'];
    if (cancelKeywords.some(kw => cleanText.includes(kw))) {
        return { intent: 'CANCEL' };
    }

    const rawTranslated = compileMultipliers(collapseDigits(parseNumbers(cleanText)));
    const translatedText = preprocessWeights(rawTranslated);

    // 3. Delete check (only relevant for multi-item sales/purchases)
    if (type === 'buyer' || type === 'vendor' || type === 'sales' || type === 'purchase') {
        const deleteKeywords = ['delete', 'remove', 'நீக்கு', 'டெலிட்', 'கழி'];
        const isDelete = deleteKeywords.some(kw => translatedText.includes(kw));
        if (isDelete) {
            let bestMatch = null;
            let bestScore = 0;
            currentItems.forEach(item => {
                const score = getMatchScore(translatedText, item.flowerType, item.flowerTypeTa);
                if (score > bestScore && score > 0.3) {
                    bestScore = score;
                    bestMatch = item;
                }
            });
            if (bestMatch) {
                return { intent: 'DELETE', target: bestMatch };
            }
        }

        // 4. Edit check (Only trigger edit/update if explicit edit keywords are spoken)
        const editKeywords = ['edit', 'change', 'update', 'replace', 'merge', 'மாற்று', 'திருத்து', 'மாத்து', 'ஏத்து', 'புதுப்பி'];
        const qtyKeywords = ['quantity', 'qty', 'weight', 'அளவு', 'எடை', 'கிலோ', 'மூட்டை', 'அளவை', 'கேஜி'];
        const rateKeywords = ['rate', 'price', 'விலை', 'ரேட்', 'ரேட்டு', 'ரூபாய்', 'ரூ', 'rs', 'rupees'];
        const isEdit = editKeywords.some(kw => translatedText.includes(kw));

        if (isEdit && currentItems.length > 0) {
            let matchedItem = null;
            let bestScore = 0;
            currentItems.forEach(item => {
                const score = getMatchScore(translatedText, item.flowerType, item.flowerTypeTa);
                if (score > bestScore && score > 0.3) {
                    bestScore = score;
                    matchedItem = item;
                }
            });
            
            const numMatch = translatedText.match(/\b\d+(?:\.\d+)?\b/);
            const newVal = numMatch ? parseFloat(numMatch[0]) : null;
            
            if (matchedItem && newVal !== null) {
                const isQtyEdit = qtyKeywords.some(kw => translatedText.includes(kw));
                const isRateEdit = rateKeywords.some(kw => translatedText.includes(kw));
                
                if (isQtyEdit) {
                    return { intent: 'EDIT', target: matchedItem, field: 'quantity', value: newVal };
                } else if (isRateEdit) {
                    return { intent: 'EDIT', target: matchedItem, field: 'price', value: newVal };
                } else {
                    return { intent: 'EDIT', target: matchedItem, field: 'quantity', value: newVal };
                }
            }
        }
    }

    // 5. Multi-type parsing logic
    if (type === 'buyer' || type === 'vendor' || type === 'sales' || type === 'purchase') {
        // Find Customer / Vendor (only if not locked)
        let matchedEntity = null;
        if (!lockedCustomer) {
            let bestEntityScore = 0;
            entities.forEach(e => {
                const score = getMatchScore(translatedText, e.name, e.nameTa || e.taName);
                if (score > bestEntityScore && score > 0.35) {
                    bestEntityScore = score;
                    matchedEntity = e;
                }
            });
        }

        // Strip the entity name out to avoid matching flower names with customer names
        let textWithoutEntity = translatedText;
        if (matchedEntity) {
            const nameToStrip = (matchedEntity.name || '').toLowerCase();
            const nameTaToStrip = (matchedEntity.nameTa || matchedEntity.taName || '').toLowerCase();
            if (nameToStrip && textWithoutEntity.includes(nameToStrip)) {
                textWithoutEntity = textWithoutEntity.replace(nameToStrip, '');
            } else if (nameTaToStrip && textWithoutEntity.includes(nameTaToStrip)) {
                textWithoutEntity = textWithoutEntity.replace(nameTaToStrip, '');
            }
        }

        // Identify all flower matches with their positions in the remaining text
        const flowerMatches = [];
        flowers.forEach(f => {
            const fName = (f.name || '').toLowerCase().trim();
            const fNameTa = (f.taName || f.nameTa || '').toLowerCase().trim();
            let idx = -1;
            let matchedKeyword = '';

            if (fName && isWordPresent(textWithoutEntity, fName)) {
                idx = textWithoutEntity.indexOf(fName);
                matchedKeyword = fName;
            } else if (fNameTa && isWordPresent(textWithoutEntity, fNameTa)) {
                idx = textWithoutEntity.indexOf(fNameTa);
                matchedKeyword = fNameTa;
            }

            if (idx !== -1) {
                // Ensure we don't add duplicates of the same match
                if (!flowerMatches.some(m => m.flower.name === f.name)) {
                    flowerMatches.push({ flower: f, index: idx, keyword: matchedKeyword });
                }
            }
        });

        // Sort matches by index
        flowerMatches.sort((a, b) => a.index - b.index);

        const items = [];
        if (flowerMatches.length > 0) {
            for (let i = 0; i < flowerMatches.length; i++) {
                const start = flowerMatches[i].index + flowerMatches[i].keyword.length;
                const end = (i + 1 < flowerMatches.length) ? flowerMatches[i + 1].index : textWithoutEntity.length;
                const segment = textWithoutEntity.substring(start, end);
                
                const { quantity, price } = extractQtyAndRate(segment);
                if (quantity !== null || price !== null) {
                    items.push({
                        flower: flowerMatches[i].flower,
                        quantity: quantity || 0,
                        price: price || 0
                    });
                }
            }
        } else {
            // Check for general qty and price if no flower matched
            const { quantity, price } = extractQtyAndRate(textWithoutEntity);
            if (quantity !== null || price !== null) {
                items.push({
                    flower: null,
                    quantity: quantity || 0,
                    price: price || 0
                });
            }
        }

        if (matchedEntity && items.length > 0) {
            return { intent: 'SELECT_CUSTOMER_AND_ADD_ITEMS', customer: matchedEntity, items };
        } else if (items.length > 0) {
            return { intent: 'ADD_ITEMS', items };
        } else if (matchedEntity) {
            return { intent: 'SELECT_CUSTOMER', customer: matchedEntity };
        }
    }

    if (type === 'cash_receive' || type === 'cash_pay' || type === 'credit' || type === 'debit') {
        // Payments mode: Match entity
        let matchedEntity = null;
        let bestEntityScore = 0;
        entities.forEach(e => {
            const score = getMatchScore(translatedText, e.name, e.nameTa || e.taName);
            if (score > bestEntityScore && score > 0.35) {
                bestEntityScore = score;
                matchedEntity = e;
            }
        });

        // Extract numbers
        const numbers = [];
        const numRegex = /\b\d+(?:\.\d+)?\b/g;
        let match;
        while ((match = numRegex.exec(translatedText)) !== null) {
            numbers.push({ value: parseFloat(match[0]), index: match.index, text: match[0], assigned: false });
        }

        let amount = null;
        let cashLess = null;

        const cashlessKeywords = ['online', 'upi', 'gpay', 'paytm', 'phonepe', 'card', 'bank', 'cashless', 'ஆன்லைன்', 'கூகுள் பே', 'கார்டு'];
        numbers.forEach(num => {
            const leftStart = Math.max(0, num.index - 15);
            const leftContext = translatedText.substring(leftStart, num.index).toLowerCase();
            const rightEnd = Math.min(translatedText.length, num.index + num.text.length + 15);
            const rightContext = translatedText.substring(num.index + num.text.length, rightEnd).toLowerCase();
            const isCashless = cashlessKeywords.some(kw => leftContext.includes(kw) || rightContext.includes(kw));

            if (isCashless) {
                cashLess = num.value;
                num.assigned = true;
            }
        });

        const unassigned = numbers.filter(n => !n.assigned);
        if (unassigned.length > 0) {
            amount = unassigned[0].value;
        }

        // Extract remarks by cleaning entity name & numbers
        let remarks = cleanText;
        if (matchedEntity) {
            remarks = remarks.replace((matchedEntity.name || '').toLowerCase(), '');
            remarks = remarks.replace((matchedEntity.nameTa || matchedEntity.taName || '').toLowerCase(), '');
        }
        numbers.forEach(num => {
            remarks = remarks.replace(num.text, '');
        });
        remarks = remarks.replace(/\b(rupees|rupee|rs|online|upi|cash|paid|received|payment|கிலோ|ரூபாய்|பணம்|செலுத்தியது|பெறப்பட்டது)\b/gi, '');
        remarks = remarks.replace(/[^a-zA-Z0-9\u0b80-\u0bff\s]/g, ' ').replace(/\s+/g, ' ').trim();

        return {
            intent: 'PAYMENT_FORM',
            entity: matchedEntity,
            amount: amount,
            cashLess: cashLess,
            remarks: remarks || ''
        };
    }

    if (type === 'expense') {
        let matchedStaff = null;
        let bestStaffScore = 0;
        const staffList = salesmen.length > 0 ? salesmen : entities;

        staffList.forEach(s => {
            const score = getMatchScore(translatedText, s.name, s.nameTa);
            if (score > bestStaffScore && score > 0.35) {
                bestStaffScore = score;
                matchedStaff = s;
            }
        });

        // Extract numbers
        const numbers = [];
        const numRegex = /\b\d+(?:\.\d+)?\b/g;
        let match;
        while ((match = numRegex.exec(translatedText)) !== null) {
            numbers.push({ value: parseFloat(match[0]), text: match[0] });
        }
        const amount = numbers.length > 0 ? numbers[0].value : null;

        let remarks = cleanText;
        if (matchedStaff) {
            remarks = remarks.replace((matchedStaff.name || '').toLowerCase(), '');
            remarks = remarks.replace((matchedStaff.nameTa || '').toLowerCase(), '');
        }
        numbers.forEach(num => {
            remarks = remarks.replace(num.text, '');
        });
        remarks = remarks.replace(/\b(rupees|rupee|rs|expense|petrol|food|tea|செலவு|ரூபாய்)\b/gi, '');
        remarks = remarks.replace(/[^a-zA-Z0-9\u0b80-\u0bff\s]/g, ' ').replace(/\s+/g, ' ').trim();

        let category = 'Other';
        if (cleanText.includes('petrol') || cleanText.includes('பெட்ரோல்') || cleanText.includes('வண்டி')) {
            category = 'Petrol';
        } else if (cleanText.includes('food') || cleanText.includes('உணவு') || cleanText.includes('சாப்பாடு') || cleanText.includes('tea') || cleanText.includes('டீ')) {
            category = 'Food';
        } else if (cleanText.includes('maintenance') || cleanText.includes('பராமரிப்பு')) {
            category = 'Maintenance';
        }

        return {
            intent: 'EXPENSE_FORM',
            staff: matchedStaff,
            amount,
            category,
            remarks: remarks || ''
        };
    }

    if (type === 'transfer') {
        let fromStaff = null;
        let toStaff = null;
        const staffList = salesmen.length > 0 ? salesmen : entities;

        const splitKeywords = [' to ', ' kku ', 'க்கு ', ' டிரான்ஸ்பர் '];
        let segments = [translatedText];
        for (let kw of splitKeywords) {
            if (translatedText.includes(kw)) {
                segments = translatedText.split(kw);
                break;
            }
        }

        if (segments.length >= 2) {
            let bestScore = 0;
            staffList.forEach(s => {
                const score = getMatchScore(segments[0], s.name, s.nameTa);
                if (score > bestScore && score > 0.35) {
                    bestScore = score;
                    fromStaff = s;
                }
            });
            bestScore = 0;
            staffList.forEach(s => {
                const score = getMatchScore(segments[1], s.name, s.nameTa);
                if (score > bestScore && score > 0.35) {
                    bestScore = score;
                    toStaff = s;
                }
            });
        } else {
            const foundStaff = [];
            staffList.forEach(s => {
                const score = getMatchScore(translatedText, s.name, s.nameTa);
                if (score > 0.35) {
                    foundStaff.push({ staff: s, score });
                }
            });
            foundStaff.sort((a, b) => b.score - a.score);
            if (foundStaff.length >= 1) fromStaff = foundStaff[0].staff;
            if (foundStaff.length >= 2) toStaff = foundStaff[1].staff;
        }

        const numbers = [];
        const numRegex = /\b\d+(?:\.\d+)?\b/g;
        let match;
        while ((match = numRegex.exec(translatedText)) !== null) {
            numbers.push({ value: parseFloat(match[0]), text: match[0] });
        }
        const amount = numbers.length > 0 ? numbers[0].value : null;

        let remarks = cleanText;
        if (fromStaff) {
            remarks = remarks.replace((fromStaff.name || '').toLowerCase(), '');
            remarks = remarks.replace((fromStaff.nameTa || '').toLowerCase(), '');
        }
        if (toStaff) {
            remarks = remarks.replace((toStaff.name || '').toLowerCase(), '');
            remarks = remarks.replace((toStaff.nameTa || '').toLowerCase(), '');
        }
        numbers.forEach(num => {
            remarks = remarks.replace(num.text, '');
        });
        remarks = remarks.replace(/\b(rupees|rupee|rs|transfer|டிரான்ஸ்பர்|ரூபாய்)\b/gi, '');
        remarks = remarks.replace(/[^a-zA-Z0-9\u0b80-\u0bff\s]/g, ' ').replace(/\s+/g, ' ').trim();

        return {
            intent: 'TRANSFER_FORM',
            fromStaff,
            toStaff,
            amount,
            remarks: remarks || ''
        };
    }

    return { intent: 'UNKNOWN' };
};

const EMPTY_ARRAY = [];

/* ── Keyboard-navigable Searchable Dropdown ── */
const SearchSelect = ({ items, value, onChange, onKeyDown, inputRef, placeholder, lang, style }) => {
    const [query, setQuery]         = useState('');
    const [open, setOpen]           = useState(false);
    const [cursor, setCursor]       = useState(0);
    const listRef                   = useRef(null);

    const formatName = (item) => {
        if (!item) return '';
        if (lang === 'ta') {
            return item.nameTa || item.taName || item.name;
        }
        return item.name;
    };

    const selectedItem = items.find(i => i.id === value || i.name === value);
    const selectedName = selectedItem ? formatName(selectedItem) : '';

    const filtered = query.trim()
        ? items
            .filter(i => {
                const n = i.name?.toLowerCase() || '';
                const tn = (i.nameTa || i.taName || '').toLowerCase();
                const q = query.toLowerCase();
                return n.includes(q) || tn.includes(q) || (i.displayId && String(i.displayId).includes(query));
            })
            .sort((a, b) => {
                const q = query.toLowerCase();
                const getScore = (item) => {
                    const n = item.name?.toLowerCase() || '';
                    const tn = (item.nameTa || item.taName || '').toLowerCase();
                    const id = item.displayId ? String(item.displayId).toLowerCase() : '';
                    if (n.startsWith(q) || tn.startsWith(q) || id.startsWith(q)) return 3;
                    if (n.includes(' ' + q) || tn.includes(' ' + q) || n.includes('-' + q) || tn.includes('-' + q)) return 2;
                    if (n.includes(q) || tn.includes(q) || id.includes(q)) return 1;
                    return 0;
                };
                return getScore(b) - getScore(a);
            })
        : items;

    const choose = (item) => {
        onChange(item);
        setQuery(formatName(item));
        setOpen(false);
    };

    const handleKey = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && filtered[cursor]) {
                choose(filtered[cursor]);
            }
            if (onKeyDown) onKeyDown(e);
        }
        else if (e.key === 'Escape') setOpen(false);
        else if (e.key === 'Tab') {
            if (open && filtered[cursor]) choose(filtered[cursor]);
            setOpen(false);
            if (onKeyDown) onKeyDown(e);
        }
    };

    useEffect(() => {
        if (listRef.current) {
            const els = listRef.current.querySelectorAll('li');
            els[cursor]?.scrollIntoView({ block: 'nearest' });
        }
    }, [cursor]);

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={open ? query : selectedName}
                onFocus={() => { setQuery(''); setOpen(true); setCursor(0); }}
                onBlur={() => setTimeout(() => setOpen(false), 200)}
                onChange={e => { setQuery(e.target.value); setCursor(0); }}
                onKeyDown={handleKey}
                autoComplete="off"
                style={{ ...(style || styles.selectInput), paddingRight: '40px' }}
            />
            <div style={{
                position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                color: '#cbd5e1', pointerEvents: 'none', display: 'flex', alignItems: 'center'
            }}>
                {open ? <Search size={16} /> : <ChevronDown size={16} />}
            </div>
            {open && filtered.length > 0 && (
                <ul ref={listRef} style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.10)', maxHeight: '200px',
                    overflowY: 'auto', listStyle: 'none', margin: '4px 0', padding: '4px',
                }}>
                    {filtered.map((item, i) => (
                        <li key={item.id || item.name} onMouseDown={() => choose(item)}
                            style={{
                                padding: '8px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px',
                                fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                                background: i === cursor ? '#f0fdf4' : 'transparent',
                                color: i === cursor ? '#15803d' : '#374151',
                            }}
                            onMouseEnter={() => setCursor(i)}
                        >
                            {item.displayId && <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>#{item.displayId}</span>}
                            {item.nameTa || item.taName ? `${item.name} - ${item.nameTa || item.taName}` : item.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const VoiceEntryModal = ({
    isOpen,
    onClose,
    onConfirm,
    entities = EMPTY_ARRAY,
    flowers = EMPTY_ARRAY,
    salesmen = EMPTY_ARRAY,
    type = 'buyer',
    langSetting = 'ta',
    initialCustomer = null,
    initialItems = EMPTY_ARRAY
}) => {
    const [speechLang, setSpeechLang] = useState(langSetting === 'ta' ? 'ta-IN' : 'en-IN');
    const [isListening, setIsListening] = useState(false);
    const [isRecognizing, setIsRecognizing] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState('idle'); // 'idle', 'listening', 'processing', 'recognized', 'permission_denied', 'no_speech'
    const [transcript, setTranscript] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // Form States
    const [selectedCustomer, setSelectedCustomer] = useState(initialCustomer);
    const [toStaff, setToStaff] = useState(null);
    const [itemsList, setItemsList] = useState(initialItems);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [cashlessAmount, setCashlessAmount] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('Petrol');
    const [paymentMethod, setPaymentMethod] = useState('Cash');

    const [manualItem, setManualItem] = useState({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
    const recognitionRef = useRef(null);
    const refFlower = useRef(null);
    const refQty = useRef(null);
    const refRate = useRef(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Sync speechLang if langSetting changes
    useEffect(() => {
        setSpeechLang(langSetting === 'ta' ? 'ta-IN' : 'en-IN');
    }, [langSetting]);

    const prevIsOpenRef = useRef(false);

    // Reset local state ONLY when modal transitions from closed to open
    useEffect(() => {
        if (isOpen && !prevIsOpenRef.current) {
            setSelectedCustomer(initialCustomer);
            setItemsList(initialItems);
            setToStaff(null);
            setPaymentAmount('');
            setCashlessAmount('');
            setPaymentNote('');
            setExpenseCategory('Petrol');
            setPaymentMethod('Cash');
            setTranscript('');
            setErrorMsg('');
            setIsListening(false);
            setVoiceStatus('idle');
        }
        prevIsOpenRef.current = isOpen;
    }, [isOpen, initialCustomer, initialItems]);

    // Instantiate and start SpeechRecognition in sync with user gesture
    const startSpeechRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setErrorMsg('Web Speech API is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        try {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }

            const rec = new SpeechRecognition();
            rec.continuous = false;
            rec.interimResults = false;
            rec.lang = speechLang;

            rec.onstart = () => {
                setIsRecognizing(true);
                setVoiceStatus('listening');
                setErrorMsg('');
                setIsListening(true);
            };

            rec.onresult = (e) => {
                const alternative = e.results[0][0];
                const confidence = alternative.confidence;
                const resultText = alternative.transcript;

                if (confidence < 0.45) {
                    console.log(`Speech ignored due to low confidence (${confidence}): ${resultText}`);
                    setIsListening(false);
                    setVoiceStatus('no_speech');
                    if (window.toast) {
                        window.toast.warning(langSetting === 'ta' ? 'குரல் தெளிவாக இல்லை. மீண்டும் முயற்சிக்கவும்.' : 'Speech was not clear. Please try again.');
                    }
                    return;
                }

                setVoiceStatus('processing');
                setTranscript(resultText);
                setIsListening(false);

                setTimeout(() => {
                    setVoiceStatus('recognized');
                    handleVoiceCommand(resultText);
                }, 600);
            };

            rec.onerror = (e) => {
                console.error('Speech recognition error:', e.error);
                setIsListening(false);
                setIsRecognizing(false);
                if (e.error === 'no-speech') {
                    setVoiceStatus('no_speech');
                    if (window.toast) {
                        window.toast.warning(langSetting === 'ta' ? 'குரல் எதுவும் கண்டறியப்படவில்லை!' : 'Voice not detected!');
                    }
                } else if (e.error === 'not-allowed') {
                    setVoiceStatus('permission_denied');
                    setErrorMsg('Microphone access denied. Please allow microphone permissions.');
                    if (window.toast) {
                        window.toast.error(langSetting === 'ta' ? 'மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது!' : 'Microphone permission denied!');
                    }
                } else {
                    setVoiceStatus('no_speech');
                    setErrorMsg('Voice Error: ' + e.error);
                }
            };

            rec.onend = () => {
                setIsRecognizing(false);
                setIsListening(false);
                setVoiceStatus(prev => {
                    if (prev === 'listening') return 'idle';
                    return prev;
                });
            };

            recognitionRef.current = rec;
            rec.start();
        } catch (err) {
            console.error('Failed to start recognition:', err);
            setIsListening(false);
            setIsRecognizing(false);
        }
    };

    // Clean up on component unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch (e) {
                    console.log('Unmount cleanup failed:', e);
                }
            }
        };
    }, []);

    // Process recognized speech
    const handleVoiceCommand = (commandText) => {
        const parsed = parseMultiLineSpeech(commandText, {
            type,
            entities,
            flowers,
            currentItems: itemsList,
            salesmen,
            lockedCustomer: selectedCustomer
        });

        let matchedSuccessfully = false;

        if (parsed.intent === 'SAVE') {
            setTranscript(langSetting === 'ta' ? 'பதிவு செய்ய "Save Transaction" பொத்தானை கிளிக் செய்யவும்.' : 'Please click "Save Transaction" button to save.');
            setErrorMsg(langSetting === 'ta' ? 'பதிவு செய்ய "Save Transaction" பொத்தானை கிளிக் செய்யவும்.' : 'Please click "Save Transaction" button to save.');
            matchedSuccessfully = true;
        }
        else if (parsed.intent === 'CANCEL') {
            setTranscript(langSetting === 'ta' ? 'ரத்து செய்ய "Cancel" பொத்தானை கிளிக் செய்யவும்.' : 'Please click "Cancel" button to cancel.');
            setErrorMsg(langSetting === 'ta' ? 'ரத்து செய்ய "Cancel" பொத்தானை கிளிக் செய்யவும்.' : 'Please click "Cancel" button to cancel.');
            matchedSuccessfully = true;
        }

        // Invoice Multi-Line Intent
        if (parsed.intent === 'SELECT_CUSTOMER_AND_ADD_ITEMS') {
            const hasInvalidFlower = parsed.items.some(item => !item.flower);
            if (hasInvalidFlower) {
                setErrorMsg(langSetting === 'ta' ? 'பொருந்தும் பதிவு எதுவும் இல்லை. மீண்டும் முயற்சிக்கவும் அல்லது கைமுறையாக தேர்ந்தெடுக்கவும்.' : 'No matching record found. Please try again or select manually.');
                if (window.toast) {
                    window.toast.warning(langSetting === 'ta' ? 'பொருந்தும் பதிவு எதுவும் இல்லை. மீண்டும் முயற்சிக்கவும் அல்லது கைமுறையாக தேர்ந்தெடுக்கவும்.' : 'No matching record found. Please try again or select manually.');
                }
                matchedSuccessfully = true;
            } else if (parsed.customer && parsed.items.length > 0) {
                setSelectedCustomer(parsed.customer);
                const newItems = parsed.items.map(item => ({
                    id: Math.random(),
                    flowerType: item.flower.name,
                    flowerTypeTa: item.flower.taName || item.flower.nameTa || '',
                    quantity: parseFloat(item.quantity).toFixed(2),
                    price: item.price
                }));
                setItemsList(prev => [...prev, ...newItems]);
                setTranscript(`Customer Locked: ${parsed.customer.name} | Added ${newItems.length} items`);
                matchedSuccessfully = true;
                setErrorMsg('');
            }
        } else if (parsed.intent === 'ADD_ITEMS') {
            const hasInvalidFlower = parsed.items.some(item => !item.flower);
            if (hasInvalidFlower) {
                setErrorMsg(langSetting === 'ta' ? 'பொருந்தும் பதிவு எதுவும் இல்லை. மீண்டும் முயற்சிக்கவும் அல்லது கைமுறையாக தேர்ந்தெடுக்கவும்.' : 'No matching record found. Please try again or select manually.');
                if (window.toast) {
                    window.toast.warning(langSetting === 'ta' ? 'பொருந்தும் பதிவு எதுவும் இல்லை. மீண்டும் முயற்சிக்கவும் அல்லது கைமுறையாக தேர்ந்தெடுக்கவும்.' : 'No matching record found. Please try again or select manually.');
                }
                matchedSuccessfully = true;
            } else if (parsed.items.length > 0) {
                const newItems = parsed.items.map(item => ({
                    id: Math.random(),
                    flowerType: item.flower.name,
                    flowerTypeTa: item.flower.taName || item.flower.nameTa || '',
                    quantity: parseFloat(item.quantity).toFixed(2),
                    price: item.price
                }));
                setItemsList(prev => [...prev, ...newItems]);
                setTranscript(`Added ${newItems.length} items to invoice`);
                matchedSuccessfully = true;
                setErrorMsg('');
            }
        } else if (parsed.intent === 'SELECT_CUSTOMER') {
            if (parsed.customer) {
                setSelectedCustomer(parsed.customer);
                setTranscript(`Locked Customer: ${parsed.customer.name}`);
                matchedSuccessfully = true;
            }
        } else if (parsed.intent === 'DELETE') {
            if (parsed.target) {
                setItemsList(prev => prev.filter(item => item.id !== parsed.target.id));
                setTranscript(`Removed ${parsed.target.flowerType}`);
                matchedSuccessfully = true;
            }
        } else if (parsed.intent === 'EDIT') {
            if (parsed.target) {
                setItemsList(prev => prev.map(item => {
                    if (item.id === parsed.target.id) {
                        return { ...item, [parsed.field]: parsed.value };
                    }
                    return item;
                }));
                setTranscript(`Updated ${parsed.target.flowerType} ${parsed.field} to ${parsed.value}`);
                matchedSuccessfully = true;
            }
        }
        
        // Payments / Cash Receive & Pay Intent
        else if (parsed.intent === 'PAYMENT_FORM') {
            if (parsed.entity && (parsed.amount !== null || parsed.cashLess !== null)) {
                setSelectedCustomer(parsed.entity);
                if (parsed.amount !== null) {
                    setPaymentAmount(parsed.amount);
                }
                if (parsed.cashLess !== null) {
                    setCashlessAmount(parsed.cashLess);
                    setPaymentMethod('UPI');
                }
                if (parsed.remarks) {
                    setPaymentNote(parsed.remarks);
                }
                setTranscript(`Parsed Payment details: ${parsed.entity.name} | Cash: ₹${parsed.amount || 0} | UPI: ₹${parsed.cashLess || 0}`);
                matchedSuccessfully = true;
            }
        }

        // Expense Intent
        else if (parsed.intent === 'EXPENSE_FORM') {
            if (parsed.staff && parsed.amount !== null) {
                setSelectedCustomer(parsed.staff);
                setPaymentAmount(parsed.amount);
                if (parsed.category) {
                    setExpenseCategory(parsed.category);
                }
                if (parsed.remarks) {
                    setPaymentNote(parsed.remarks);
                }
                setTranscript(`Parsed Expense details: ${parsed.staff.name} | Amount: ₹${parsed.amount || 0} | Category: ${parsed.category}`);
                matchedSuccessfully = true;
            }
        }

        // Transfer Intent
        else if (parsed.intent === 'TRANSFER_FORM') {
            if (parsed.fromStaff && parsed.toStaff && parsed.amount !== null) {
                setSelectedCustomer(parsed.fromStaff);
                setToStaff(parsed.toStaff);
                setPaymentAmount(parsed.amount);
                if (parsed.remarks) {
                    setPaymentNote(parsed.remarks);
                }
                setTranscript(`Parsed Transfer: From ${parsed.fromStaff.name} to ${parsed.toStaff.name} | ₹${parsed.amount || 0}`);
                matchedSuccessfully = true;
            }
        }

        if (!matchedSuccessfully) {
            setTranscript(`Heard: "${commandText}" (No matching record found)`);
            if (window.toast) {
                window.toast.warning(langSetting === 'ta' ? 'பொருந்தும் பதிவு எதுவும் இல்லை. மீண்டும் முயற்சிக்கவும் அல்லது கைமுறையாக தேர்ந்தெடுக்கவும்.' : 'No matching record found. Please try again or select manually.');
            } else {
                setErrorMsg('No matching record found. Please try again or select manually.');
            }
        }
    };

    const toggleListening = () => {
        if (isListening) {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch (e) {
                    console.log('Abort failed:', e);
                }
            }
            setIsListening(false);
            setVoiceStatus('idle');
        } else {
            startSpeechRecognition();
        }
    };

    const handleConfirmSave = async () => {
        // Mode validation and confirmation payload structure
        if (type === 'buyer' || type === 'vendor' || type === 'sales' || type === 'purchase') {
            if (!selectedCustomer) {
                setErrorMsg('Customer/Vendor selection is required.');
                return;
            }
            if (itemsList.length === 0) {
                setErrorMsg('Please add at least one invoice item.');
                return;
            }
            const invalidItem = itemsList.find(item => !item.flowerType || !item.quantity || parseFloat(item.quantity) <= 0 || !item.price || parseFloat(item.price) <= 0);
            if (invalidItem) {
                setErrorMsg('All items must have valid Quantity and Rate greater than 0.');
                return;
            }
            setErrorMsg('');
            try {
                await onConfirm({
                    customer: selectedCustomer,
                    items: itemsList
                });
                onClose();
            } catch (err) {
                setErrorMsg('Save failed: ' + err.message);
            }
        }

        else if (type === 'cash_receive' || type === 'cash_pay' || type === 'credit' || type === 'debit') {
            if (!selectedCustomer) {
                setErrorMsg('Please select a Customer or Vendor.');
                return;
            }
            const cashVal = parseFloat(paymentAmount) || 0;
            const upiVal = parseFloat(cashlessAmount) || 0;
            if (cashVal + upiVal <= 0) {
                setErrorMsg('Amount must be greater than 0.');
                return;
            }
            setErrorMsg('');
            try {
                await onConfirm({
                    entity: selectedCustomer,
                    amount: cashVal,
                    cashLess: upiVal,
                    note: paymentNote,
                    method: upiVal > 0 ? 'UPI' : paymentMethod
                });
                onClose();
            } catch (err) {
                setErrorMsg('Save failed: ' + err.message);
            }
        }

        else if (type === 'expense') {
            if (!selectedCustomer) {
                setErrorMsg('Please select a Staff member.');
                return;
            }
            const expAmt = parseFloat(paymentAmount) || 0;
            if (expAmt <= 0) {
                setErrorMsg('Expense Amount must be greater than 0.');
                return;
            }
            setErrorMsg('');
            try {
                await onConfirm({
                    staff: selectedCustomer,
                    amount: expAmt,
                    category: expenseCategory,
                    remarks: paymentNote
                });
                onClose();
            } catch (err) {
                setErrorMsg('Save failed: ' + err.message);
            }
        }

        else if (type === 'transfer') {
            if (!selectedCustomer) {
                setErrorMsg('Please select From Staff.');
                return;
            }
            if (!toStaff) {
                setErrorMsg('Please select To Staff.');
                return;
            }
            if (selectedCustomer.id === toStaff.id) {
                setErrorMsg('Source and Destination staff must be different.');
                return;
            }
            const transAmt = parseFloat(paymentAmount) || 0;
            if (transAmt <= 0) {
                setErrorMsg('Transfer Amount must be greater than 0.');
                return;
            }
            setErrorMsg('');
            try {
                await onConfirm({
                    fromStaff: selectedCustomer,
                    toStaff: toStaff,
                    amount: transAmt,
                    remarks: paymentNote
                });
                onClose();
            } catch (err) {
                setErrorMsg('Save failed: ' + err.message);
            }
        }
    };

    // Manual line helpers for Invoice table
    const addManualItem = () => {
        if (!manualItem.flowerType || !manualItem.quantity || !manualItem.price) {
            setErrorMsg('Please enter all manual fields.');
            return;
        }
        const selected = flowers.find(f => f.name === manualItem.flowerType);
        const newItem = {
            id: Math.random(),
            flowerType: manualItem.flowerType,
            flowerTypeTa: selected?.taName || selected?.nameTa || '',
            quantity: parseFloat(manualItem.quantity).toFixed(2),
            price: manualItem.price
        };
        setItemsList(prev => [...prev, newItem]);
        setManualItem({ flowerType: '', flowerTypeTa: '', quantity: '', price: '' });
        setErrorMsg('');
        setTimeout(() => {
            refFlower.current?.focus();
        }, 50);
    };

    const updateItemInline = (itemId, field, val) => {
        setItemsList(prev => prev.map(item => {
            if (item.id === itemId) {
                return { ...item, [field]: val };
            }
            return item;
        }));
    };

    const deleteItemInline = (itemId) => {
        setItemsList(prev => prev.filter(item => item.id !== itemId));
    };

    if (!isOpen) return null;

    // Render configuration title
    const renderTitle = () => {
        if (type === 'buyer' || type === 'sales') return langSetting === 'ta' ? 'குரல் மூலம் விற்பனைப் பதிவு' : 'Voice Sales Entry';
        if (type === 'vendor' || type === 'purchase') return langSetting === 'ta' ? 'குரல் மூலம் கொள்முதல் பதிவு' : 'Voice Purchase Entry';
        if (type === 'cash_receive' || type === 'credit') return langSetting === 'ta' ? 'குரல் வரவு பதிவு' : 'Voice Cash Receive Entry';
        if (type === 'cash_pay' || type === 'debit') return langSetting === 'ta' ? 'குரல் பற்று பதிவு' : 'Voice Cash Payment Entry';
        if (type === 'expense') return langSetting === 'ta' ? 'குரல் செலவுப் பதிவு' : 'Voice Staff Expense Entry';
        if (type === 'transfer') return langSetting === 'ta' ? 'குரல் மாற்றுப் பதிவு' : 'Voice Staff Transfer Entry';
        return 'Voice Transaction Entry';
    };

    // Render forms based on transaction type
    const renderFormSection = () => {
        const isInvoiceMode = (type === 'buyer' || type === 'vendor' || type === 'sales' || type === 'purchase');

        if (isInvoiceMode) {
            const totalQty = itemsList.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
            const grandTotal = itemsList.reduce((sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)), 0);

            return (
                <>
                    {/* Customer manual select if not locked */}
                    {!selectedCustomer && (
                        <div style={styles.sectionCard}>
                            <label style={styles.label}>
                                {type === 'vendor' || type === 'purchase' ? 'Select Farmer/Vendor Manually' : 'Select Customer Manually'}
                            </label>
                            <SearchSelect
                                items={entities}
                                value={selectedCustomer ? selectedCustomer.id : ''}
                                onChange={matched => {
                                    if (matched) setSelectedCustomer(matched);
                                }}
                                placeholder={langSetting === 'ta' ? 'பெயரைத் தேடுக...' : 'Choose Name...'}
                                lang={langSetting}
                            />
                        </div>
                    )}

                    {selectedCustomer && (
                        <>
                            <div style={styles.sectionCard}>
                                <h4 style={styles.cardHeader}>Flower Invoice Items</h4>
                                <div style={styles.tableWrapper}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr style={styles.tableHeaderRow}>
                                                <th style={styles.th}>S.No</th>
                                                <th style={styles.th}>Flower</th>
                                                <th style={{...styles.th, textAlign: 'center'}}>Qty (KG)</th>
                                                <th style={{...styles.th, textAlign: 'center'}}>Rate</th>
                                                <th style={{...styles.th, textAlign: 'right'}}>Amount</th>
                                                <th style={{...styles.th, textAlign: 'center'}}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {itemsList.map((item, idx) => (
                                                <tr key={item.id} style={styles.tableRow}>
                                                    <td style={styles.td}>{idx + 1}</td>
                                                    <td style={styles.td}>
                                                        <select 
                                                            value={item.flowerType}
                                                            onChange={e => {
                                                                const sel = flowers.find(f => f.name === e.target.value);
                                                                updateItemInline(item.id, 'flowerType', e.target.value);
                                                                updateItemInline(item.id, 'flowerTypeTa', sel?.taName || sel?.nameTa || '');
                                                            }}
                                                            style={styles.inlineSelect}
                                                        >
                                                            <option value="">Choose Flower...</option>
                                                            {flowers.map(f => (
                                                                <option key={f.name} value={f.name}>
                                                                    {f.taName ? `${f.name} (${f.taName})` : f.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td style={{...styles.td, textAlign: 'center'}}>
                                                        <input 
                                                            type="number"
                                                            inputMode="decimal"
                                                            value={item.quantity}
                                                            onChange={e => updateItemInline(item.id, 'quantity', e.target.value)}
                                                            style={styles.inlineInput}
                                                        />
                                                    </td>
                                                    <td style={{...styles.td, textAlign: 'center'}}>
                                                        <input 
                                                            type="number"
                                                            inputMode="decimal"
                                                            value={item.price}
                                                            onChange={e => updateItemInline(item.id, 'price', e.target.value)}
                                                            style={styles.inlineInput}
                                                        />
                                                    </td>
                                                    <td style={{...styles.td, textAlign: 'right', fontWeight: 800}}>
                                                        ₹{((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)).toFixed(2)}
                                                    </td>
                                                    <td style={{...styles.td, textAlign: 'center'}}>
                                                        <button 
                                                            onClick={() => deleteItemInline(item.id)}
                                                            style={styles.inlineDeleteBtn}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            
                                            {itemsList.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} style={styles.emptyTableText}>
                                                        No items added. Speak continuous commands (e.g. "Jasmine 10 kilo 100 rupees") or insert manually below.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {itemsList.length > 0 && (
                                    <div style={styles.totalsSummaryContainer}>
                                        <div style={styles.totalBox}>
                                            <span style={styles.totalLabel}>Total Qty</span>
                                            <span style={styles.totalVal}>{totalQty.toFixed(2)} Kg</span>
                                        </div>
                                        <div style={styles.totalBox}>
                                            <span style={styles.totalLabel}>Grand Total</span>
                                            <span style={{...styles.totalVal, color: '#10b981'}}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Manual entry row */}
                            <div style={{...styles.sectionCard, padding: '16px'}}>
                                <h4 style={styles.cardHeaderSmall}>Manual Line Insertion</h4>
                                <div style={styles.manualEntryGrid}>
                                    <SearchSelect
                                        inputRef={refFlower}
                                        items={flowers}
                                        value={manualItem.flowerType}
                                        onChange={sel => {
                                            if (sel) {
                                                setManualItem({
                                                    ...manualItem,
                                                    flowerType: sel.name,
                                                    flowerTypeTa: sel.taName || sel.nameTa || ''
                                                });
                                            } else {
                                                setManualItem({
                                                    ...manualItem,
                                                    flowerType: '',
                                                    flowerTypeTa: ''
                                                });
                                            }
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                refQty.current?.focus();
                                            }
                                        }}
                                        placeholder={langSetting === 'ta' ? 'பூவைத் தேடுக...' : 'Select Flower...'}
                                        lang={langSetting}
                                        style={styles.manualInput}
                                    />
                                    <input 
                                        ref={refQty}
                                        type="number" 
                                        inputMode="decimal"
                                        placeholder="Qty (Kg)"
                                        value={manualItem.quantity}
                                        onChange={e => setManualItem({...manualItem, quantity: e.target.value})}
                                        style={styles.manualInput}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                refRate.current?.focus();
                                            }
                                        }}
                                    />
                                    <input 
                                        ref={refRate}
                                        type="number" 
                                        inputMode="decimal"
                                        placeholder="Rate"
                                        value={manualItem.price}
                                        onChange={e => setManualItem({...manualItem, price: e.target.value})}
                                        style={styles.manualInput}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addManualItem();
                                            }
                                        }}
                                    />
                                    <button onClick={addManualItem} style={styles.manualAddBtn}>
                                        <Plus size={16} /> Add Line
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </>
            );
        }

        // Cash Receive / Cash Pay Forms
        if (type === 'cash_receive' || type === 'cash_pay' || type === 'credit' || type === 'debit') {
            return (
                <div style={styles.sectionCard}>
                    <h4 style={styles.cardHeader}>Transaction Values</h4>
                    
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Select Entity (Customer/Vendor)</label>
                        <SearchSelect
                            items={entities}
                            value={selectedCustomer ? selectedCustomer.id : ''}
                            onChange={ent => setSelectedCustomer(ent)}
                            placeholder={langSetting === 'ta' ? 'பெயரைத் தேடுக...' : 'Select Name...'}
                            lang={langSetting}
                        />
                    </div>

                    <div style={styles.formGridTwo}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Cash Amount (₹)</label>
                            <input 
                                type="number" 
                                inputMode="decimal"
                                value={paymentAmount} 
                                onChange={e => setPaymentAmount(e.target.value)} 
                                style={styles.manualInput}
                                placeholder="0.00"
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>UPI / Cashless Amount (₹)</label>
                            <input 
                                type="number" 
                                inputMode="decimal"
                                value={cashlessAmount} 
                                onChange={e => setCashlessAmount(e.target.value)} 
                                style={styles.manualInput}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div style={styles.formGridTwo}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Payment Method</label>
                            <select 
                                value={paymentMethod} 
                                onChange={e => setPaymentMethod(e.target.value)} 
                                style={styles.selectInput}
                            >
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI / GPay</option>
                                <option value="Ready Cash">Ready Cash</option>
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Remarks / Note</label>
                            <input 
                                type="text" 
                                value={paymentNote} 
                                onChange={e => setPaymentNote(e.target.value)} 
                                style={styles.manualInput}
                                placeholder="Optional note..."
                            />
                        </div>
                    </div>
                </div>
            );
        }

        // Expense Form
        if (type === 'expense') {
            const staffList = salesmen.length > 0 ? salesmen : entities;
            return (
                <div style={styles.sectionCard}>
                    <h4 style={styles.cardHeader}>Expense Details</h4>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Select Staff / Salesman</label>
                        <SearchSelect
                            items={staffList}
                            value={selectedCustomer ? selectedCustomer.id : ''}
                            onChange={staff => setSelectedCustomer(staff)}
                            placeholder={langSetting === 'ta' ? 'பணியாளர் பெயரைத் தேடுக...' : 'Select Staff...'}
                            lang={langSetting}
                        />
                    </div>

                    <div style={styles.formGridTwo}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Amount (₹)</label>
                            <input 
                                type="number" 
                                inputMode="decimal"
                                value={paymentAmount} 
                                onChange={e => setPaymentAmount(e.target.value)} 
                                style={styles.manualInput}
                                placeholder="0.00"
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Category</label>
                            <select 
                                value={expenseCategory} 
                                onChange={e => setExpenseCategory(e.target.value)} 
                                style={styles.selectInput}
                            >
                                <option value="Petrol">Petrol / டீசல்</option>
                                <option value="Food">Food / சாப்பாடு</option>
                                <option value="Maintenance">Maintenance / பராமரிப்பு</option>
                                <option value="Other">Other / இதர செலவு</option>
                            </select>
                        </div>
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Remarks / Note</label>
                        <input 
                            type="text" 
                            value={paymentNote} 
                            onChange={e => setPaymentNote(e.target.value)} 
                            style={styles.manualInput}
                            placeholder="Reason for expense..."
                        />
                    </div>
                </div>
            );
        }

        // Transfer Form
        if (type === 'transfer') {
            const staffList = salesmen.length > 0 ? salesmen : entities;
            return (
                <div style={styles.sectionCard}>
                    <h4 style={styles.cardHeader}>Transfer Details</h4>

                    <div style={styles.formGridTwo}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>From Staff (Sender)</label>
                            <select 
                                value={selectedCustomer ? selectedCustomer.id : ''}
                                onChange={e => {
                                    const staff = staffList.find(s => s.id === e.target.value);
                                    setSelectedCustomer(staff);
                                }}
                                style={styles.selectInput}
                            >
                                <option value="">Select Staff...</option>
                                {staffList.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.nameTa ? `${s.name} - ${s.nameTa}` : s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>To Staff (Recipient)</label>
                            <select 
                                value={toStaff ? toStaff.id : ''}
                                onChange={e => {
                                    const staff = staffList.find(s => s.id === e.target.value);
                                    setToStaff(staff);
                                }}
                                style={styles.selectInput}
                            >
                                <option value="">Select Staff...</option>
                                {staffList.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.nameTa ? `${s.name} - ${s.nameTa}` : s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={styles.formGridTwo}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Transfer Amount (₹)</label>
                            <input 
                                type="number" 
                                inputMode="decimal"
                                value={paymentAmount} 
                                onChange={e => setPaymentAmount(e.target.value)} 
                                style={styles.manualInput}
                                placeholder="0.00"
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>Remarks / Note</label>
                            <input 
                                type="text" 
                                value={paymentNote} 
                                onChange={e => setPaymentNote(e.target.value)} 
                                style={styles.manualInput}
                                placeholder="Optional note..."
                            />
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    const renderVoiceStatus = () => {
        switch (voiceStatus) {
            case 'listening':
                return (
                    <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                        <span style={styles.pulseDot}></span> 🎤 {langSetting === 'ta' ? 'கேட்கிறது...' : 'Listening...'}
                    </span>
                );
            case 'processing':
                return (
                    <span style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                        ⏳ {langSetting === 'ta' ? 'செயலாக்குகிறது...' : 'Processing...'}
                    </span>
                );
            case 'recognized':
                return (
                    <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                        ✅ {langSetting === 'ta' ? 'கண்டறியப்பட்டது' : 'Recognized'}: "{transcript}"
                    </span>
                );
            case 'permission_denied':
                return (
                    <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                        ❌ {langSetting === 'ta' ? 'மைக்ரோஃபோன் அனுமதி தேவை!' : 'Microphone Permission Required'}
                    </span>
                );
            case 'no_speech':
                return (
                    <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                        ❌ {langSetting === 'ta' ? 'குரல் கண்டறியப்படவில்லை' : 'Voice Not Detected'}
                    </span>
                );
            case 'idle':
            default:
                return (
                    <span style={{ color: '#64748b' }}>
                        {transcript ? `"${transcript}"` : (langSetting === 'ta' ? 'குரல் உள்ளீட்டிற்கு காத்திருக்கிறது...' : 'Awaiting voice input...')}
                    </span>
                );
        }
    };

    return createPortal(
        <div style={styles.overlay}>
            <div style={styles.container}>
                {/* Modal Header */}
                <div style={styles.header}>
                    <div style={styles.titleGroup}>
                        <span style={{ fontSize: '26px' }}>🎤</span>
                        <div>
                            <h3 style={styles.title}>{renderTitle()}</h3>
                            <p style={styles.subtitle}>Continuous Voice Transaction Entry</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
                </div>

                <div style={styles.scrollBody}>

                {/* State / Instructions Banner */}
                {!selectedCustomer ? (
                    <div style={{...styles.infoBanner, background: '#fef3c7', border: '1.5px solid #fde68a'}}>
                        <AlertCircle size={16} color="#d97706" />
                        <span style={{color: '#92400e', fontWeight: 700, fontSize: '13px'}}>
                            Step 1: Speak transaction details (e.g. "Asif 500 rupees") or type details manually
                        </span>
                    </div>
                ) : (
                    <div style={{...styles.infoBanner, background: '#ecfdf5', border: '1.5px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Check size={16} color="#059669" />
                                <span style={{color: '#065f46', fontWeight: 700, fontSize: '13px'}}>
                                    Customer Locked: <strong>{selectedCustomer.name}</strong>
                                </span>
                            </div>
                            <div style={{ color: '#065f46', fontWeight: 700, fontSize: '13px', marginLeft: '26px' }}>
                                Items Added: <strong>{itemsList.length}</strong>
                            </div>
                        </div>
                        <button 
                            onClick={() => setSelectedCustomer(null)}
                            style={{
                                padding: '6px 12px', borderRadius: '8px', border: '1px solid #059669',
                                background: '#fff', color: '#059669', fontSize: '11px', fontWeight: 800,
                                cursor: 'pointer', transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#ecfdf5'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                            Change Customer
                        </button>
                    </div>
                )}

                {/* Live Transcript Display */}
                <div style={styles.transcriptBanner}>
                    <span style={styles.transcriptLabel}>Live Speech Command Preview</span>
                    <span style={styles.transcriptText}>
                        {renderVoiceStatus()}
                    </span>
                </div>

                {/* Microphone controller */}
                <div style={styles.controlsRow}>
                    <button 
                        onClick={toggleListening} 
                        style={{
                            ...styles.micToggleBtn, 
                            background: isListening ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)',
                            boxShadow: isListening ? '0 6px 16px rgba(239,68,68,0.25)' : '0 6px 16px rgba(16,185,129,0.25)'
                        }}
                    >
                        {isListening ? (
                            <><MicOff size={18} /> Stop Listening</>
                        ) : (
                            <><Mic size={18} /> Tap to Speak Details</>
                        )}
                    </button>
                    
                    <div style={styles.langSelectors}>
                        <button 
                            onClick={() => setSpeechLang('ta-IN')} 
                            style={{...styles.langSelectorBtn, ...(speechLang === 'ta-IN' ? styles.langSelectorBtnActive : {})}}
                        >
                            Tamil
                        </button>
                        <button 
                            onClick={() => setSpeechLang('en-IN')} 
                            style={{...styles.langSelectorBtn, ...(speechLang === 'en-IN' ? styles.langSelectorBtnActive : {})}}
                        >
                            English
                        </button>
                    </div>
                </div>

                {errorMsg && (
                    <div style={styles.errorAlert}>
                        <AlertCircle size={16} />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* Form Inputs and Data Display */}
                {renderFormSection()}
                </div>

                {/* Dialog Footer Actions */}
                <div style={styles.dialogFooter}>
                    {selectedCustomer && (
                        <button 
                            onClick={() => { setSelectedCustomer(null); setItemsList([]); setToStaff(null); setPaymentAmount(''); setCashlessAmount(''); setPaymentNote(''); }} 
                            style={styles.resetBtn}
                        >
                            <RefreshCw size={16} /> Reset Form
                        </button>
                    )}
                    <div style={{display: 'flex', gap: '12px', marginLeft: 'auto'}}>
                        <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
                        <button 
                            onClick={handleConfirmSave} 
                            disabled={!selectedCustomer}
                            style={{
                                ...styles.saveBtn,
                                opacity: !selectedCustomer ? 0.6 : 1,
                                cursor: !selectedCustomer ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Save Transaction
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

/* ── Premium Glassmorphism styling ── */
const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 999999, padding: '10px', overflow: 'hidden'
    },
    container: {
        background: '#ffffff',
        borderRadius: '20px',
        width: '100%', maxWidth: '780px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        padding: '16px', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
        maxHeight: '96vh', overflow: 'hidden'
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #f1f5f9', paddingBottom: '10px'
    },
    titleGroup: {
        display: 'flex', alignItems: 'center', gap: '10px'
    },
    title: {
        fontSize: '20px', fontWeight: 900, color: '#0f172a',
        fontFamily: 'var(--font-display)', margin: 0, letterSpacing: '-0.02em'
    },
    subtitle: {
        fontSize: '10.5px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase',
        letterSpacing: '0.08em', margin: '2px 0 0 0'
    },
    closeBtn: {
        background: '#f1f5f9', border: 'none', borderRadius: '50%',
        width: '30px', height: '30px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer', color: '#64748b',
        transition: 'all 0.15s'
    },
    infoBanner: {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 14px', borderRadius: '12px'
    },
    transcriptBanner: {
        background: '#f8fafc', border: '1.5px dashed #e2e8f0',
        borderRadius: '12px', padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: '4px'
    },
    transcriptLabel: {
        fontSize: '9px', fontWeight: 850, color: '#64748b', textTransform: 'uppercase',
        letterSpacing: '0.05em'
    },
    transcriptText: {
        fontSize: '13px', fontWeight: 700, color: '#334155', fontStyle: 'italic',
        lineHeight: '1.3'
    },
    pulseDot: {
        width: '8px', height: '8px', borderRadius: '50%',
        background: '#ef4444', display: 'inline-block',
        animation: 'ping 1.2s infinite'
    },
    controlsRow: {
        display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'
    },
    micToggleBtn: {
        padding: '10px 18px', borderRadius: '12px', border: 'none',
        color: '#fff', fontWeight: 800, fontSize: '13px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
        transition: 'transform 0.15s active'
    },
    langSelectors: {
        display: 'flex', gap: '6px', marginLeft: 'auto'
    },
    langSelectorBtn: {
        padding: '6px 12px', borderRadius: '100px', border: '1.5px solid #e2e8f0',
        background: '#fff', fontSize: '11.5px', fontWeight: 700, color: '#64748b',
        cursor: 'pointer', transition: 'all 0.2s'
    },
    langSelectorBtnActive: {
        background: '#10b981', color: '#fff', borderColor: '#10b981'
    },
    errorAlert: {
        background: '#fef2f2', border: '1px solid #fecdd3', borderRadius: '12px',
        padding: '8px 12px', color: '#ef4444', fontSize: '12.5px', fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: '8px'
    },
    sectionCard: {
        background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '14px',
        padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px'
    },
    cardHeader: {
        fontSize: '13px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase',
        letterSpacing: '0.05em', margin: 0
    },
    cardHeaderSmall: {
        fontSize: '11px', fontWeight: 850, color: '#64748b', textTransform: 'uppercase',
        letterSpacing: '0.05em', margin: 0
    },
    label: {
        fontSize: '9.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase',
        letterSpacing: '0.05em', marginBottom: '2px'
    },
    selectInput: {
        padding: '10px 12px', borderRadius: '12px', border: '1.5px solid #e2e8f0',
        fontSize: '13px', fontWeight: 650, color: '#1e293b', outline: 'none',
        background: '#fff', cursor: 'pointer', width: '100%', boxSizing: 'border-box'
    },
    tableWrapper: {
        maxHeight: '360px', overflowY: 'auto', border: '1px solid #f1f5f9',
        borderRadius: '12px'
    },
    table: {
        width: '100%', borderCollapse: 'collapse', textAlign: 'left'
    },
    tableHeaderRow: {
        background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0'
    },
    th: {
        padding: '4px 8px', fontSize: '9px', fontWeight: 800, color: '#64748b',
        textTransform: 'uppercase', letterSpacing: '0.05em'
    },
    tableRow: {
        borderBottom: '1px solid #f1f5f9'
    },
    td: {
        padding: '2px 8px', fontSize: '12px', verticalAlign: 'middle',
        color: '#334155'
    },
    inlineSelect: {
        border: '1.5px solid #e2e8f0', padding: '0 6px', borderRadius: '6px',
        fontSize: '11.5px', fontWeight: 600, outline: 'none', cursor: 'pointer',
        height: '25px', boxSizing: 'border-box'
    },
    inlineInput: {
        border: '1.5px solid #e2e8f0', padding: '0 6px', borderRadius: '6px',
        fontSize: '11.5px', fontWeight: 700, width: '60px', textAlign: 'center',
        outline: 'none', height: '25px', boxSizing: 'border-box'
    },
    inlineDeleteBtn: {
        background: '#fef2f2', border: 'none', borderRadius: '6px',
        width: '22px', height: '22px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer', color: '#ef4444'
    },
    emptyTableText: {
        padding: '30px 15px', textAlign: 'center', color: '#94a3b8',
        fontSize: '12.5px', fontStyle: 'italic'
    },
    totalsSummaryContainer: {
        display: 'flex', justifyContent: 'flex-end', gap: '20px',
        background: '#f8fafc', padding: '8px 14px', borderRadius: '12px',
        border: '1px solid #e2e8f0'
    },
    totalBox: {
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end'
    },
    totalLabel: {
        fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase'
    },
    totalVal: {
        fontSize: '15px', fontWeight: 900, color: '#334155'
    },
    manualEntryGrid: {
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px',
        alignItems: 'center'
    },
    manualInput: {
        padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0',
        fontSize: '12.5px', fontWeight: 600, outline: 'none', width: '100%', boxSizing: 'border-box'
    },
    manualAddBtn: {
        padding: '8px 14px', borderRadius: '8px', border: 'none',
        background: '#6366f1', color: '#fff', fontSize: '12.5px', fontWeight: 750,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
    },
    scrollBody: {
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingRight: '4px',
        margin: '8px 0'
    },
    dialogFooter: {
        display: 'flex', borderTop: '1px solid #f1f5f9', paddingTop: '10px',
        alignItems: 'center', gap: '16px', flexShrink: 0
    },
    resetBtn: {
        padding: '8px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1',
        background: '#fff', color: '#64748b', fontSize: '12.5px', fontWeight: 700,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
    },
    cancelBtn: {
        padding: '8px 16px', borderRadius: '10px', border: '1.5px solid #cbd5e1',
        background: '#fff', color: '#64748b', fontSize: '13px', fontWeight: 750,
        cursor: 'pointer'
    },
    saveBtn: {
        padding: '8px 20px', borderRadius: '10px', border: 'none',
        background: '#10b981', color: '#fff', fontSize: '13px', fontWeight: 850,
        cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)'
    },
    formGroup: {
        display: 'flex', flexDirection: 'column', gap: '4px', width: '100%'
    },
    formGridTwo: {
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%'
    }
};

export default VoiceEntryModal;
