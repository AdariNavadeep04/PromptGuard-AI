/* ============================================================
   Output Checker — Scans LLM response for sensitive information
   that may have leaked into the output.
   ============================================================ */

const OutputChecker = (() => {
    'use strict';

    /**
     * Scan the LLM response for sensitive information.
     * Uses the same regex detectors + checks against known session values.
     *
     * @param {string} response - LLM response text
     * @param {Object} session - Current session data (for known value cross-reference)
     * @returns {{ safe: boolean, findings: Object[] }}
     */
    function scan(response, session) {
        if (!response || typeof response !== 'string') {
            return { safe: true, findings: [] };
        }

        const findings = [];

        // Step 1: Run regex detectors on the output
        const regexDetections = RegexDetectors.detect(response);

        for (const det of regexDetections) {
            findings.push({
                type: det.type,
                value: det.value,
                start: det.start,
                end: det.end,
                confidence: det.confidence,
                source: 'output-regex',
                reason: `The AI response contains what appears to be ${det.description || det.type} information.`
            });
        }

        // Step 2: Cross-reference against known session values
        // Check if any original values from the session appear in the response
        if (session && session.placeholderEngine) {
            const mappings = session.placeholderEngine.getAllMappings();
            // Note: we check for the placeholder's original value presence
            // but we don't expose it — we only flag it
            for (const mapping of mappings) {
                const original = session.placeholderEngine.getOriginal(mapping.placeholder);
                if (original && response.includes(original)) {
                    // Check if this value was supposed to be removed
                    const decision = session.userDecisions[mapping.placeholder];
                    if (decision === 'REMOVE' || decision === 'MASK') {
                        findings.push({
                            type: mapping.type,
                            value: '••••••', // Don't expose the actual value
                            placeholder: mapping.placeholder,
                            source: 'cross-reference',
                            reason: `The AI response appears to contain ${mapping.type} information that was supposed to be ${decision === 'REMOVE' ? 'removed' : 'masked'}.`,
                            severity: 'HIGH'
                        });
                    }
                }
            }
        }

        return {
            safe: findings.length === 0,
            findings
        };
    }

    /**
     * Mask sensitive findings in the response.
     * @param {string} response
     * @param {Object[]} findings
     * @returns {string} Masked response
     */
    function maskFindings(response, findings) {
        let result = response;

        // Sort by position (reverse) to maintain correct indices
        const sortedFindings = [...findings]
            .filter(f => f.start != null && f.end != null)
            .sort((a, b) => b.start - a.start);

        for (const finding of sortedFindings) {
            const masked = `[${finding.type}_REDACTED]`;
            result = result.substring(0, finding.start) + masked + result.substring(finding.end);
        }

        return result;
    }

    /**
     * Block the entire response (replace with warning).
     * @returns {string}
     */
    function blockResponse() {
        return '⚠️ The AI response was blocked because it contained sensitive information that should not have been included.';
    }

    return { scan, maskFindings, blockResponse };
})();
