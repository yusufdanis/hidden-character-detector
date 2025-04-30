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
                const isVS16 = startCodePoint === 0xFE0F;
                const isZWJ = startCodePoint === 0x200D;

                let skipDiagnostic = false;

                // Helper function to get code point at a given string index, handling surrogates
                const getCodePoint = (txt: string, index: number): number | undefined => {
                    if (index < 0 || index >= txt.length) {
                        return undefined;
                    }
                    // Check if it's the start of a surrogate pair
                    const charCode = txt.charCodeAt(index);
                    if (charCode >= 0xD800 && charCode <= 0xDBFF && index + 1 < txt.length) {
                        const nextCharCode = txt.charCodeAt(index + 1);
                        if (nextCharCode >= 0xDC00 && nextCharCode <= 0xDFFF) {
                            return txt.codePointAt(index); // Return full code point for surrogate pair
                        }
                    }
                    // Check if it's the low surrogate of a pair (and adjust index if needed)
                    // Although text.codePointAt should handle this, being explicit helps reasoning
                    if (charCode >= 0xDC00 && charCode <= 0xDFFF && index > 0) {
                         const prevCharCode = txt.charCodeAt(index - 1);
                         if (prevCharCode >= 0xD800 && prevCharCode <= 0xDBFF) {
                             return txt.codePointAt(index - 1); // Get code point from the start of the pair
                         }
                    }
                    return charCode; // Return char code for non-surrogate or isolated surrogate
                };

                 // Helper function to get the index of the *start* of the character *before* the given index
                 // This needs to handle surrogate pairs and trailing VS16 (U+FE0F)
                 const getPreviousBaseCharStartIndex = (txt: string, index: number): number => {
                    if (index <= 0) {
                        return -1;
                    }

                    let relevantIndex = index - 1; // Start by looking at the char code right before index

                    // Step 1: Check if the char at relevantIndex is VS16. If so, move index back.
                    if (relevantIndex >= 0 && txt.codePointAt(relevantIndex) === 0xFE0F) {
                        relevantIndex--;
                        if (relevantIndex < 0) {
                            return -1; // Only had VS16
                        }
                    }

                    // Step 2: Check if the char at the (potentially adjusted) relevantIndex is a low surrogate.
                    const charCode = txt.charCodeAt(relevantIndex);
                    if (charCode >= 0xDC00 && charCode <= 0xDFFF && relevantIndex > 0) {
                        const prevCharCode = txt.charCodeAt(relevantIndex - 1);
                        if (prevCharCode >= 0xD800 && prevCharCode <= 0xDBFF) {
                            // It's a surrogate pair, return index of the high surrogate.
                            return relevantIndex - 1;
                        }
                    }

                    // Otherwise, relevantIndex points to the start of a single char or an isolated surrogate.
                    return relevantIndex;
                 };


                if (isVS16) {
                    // Heuristic for VS16: Skip if preceded by a non-control/non-separator character
                    const prevBaseCharIndex = getPreviousBaseCharStartIndex(text, startIndex);
                    if (prevBaseCharIndex !== -1) {
                        const prevCodePoint = text.codePointAt(prevBaseCharIndex);
                        if (prevCodePoint) {
                            skipDiagnostic = !/\p{C}|\p{Z}/u.test(String.fromCodePoint(prevCodePoint));
                        }
                    }
                } else if (isZWJ) {
                    // Heuristic for ZWJ: Skip ONLY if joining FROM an Emoji component 
                    // AND followed by a potential component or VS16.
                    let precededByEmojiComponent = false;
                    let succeededByPotentialComponent = false;

                    // Check preceding character (base character before any VS16)
                    // Must have Emoji or Emoji_Modifier_Base property
                    const prevBaseCharIndex = getPreviousBaseCharStartIndex(text, startIndex);
                    const prevCodePoint = prevBaseCharIndex !== -1 ? text.codePointAt(prevBaseCharIndex) : undefined;
                    if (prevCodePoint) {
                        // Use Unicode property escapes: \p{Emoji}, \p{Emoji_Modifier_Base}
                        precededByEmojiComponent = /\p{Emoji}|\p{Emoji_Modifier_Base}/u.test(String.fromCodePoint(prevCodePoint));
                    }

                    // Check succeeding character (index right after the ZWJ)
                    // Can be VS16 or any non-control/non-separator
                    const nextCharIndex = startIndex + 1; // ZWJ is never surrogate
                    const nextCodePoint = nextCharIndex < text.length ? text.codePointAt(nextCharIndex) : undefined;
                    if (nextCodePoint) {
                        succeededByPotentialComponent = nextCodePoint === 0xFE0F || !/\p{C}|\p{Z}/u.test(String.fromCodePoint(nextCodePoint));
                    }

                    skipDiagnostic = precededByEmojiComponent && succeededByPotentialComponent;

                    // --- DEBUG LOGGING START ---
                    /* if (startLine === 26 && startColumn === 18) { // Adjusted column index for logging
                         // Log only for the specific problematic case in _test/emoji.txt
                         console.log(`[HCD Debug] ZWJ at ${startLine}:${startColumn} (Index ${startIndex})`);
                         console.log(`  - Prev Base Index: ${prevBaseCharIndex}`);
                         console.log(`  - Prev Code Point: ${prevCodePoint ? 'U+' + prevCodePoint.toString(16).toUpperCase() : 'N/A'}`);
                         console.log(`  - Preceded OK?: ${precededByPotentialEmoji}`);
                         console.log(`  - Next Index: ${nextCharIndex}`);
                         console.log(`  - Next Code Point: ${nextCodePoint ? 'U+' + nextCodePoint.toString(16).toUpperCase() : 'N/A'}`);
                         console.log(`  - Succeeded OK?: ${succeededByPotentialEmoji}`);
                         console.log(`  - Skip Diagnostic?: ${skipDiagnostic}`);
                    } */
                    // --- DEBUG LOGGING END ---
                }

                // Only add the diagnostic if we haven't decided to skip it
                if (!skipDiagnostic) {
                    results.push({
                        character: `U+${startCodePoint.toString(16).toUpperCase().padStart(4, '0')}`,
                        codePoint: startCodePoint,
                        index: startIndex,
                        line: startLine,
                        column: startColumn,
                        category: hiddenInfo.category,
                        message: hiddenInfo.message,
                    });
                }
            } else if (!BINARY_ENCODING_CHARS.has(startCharToCheck) && startChar !== '\n' && startChar !== '\r') {
                 // Explicitly do nothing if it's not a hidden char and not a newline/carriage return
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