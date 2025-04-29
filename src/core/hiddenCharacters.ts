/**
 * Defines sets of Unicode characters considered potentially hidden or harmful.
 */

// Using string literals with escape sequences for clarity

// Category: Zero-Width Characters
// These characters take up no space and can be used to subtly alter text or trigger unexpected behavior.
export const zeroWidthChars = new Set<string>([
    '\u200B', // Zero Width Space
    '\u200C', // Zero Width Non-Joiner
    '\u200D', // Zero Width Joiner
    '\uFEFF', // Zero Width No-Break Space (also BOM)
]);
export const ZERO_WIDTH_CATEGORY = "Zero-Width";
export const ZERO_WIDTH_MESSAGE = "Zero-width character; invisible but can affect text processing.";

// Category: Bidirectional Control Characters
// These characters can change the display order of text, potentially obfuscating code logic or URLs.
export const bidiControlChars = new Set<string>([
    // LTR/RTL Embeddings
    '\u202A', // Left-to-Right Embedding
    '\u202B', // Right-to-Left Embedding
    '\u202D', // Left-to-Right Override
    '\u202E', // Right-to-Left Override
    // Isolates
    '\u2066', // Left-to-Right Isolate
    '\u2067', // Right-to-Left Isolate
    '\u2068', // First Strong Isolate
    '\u2069', // Pop Directional Isolate
    // Explicit Marks (less common for obfuscation but included for completeness)
    // '\u200E', // Left-to-Right Mark (LRM)
    // '\u200F', // Right-to-Left Mark (RLM)
    // Deprecated Formatting Characters (Included as they affect directionality)
    '\u202C', // Pop Directional Formatting
]);
export const BIDI_CONTROL_CATEGORY = "Bidirectional Control";
export const BIDI_CONTROL_MESSAGE = "Bidirectional control character; can alter text display order, potentially obfuscating logic.";

// Category: Deprecated Unicode Tag Characters
// These were intended for language tagging but are deprecated and can be abused.
const tagCharsList: string[] = [];
for (let i = 0xE0000; i <= 0xE007F; i++) {
    tagCharsList.push(String.fromCodePoint(i));
}
export const deprecatedTagChars = new Set<string>(tagCharsList);
export const DEPRECATED_TAG_CATEGORY = "Deprecated Tag";
export const DEPRECATED_TAG_MESSAGE = "Deprecated Unicode tag character; may be used for obfuscation.";

// Category: Variation Selectors
// While having legitimate uses, they can be used in sequences to resemble other characters (confusables).
// VS1-VS16 (U+FE00-U+FE0F)
const variationSelectorsPart1: string[] = [];
for (let i = 0xFE00; i <= 0xFE0F; i++) {
    variationSelectorsPart1.push(String.fromCodePoint(i));
}
// VS17-VS256 (U+E0100-U+E01EF)
const variationSelectorsPart2: string[] = [];
for (let i = 0xE0100; i <= 0xE01EF; i++) {
    variationSelectorsPart2.push(String.fromCodePoint(i));
}
export const variationSelectors = new Set<string>([
    ...variationSelectorsPart1,
    ...variationSelectorsPart2,
]);
export const VARIATION_SELECTOR_CATEGORY = "Variation Selector";
export const VARIATION_SELECTOR_MESSAGE = "Variation selector; while sometimes legitimate, can be used in confusable character sequences.";

// Combine all sets for easier detection
export const allHiddenChars = new Map<string, { category: string; message: string }>([
    ...Array.from(zeroWidthChars).map(char => [char, { category: ZERO_WIDTH_CATEGORY, message: ZERO_WIDTH_MESSAGE }] as [string, { category: string; message: string }]),
    ...Array.from(bidiControlChars).map(char => [char, { category: BIDI_CONTROL_CATEGORY, message: BIDI_CONTROL_MESSAGE }] as [string, { category: string; message: string }]),
    ...Array.from(deprecatedTagChars).map(char => [char, { category: DEPRECATED_TAG_CATEGORY, message: DEPRECATED_TAG_MESSAGE }] as [string, { category: string; message: string }]),
    ...Array.from(variationSelectors).map(char => [char, { category: VARIATION_SELECTOR_CATEGORY, message: VARIATION_SELECTOR_MESSAGE }] as [string, { category: string; message: string }]),
]);