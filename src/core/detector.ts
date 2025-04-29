import { HiddenCharacterInfo } from './types';
import { allHiddenChars } from './hiddenCharacters';

// Define the set of characters considered part of the binary encoding pattern
const BINARY_ENCODING_CHARS: Set<string> = new Set([
    '\u200B', // Zero Width Space
    '\u200C', // Zero Width Non-Joiner
    '\u200D', // Zero Width Joiner
    '\uFEFF', // Zero Width No-Break Space / BOM
    '\u2062', // INVISIBLE TIMES (Observed in test-sneaky-bits.txt)
    '\u2064', // INVISIBLE PLUS (Observed in test-sneaky-bits.txt)
]);

// Minimum length for a sequence to be considered a pattern
const MIN_PATTERN_LENGTH = 8;

/**
 * Detects hidden Unicode characters and binary encoding patterns within a given text.
 *
 * @param text The input text string to scan.
 * @returns An array of HiddenCharacterInfo objects for each detected hidden character or pattern,
 *          or an empty array if none are found.
 */
export function detectHiddenCharacters(text: string): HiddenCharacterInfo[] {
    const results: HiddenCharacterInfo[] = [];
    let line = 1;
    let currentLineStartIndex = 0;

    let i = 0;
    while (i < text.length) {
        const startIndex = i;
        const startLine = line;
        const startColumn = i - currentLineStartIndex;
        const startChar = text[i];
        const startCodePoint = text.codePointAt(i);
        const isStartSurrogate = startCodePoint !== undefined && startCodePoint > 0xFFFF;
        const startCharToCheck = isStartSurrogate ? String.fromCodePoint(startCodePoint) : startChar;

        // --- Pattern Detection Logic ---
        let patternEndIndex = -1;
        let patternEndLine = -1;
        let patternEndColumn = -1;
        let patternLength = 0;

        if (startCodePoint !== undefined && BINARY_ENCODING_CHARS.has(startCharToCheck)) {
            let patternI = i;
            let currentPatternLine = line;
            let currentPatternLineStartIndex = currentLineStartIndex;

            while (patternI < text.length) {
                const patternChar = text[patternI];
                const patternCodePoint = text.codePointAt(patternI);
                const isPatternSurrogate = patternCodePoint !== undefined && patternCodePoint > 0xFFFF;
                const patternCharToCheck = isPatternSurrogate ? String.fromCodePoint(patternCodePoint) : patternChar;

                if (patternCodePoint !== undefined && BINARY_ENCODING_CHARS.has(patternCharToCheck)) {
                    patternLength++;
                    patternEndIndex = patternI;
                    patternEndLine = currentPatternLine;
                    patternEndColumn = patternI - currentPatternLineStartIndex;

                    // Update line/col tracking *within* the pattern loop
                    if (patternChar === '\n') {
                        currentPatternLine++;
                        currentPatternLineStartIndex = patternI + 1;
                    }

                    if (isPatternSurrogate) {
                        patternI++; // Advance inner loop index for surrogate
                    }
                } else {
                    break; // Character not part of the pattern
                }
                patternI++; // Advance inner loop index
            }
        }

        if (patternLength >= MIN_PATTERN_LENGTH && startCodePoint !== undefined) {
            // Found a pattern long enough
            results.push({
                character: `[Binary Pattern (${patternLength} chars)]`,
                codePoint: -1, // Placeholder
                index: startIndex,
                line: startLine,
                column: startColumn,
                endIndex: patternEndIndex,
                endLine: patternEndLine,
                endColumn: patternEndColumn,
                category: 'BinaryEncodingPattern',
                message: `Potential binary encoding detected using a sequence of ${patternLength} zero-width characters.`,
            });
            // Advance main loop index past the detected pattern
            const next_i = i + patternLength;
            i = next_i;
            // Need to update main line/col state based on pattern traversal
            line = patternEndLine;
            currentLineStartIndex = text.lastIndexOf('\n', patternEndIndex);
            currentLineStartIndex = (currentLineStartIndex === -1) ? 0 : currentLineStartIndex + 1;

            // --- End of Pattern Handling ---
        } else {
            if (patternLength > 0) {
            }
            // --- Original Single Character Detection Logic (if no pattern or pattern too short) ---
            const hiddenInfo = allHiddenChars.get(startCharToCheck);

            if (hiddenInfo && startCodePoint !== undefined) {
                results.push({
                    character: `U+${startCodePoint.toString(16).toUpperCase().padStart(4, '0')}`,
                    codePoint: startCodePoint,
                    index: startIndex,
                    line: startLine,
                    column: startColumn,
                    category: hiddenInfo.category,
                    message: hiddenInfo.message,
                });
            } else if (!BINARY_ENCODING_CHARS.has(startCharToCheck) && startChar !== '\n' && startChar !== '\r') {
            }

            // Update line and column tracking for the single character
            if (startChar === '\n') {
                line++;
                currentLineStartIndex = i + 1;
            }

            // Advance main loop index
            let next_i = i;
            if (isStartSurrogate) {
                next_i++; // Advance extra for surrogate
            }
            next_i++; // Advance for the current character
            i = next_i;
            // --- End of Single Character Handling ---
        }
    }

    return results;
} 