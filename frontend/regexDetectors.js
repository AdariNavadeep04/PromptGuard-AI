/* ============================================================
   Regex Detectors — Modular Registry
   Each detector is a self-contained unit that returns structured
   detection results. Only detects entities that actually exist.
   ============================================================ */

/**
 * @typedef {Object} Detection
 * @property {string} type     - Entity type (e.g. "EMAIL", "PHONE")
 * @property {string} value    - The matched text
 * @property {number} start    - Start index in original text
 * @property {number} end      - End index in original text
 * @property {number} confidence - 0-1 confidence score
 * @property {string} source   - "regex"
 */

const RegexDetectors = (() => {
    'use strict';

    // ----- Individual Detectors -----

    /** Email addresses (simplified RFC 5322) */
    const emailDetector = {
        type: 'EMAIL',
        // Matches standard email addresses
        pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
        confidence: 0.97,
        description: 'Email address'
    };

    /** Indian phone numbers: 10 digits, optional +91/0 prefix, or numbers near phone keywords */
    const phoneDetector = {
        type: 'PHONE',
        pattern: /(?:\+91[\s\-]?|91[\s\-]?|0)?[6-9]\d{9}\b|(?:phone|mobile|cell|contact|tel|call)[^\d]{0,30}?(\+?\d[\d\s\-]{6,14}\d)\b/gi,
        confidence: 0.95,
        description: 'Phone number',
        extractValue: (match) => {
            const numMatch = /(\+?\d[\d\s\-]{6,14}\d)/.exec(match);
            return numMatch ? numMatch[1].trim() : match;
        },
        validate: (match, text, start) => {
            if (start > 0 && /\d/.test(text[start - 1])) return false;
            return true;
        }
    };

    /** Indian PAN: 5 letters + 4 digits + 1 letter, e.g. ABCDE1234F */
    const panDetector = {
        type: 'PAN',
        pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
        confidence: 0.98,
        description: 'Indian PAN (Permanent Account Number)'
    };

    /** Aadhaar-like: 12 digits, optionally space/dash separated in groups of 4 */
    const aadhaarDetector = {
        type: 'AADHAAR',
        pattern: /(?:aadhaar|aadhar|uidai)[^\d]{0,30}?(\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b)|(\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b)/gi,
        confidence: 0.90,
        description: 'Aadhaar 12-digit identifier',
        extractValue: (match) => {
            const m = /(\d{4}[\s\-]?\d{4}[\s\-]?\d{4})/.exec(match);
            return m ? m[1] : match;
        },
        validate: (match) => {
            const m = /(\d{4}[\s\-]?\d{4}[\s\-]?\d{4})/.exec(match);
            if (!m) return false;
            const digits = m[1].replace(/[\s\-]/g, '');
            if (digits.length !== 12) return false;
            if (digits[0] === '0' || digits[0] === '1') return false; // Aadhaar starts with 2-9
            return true;
        }
    };

    /** UPI ID: user@bankname */
    const upiDetector = {
        type: 'UPI',
        // Common UPI handles: @upi, @paytm, @ybl, @oksbi, @okaxis, @okicici, @apl, @ibl, etc.
        pattern: /[a-zA-Z0-9._\-]+@(?:upi|paytm|ybl|oksbi|okaxis|okicici|okhdfc|apl|ibl|sbi|axl|icici|hdfcbank|kotak|boi|pnb|federal|indus|idbi|citi|rbl|yes|dbs|sc|hsbc|axis|jio|freecharge|amazonpay|gpay|phonepe|slice|jupiter|fi)\b/gi,
        confidence: 0.93,
        description: 'UPI ID'
    };

    /** Bank account number: 9-18 digits with context keywords */
    const bankAccountDetector = {
        type: 'BANK_ACCOUNT',
        // Look for account numbers near context words
        pattern: /(?:(?:a\/c|account|acct|acc)[\s.:]*(?:no\.?|number|num|#)?[\s.:]*)?(\d{9,18})\b/gi,
        confidence: 0.70,
        description: 'Bank account number',
        validate: (match, text, start) => {
            // Higher confidence if preceded by context words
            const before = text.substring(Math.max(0, start - 40), start).toLowerCase();
            const hasContext = /(?:a\/c|account|acct|acc|bank|savings|current|deposit)/.test(before);
            return hasContext;
        },
        // Adjust confidence based on context
        adjustConfidence: (match, text, start) => {
            const before = text.substring(Math.max(0, start - 40), start).toLowerCase();
            if (/(?:account|a\/c|acct)[\s.:]*(?:no|number|num|#)?/i.test(before)) return 0.92;
            if (/bank/i.test(before)) return 0.80;
            return 0.70;
        }
    };

    /** IFSC code: 4 letters + 0 + 6 alphanumeric, e.g. SBIN0001234 */
    const ifscDetector = {
        type: 'IFSC',
        pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
        confidence: 0.96,
        description: 'Indian IFSC code'
    };

    /** Credit/Debit card number: 13-19 digits, optionally grouped */
    const cardNumberDetector = {
        type: 'CARD_NUMBER',
        pattern: /\b(?:\d{4}[\s\-]?){3,4}\d{1,4}\b/g,
        confidence: 0.75,
        description: 'Credit/Debit card number',
        validate: (match) => {
            const digits = match.replace(/[\s\-]/g, '');
            if (digits.length < 13 || digits.length > 19) return false;
            // Luhn check
            return luhnCheck(digits);
        },
        adjustConfidence: (match) => {
            const digits = match.replace(/[\s\-]/g, '');
            return luhnCheck(digits) ? 0.94 : 0.60;
        }
    };

    /** API key / Secret: long alphanumeric strings with key-context */
    const apiKeyDetector = {
        type: 'API_KEY',
        pattern: /(?:api[_\-]?key|secret|token|password|passwd|api[_\-]?secret|access[_\-]?key)[\s:="']+([A-Za-z0-9_\-./+=]{16,})/gi,
        confidence: 0.90,
        description: 'API Key / Secret / Token',
        extractValue: (match) => {
            // Return the captured group (the actual key value)
            const m = /[\s:="']+([A-Za-z0-9_\-./+=]{16,})/.exec(match);
            return m ? m[1] : match;
        }
    };

    /** Password in context */
    const passwordDetector = {
        type: 'PASSWORD',
        pattern: /(?:password|passwd|pwd)[\s:="']+(\S{4,})/gi,
        confidence: 0.88,
        description: 'Password',
        extractValue: (match) => {
            const m = /[\s:="']+(\S{4,})/.exec(match);
            return m ? m[1] : match;
        }
    };

    // ----- Luhn Algorithm for card validation -----
    function luhnCheck(num) {
        let sum = 0;
        let alt = false;
        for (let i = num.length - 1; i >= 0; i--) {
            let n = parseInt(num[i], 10);
            if (alt) {
                n *= 2;
                if (n > 9) n -= 9;
            }
            sum += n;
            alt = !alt;
        }
        return sum % 10 === 0;
    }

    // ----- Detector Registry -----
    const registry = [
        emailDetector,
        phoneDetector,
        panDetector,
        aadhaarDetector,
        upiDetector,
        bankAccountDetector,
        ifscDetector,
        cardNumberDetector,
        apiKeyDetector,
        passwordDetector
    ];

    /**
     * Run all regex detectors against the input text.
     * Returns only entities that actually exist in the text.
     * @param {string} text - The user's input text
     * @returns {Detection[]} Array of detections
     */
    function detect(text) {
        if (!text || typeof text !== 'string') return [];

        const detections = [];

        for (const detector of registry) {
            // Reset regex lastIndex for global patterns
            const regex = new RegExp(detector.pattern.source, detector.pattern.flags);
            let match;

            while ((match = regex.exec(text)) !== null) {
                const start = match.index;
                const rawValue = match[0];
                const end = start + rawValue.length;

                // Run custom validation if defined
                if (detector.validate && !detector.validate(rawValue, text, start)) {
                    continue;
                }

                // Extract the meaningful value (some detectors capture groups)
                const value = detector.extractValue
                    ? detector.extractValue(rawValue)
                    : rawValue;

                // Calculate confidence
                let confidence = detector.confidence;
                if (detector.adjustConfidence) {
                    confidence = detector.adjustConfidence(rawValue, text, start);
                }

                detections.push({
                    type: detector.type,
                    value: value,
                    rawMatch: rawValue,
                    start: start,
                    end: end,
                    confidence: confidence,
                    source: 'regex',
                    description: detector.description
                });
            }
        }

        return detections;
    }

    /**
     * Get list of all registered detector types.
     * @returns {string[]}
     */
    function getRegisteredTypes() {
        return registry.map(d => d.type);
    }

    return { detect, getRegisteredTypes };
})();
