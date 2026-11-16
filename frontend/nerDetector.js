/* ============================================================
   NER Detector — Local Named Entity Recognition
   Uses Transformers.js (Xenova) for in-browser NER.
   Falls back to heuristic detection if model cannot load.
   ============================================================ */

const NERDetector = (() => {
    'use strict';

    let pipeline = null;
    let isLoading = false;
    let isAvailable = false;
    let loadError = null;
    let useFallback = false;

    // NER label → entity type mapping (BERT-base-NER labels)
    const labelMap = {
        'B-PER': 'PERSON',
        'I-PER': 'PERSON',
        'B-LOC': 'ADDRESS',
        'I-LOC': 'ADDRESS',
        'B-ORG': 'ORGANIZATION',
        'I-ORG': 'ORGANIZATION',
        'B-MISC': 'MISC',
        'I-MISC': 'MISC'
    };

    /**
     * Attempt to load the Transformers.js NER pipeline.
     * This is called once at startup. If it fails, we fall back to heuristics.
     * @returns {Promise<boolean>} Whether the model loaded successfully
     */
    async function initialize() {
        if (isAvailable || isLoading) return isAvailable;
        isLoading = true;

        try {
            // Dynamically import Transformers.js from CDN
            const { pipeline: createPipeline } = await import(
                'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'
            );

            // Load the NER pipeline with a small model
            pipeline = await createPipeline(
                'token-classification',
                'Xenova/bert-base-NER',
                { quantized: true } // Use quantized model for smaller size
            );

            isAvailable = true;
            isLoading = false;
            return true;
        } catch (err) {
            console.warn('[NERDetector] Model failed to load, using heuristic fallback:', err.message);
            loadError = err.message;
            useFallback = true;
            isLoading = false;
            return false;
        }
    }

    /**
     * Run NER detection using the loaded model.
     * @param {string} text
     * @returns {Promise<Detection[]>}
     */
    async function detectWithModel(text) {
        if (!pipeline) return [];

        try {
            const results = await pipeline(text, { ignore_labels: ['O'] });

            // Group consecutive tokens of the same entity
            const entities = [];
            let current = null;

            for (const token of results) {
                const entityType = labelMap[token.entity] || null;
                if (!entityType) continue;

                const isBegin = token.entity.startsWith('B-');
                const isContinue = token.entity.startsWith('I-');

                if (isBegin || (isContinue && (!current || current.type !== entityType))) {
                    // Start new entity
                    if (current) entities.push(current);
                    current = {
                        type: entityType,
                        value: token.word.replace(/^##/, ''),
                        start: token.start,
                        end: token.end,
                        confidence: token.score,
                        source: 'ner'
                    };
                } else if (isContinue && current && current.type === entityType) {
                    // Extend current entity
                    const word = token.word.replace(/^##/, '');
                    // Handle subword tokens (starting with ##)
                    if (token.word.startsWith('##')) {
                        current.value += word;
                    } else {
                        current.value += ' ' + word;
                    }
                    current.end = token.end;
                    // Average confidence across tokens
                    current.confidence = (current.confidence + token.score) / 2;
                }
            }

            if (current) entities.push(current);

            // Clean up values: extract actual text from input using positions
            return entities.map(e => ({
                type: e.type,
                value: text.substring(e.start, e.end).trim(),
                start: e.start,
                end: e.end,
                confidence: Math.round(e.confidence * 100) / 100,
                source: 'ner',
                description: `${e.type} (NER)`
            }));
        } catch (err) {
            console.error('[NERDetector] Model inference failed:', err);
            return heuristicDetect(text);
        }
    }

    /**
     * Heuristic NER fallback — simple pattern-based name/address detection.
     * This is NOT as accurate as ML-based NER but provides basic coverage.
     * @param {string} text
     * @returns {Detection[]}
     */
    function heuristicDetect(text) {
        const detections = [];

        // --- Person names ---
        // Look for patterns like "my name is X", "I am X", "I'm X", "name: X"
        const namePatterns = [
            /(?:my\s+name\s+is|i\s+am|i'm|name\s*[:=]\s*)[\s]*([a-zA-Z]+(?:\s+[a-zA-Z]+){0,3})/gi,
            /(?:mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?|shri|smt)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,3})/gi,
            /(?:dear|hi|hello|hey|to|from|cc|bcc)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/gi
        ];

        // Common words and job titles that should NOT be detected as names
        const commonWords = new Set([
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
            'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
            'how', 'its', 'may', 'new', 'now', 'old', 'see', 'way', 'who', 'did',
            'got', 'let', 'say', 'she', 'too', 'use', 'write', 'leave', 'email',
            'professor', 'sir', 'madam', 'please', 'kindly', 'need', 'days',
            'manager', 'boss', 'director', 'lead', 'hr', 'supervisor', 'team',
            'colleague', 'employee', 'admin', 'user', 'client', 'customer',
            'recruiter', 'interviewer', 'management', 'department', 'company',
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
            'january', 'february', 'march', 'april', 'june', 'july', 'august',
            'september', 'october', 'november', 'december', 'urgent', 'important',
            'subject', 'dear', 'regards', 'thanks', 'thank'
        ]);

        for (const pattern of namePatterns) {
            const regex = new RegExp(pattern.source, pattern.flags);
            let match;
            while ((match = regex.exec(text)) !== null) {
                const name = match[1].trim();
                // Filter out common words and very short matches
                if (name.length < 2) continue;
                const words = name.split(/\s+/);
                const isCommon = words.every(w => commonWords.has(w.toLowerCase()));
                if (isCommon) continue;

                // Find the actual position of the captured name in the full text
                const nameStart = text.indexOf(name, match.index);
                if (nameStart === -1) continue;

                detections.push({
                    type: 'PERSON',
                    value: name,
                    start: nameStart,
                    end: nameStart + name.length,
                    confidence: 0.75,
                    source: 'ner-heuristic',
                    description: 'Person name (heuristic)'
                });
            }
        }

        // --- Addresses ---
        // Look for Indian-style address patterns
        const addressPatterns = [
            /(?:address|addr|located\s+at|lives?\s+at|residing\s+at)[\s:]*(.{10,80}?)(?:\.|,\s*(?:pin|zip|phone|email|and)|$)/gi,
            /\b(\d{1,5}[,\s]+(?:[A-Z][a-zA-Z]+[\s,]+){2,}(?:road|street|lane|nagar|colony|block|sector|phase|area|city|town|district|state|village)\b.{0,40})/gi
        ];

        for (const pattern of addressPatterns) {
            const regex = new RegExp(pattern.source, pattern.flags);
            let match;
            while ((match = regex.exec(text)) !== null) {
                const addr = (match[1] || match[0]).trim();
                if (addr.length < 10) continue;

                detections.push({
                    type: 'ADDRESS',
                    value: addr,
                    start: match.index,
                    end: match.index + match[0].length,
                    confidence: 0.65,
                    source: 'ner-heuristic',
                    description: 'Address (heuristic)'
                });
            }
        }

        // --- Organizations ---
        const orgPatterns = [
            /(?:company|organization|org|employer|work\s+at|employed\s+at|working\s+at)[\s:]*([A-Z][A-Za-z\s&.]+(?:Ltd\.?|Inc\.?|Corp\.?|Pvt\.?|Limited|Private|Technologies|Solutions|Services|Bank|University|College|Institute|Hospital)?)/gi,
            /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+(?:Ltd\.?|Inc\.?|Corp\.?|Pvt\.?\s*Ltd\.?|Limited|Private\s+Limited|Technologies|Solutions|Services|Bank|University|College|Institute|Hospital))\b/g
        ];

        for (const pattern of orgPatterns) {
            const regex = new RegExp(pattern.source, pattern.flags);
            let match;
            while ((match = regex.exec(text)) !== null) {
                const org = (match[1] || match[0]).trim();
                if (org.length < 3) continue;

                const orgStart = text.indexOf(org, match.index);
                if (orgStart === -1) continue;

                detections.push({
                    type: 'ORGANIZATION',
                    value: org,
                    start: orgStart,
                    end: orgStart + org.length,
                    confidence: 0.70,
                    source: 'ner-heuristic',
                    description: 'Organization (heuristic)'
                });
            }
        }

        return detections;
    }

    /**
     * Main detection entry point.
     * Uses model if available, falls back to heuristics.
     * @param {string} text
     * @returns {Promise<Detection[]>}
     */
    async function detect(text) {
        if (!text || typeof text !== 'string') return [];

        if (isAvailable && pipeline) {
            return detectWithModel(text);
        }

        // Fallback to heuristic
        return heuristicDetect(text);
    }

    /**
     * Get current NER status.
     * @returns {{ available: boolean, loading: boolean, useFallback: boolean, error: string|null }}
     */
    function getStatus() {
        return {
            available: isAvailable,
            loading: isLoading,
            useFallback: useFallback,
            error: loadError
        };
    }

    return {
        initialize,
        detect,
        getStatus,
        heuristicDetect
    };
})();
