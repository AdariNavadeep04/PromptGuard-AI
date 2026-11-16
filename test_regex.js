const text = "name: rahul, phone number: 9876543210, aadhaar number: 123456789012, pan number: ABCDE1234F";

const phoneDetector = {
        type: 'PHONE',
        pattern: /(?:\+91[\s\-]?|91[\s\-]?|0)?[6-9]\d{9}(?!\d)|(?:phone|mobile|cell|contact|tel|call)[\s\w:]*?(\+?\d[\d\s\-]{6,14}\d)\b/gi,
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

const aadhaarDetector = {
        type: 'AADHAAR',
        pattern: /(?:aadhaar|aadhar|uidai)?[\s:]*(\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b)/gi,
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
            if (digits[0] === '0') return false;
            return true;
        }
    };

let match;
while ((match = phoneDetector.pattern.exec(text)) !== null) {
    const rawValue = match[0];
    const val = phoneDetector.extractValue(rawValue);
    const valid = phoneDetector.validate(rawValue, text, match.index);
    console.log("Phone match:", rawValue, "Val:", val, "Valid:", valid);
}

while ((match = aadhaarDetector.pattern.exec(text)) !== null) {
    const rawValue = match[0];
    const val = aadhaarDetector.extractValue(rawValue);
    const valid = aadhaarDetector.validate(rawValue);
    console.log("Aadhaar match:", rawValue, "Val:", val, "Valid:", valid);
}
