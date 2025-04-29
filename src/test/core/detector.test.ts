import { detectHiddenCharacters } from '../../core/detector';
import { HiddenCharacterInfo } from '../../core/types';
import {
    BIDI_CONTROL_CATEGORY,
    BIDI_CONTROL_MESSAGE,
    DEPRECATED_TAG_CATEGORY,
    DEPRECATED_TAG_MESSAGE,
    VARIATION_SELECTOR_CATEGORY,
    VARIATION_SELECTOR_MESSAGE,
    ZERO_WIDTH_CATEGORY,
    ZERO_WIDTH_MESSAGE
} from '../../core/hiddenCharacters';


describe('detectHiddenCharacters', () => {
    it('should return an empty array for an empty string', () => {
        expect(detectHiddenCharacters('')).toEqual([]);
    });

    it('should return an empty array for text with no hidden characters', () => {
        expect(detectHiddenCharacters('Hello world')).toEqual([]);
    });

    it('should detect a single zero-width space', () => {
        const text = 'Hello\u200Bworld'; // U+200B
        const expected: HiddenCharacterInfo[] = [
            {
                character: 'U+200B',
                codePoint: 0x200B,
                index: 5,
                line: 1,
                column: 5,
                category: ZERO_WIDTH_CATEGORY,
                message: ZERO_WIDTH_MESSAGE,
            },
        ];
        expect(detectHiddenCharacters(text)).toEqual(expected);
    });

    it('should detect multiple different hidden characters on the same line', () => {
        const text = 'Hel\u200Blo\u202Aworld\uFE0F'; // U+200B, U+202A, U+FE0F
        const expected: HiddenCharacterInfo[] = [
            {
                character: 'U+200B',
                codePoint: 0x200B,
                index: 3,
                line: 1,
                column: 3,
                category: ZERO_WIDTH_CATEGORY,
                message: ZERO_WIDTH_MESSAGE,
            },
            {
                character: 'U+202A',
                codePoint: 0x202A,
                index: 6,
                line: 1,
                column: 6,
                category: BIDI_CONTROL_CATEGORY,
                message: BIDI_CONTROL_MESSAGE,
            },
            {
                character: 'U+FE0F',
                codePoint: 0xFE0F,
                index: 12,
                line: 1,
                column: 12,
                category: VARIATION_SELECTOR_CATEGORY,
                message: VARIATION_SELECTOR_MESSAGE,
            },
        ];
        expect(detectHiddenCharacters(text)).toEqual(expected);
    });

    it('should detect hidden characters at the beginning and end of a string', () => {
        const text = '\uFEFFHello world\u200D'; // U+FEFF, U+200D
        const expected: HiddenCharacterInfo[] = [
            {
                character: 'U+FEFF',
                codePoint: 0xFEFF,
                index: 0,
                line: 1,
                column: 0,
                category: ZERO_WIDTH_CATEGORY,
                message: ZERO_WIDTH_MESSAGE,
            },
            {
                character: 'U+200D',
                codePoint: 0x200D,
                index: 12,
                line: 1,
                column: 12,
                category: ZERO_WIDTH_CATEGORY,
                message: ZERO_WIDTH_MESSAGE,
            },
        ];
        expect(detectHiddenCharacters(text)).toEqual(expected);
    });

    it('should correctly calculate line and column numbers', () => {
        const text = 'Line 1\nLine 2 has \u200Ca ZWNJ\nLine\u20663'; // U+200C, U+2066
        const expected: HiddenCharacterInfo[] = [
            {
                character: 'U+200C',
                codePoint: 0x200C,
                index: 18, // 'L'(11) 'i'(12) 'n'(13) 'e'(14) ' '(15) '2'(16) ' '(17) 'h'(18)
                line: 2,
                column: 11, // Zero-based column
                category: ZERO_WIDTH_CATEGORY,
                message: ZERO_WIDTH_MESSAGE,
            },
            {
                character: 'U+2066',
                codePoint: 0x2066,
                index: 30, // Correct zero-based index for \u2066
                line: 3,
                column: 4, // Zero-based column
                category: BIDI_CONTROL_CATEGORY,
                message: BIDI_CONTROL_MESSAGE,
            },
        ];
        const results = detectHiddenCharacters(text);
        expect(results).toEqual(expected);
        // console.log("Multi-line results:", results);
    });

    it('should handle surrogate pairs correctly (like variation selectors > U+FFFF)', () => {
        // U+E0100 is VS17, represented by surrogate pair \uDB40\uDD00 in UTF-16
        const text = 'Test \u{E0100} VS17';
        const expected: HiddenCharacterInfo[] = [
            {
                character: 'U+E0100', // Stored as U+ representation
                codePoint: 0xE0100,
                index: 5, // Index where the surrogate pair starts
                line: 1,
                column: 5,
                category: VARIATION_SELECTOR_CATEGORY,
                message: VARIATION_SELECTOR_MESSAGE,
            },
        ];
        expect(detectHiddenCharacters(text)).toEqual(expected);
    });

    it('should detect deprecated tag characters', () => {
        // U+E0001 is a deprecated tag character
        const text = 'Tag \u{E0001} here';
        const expected: HiddenCharacterInfo[] = [
            {
                character: 'U+E0001',
                codePoint: 0xE0001,
                index: 4,
                line: 1,
                column: 4,
                category: DEPRECATED_TAG_CATEGORY,
                message: DEPRECATED_TAG_MESSAGE,
            },
        ];
        expect(detectHiddenCharacters(text)).toEqual(expected);
    });

    // Add more tests for edge cases, different categories, etc.
}); 