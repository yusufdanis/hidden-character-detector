/**
 * Represents information about a detected hidden character.
 * Matches the structure returned by detector.ts
 */
export interface HiddenCharacterInfo {
    /**
     * The actual character or its representation (e.g., U+200B).
     * Note: detector.ts currently provides the U+xxxx representation.
     */
    character: string;
    /**
     * The Unicode code point (number).
     */
    codePoint: number;
    /**
     * Zero-based index in the full text where the character starts.
     */
    index: number;
    /**
     * One-based line number where the character was found.
     */
    line: number;
    /**
     * Zero-based column number within the line where the character starts.
     */
    column: number;
    /**
     * The category of the hidden character (e.g., 'Zero-width', 'Bidirectional').
     */
    category: string;
    /**
     * A brief description of the potential risk or purpose of the character.
     */
    message: string;

    // Optional fields for pattern range detection
    /**
     * Zero-based index in the full text where the pattern *ends* (inclusive).
     * Only present for patterns spanning multiple characters.
     */
    endIndex?: number;
    /**
     * One-based line number where the pattern *ends*.
     * Only present for patterns spanning multiple lines.
     */
    endLine?: number;
    /**
     * Zero-based column number within the line where the pattern *ends* (inclusive).
     * Only present for patterns.
     */
    endColumn?: number;
} 