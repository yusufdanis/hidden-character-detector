import * as vscode from 'vscode';
import { HiddenCharacterInfo } from '../core/types';

let hiddenCharacterHighlightDecorationType: vscode.TextEditorDecorationType | undefined;
let hiddenCharacterGutterDecorationType: vscode.TextEditorDecorationType | undefined;

/**
 * Initializes the decoration types needed for highlighting hidden characters.
 * Should be called once during extension activation.
 * @param context The extension context.
 */
export function initializeDecorations(context: vscode.ExtensionContext): void {
    // Dispose of existing decorations if they exist (e.g., during extension reload)
    disposeDecorations();

    // Highlight Decoration: Subtle background, distinct border, visible in overview ruler
    hiddenCharacterHighlightDecorationType = vscode.window.createTextEditorDecorationType({
        // Using theme colors is generally preferred for better adaptability
        backgroundColor: new vscode.ThemeColor('editor.warningBackground'), // Or a specific color like 'rgba(255, 200, 0, 0.2)'
        borderColor: new vscode.ThemeColor('editorWarning.foreground'),     // Or a specific color like 'rgba(255, 150, 0, 0.5)'
        borderStyle: 'solid',
        borderWidth: '1px',
        overviewRulerColor: new vscode.ThemeColor('editorWarning.foreground'), // Color in the scrollbar
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        // Light/Dark theme compatibility
        light: {
            // Optional: Define light theme specific colors if needed
            // borderColor: 'darkred',
        },
        dark: {
            // Optional: Define dark theme specific colors if needed
            // borderColor: 'lightcoral',
        }
    });

    // Gutter Icon Decoration
    const iconPath = vscode.Uri.file(context.asAbsolutePath('icons/hcd-logo.ico'));
    hiddenCharacterGutterDecorationType = vscode.window.createTextEditorDecorationType({
        gutterIconPath: iconPath,
        gutterIconSize: 'contain', // Adjust size as needed
        overviewRulerColor: new vscode.ThemeColor('editorWarning.foreground'), // Also show in overview ruler
        overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    // Add decorations to context subscriptions for proper disposal on deactivation
    if (hiddenCharacterHighlightDecorationType) {
        context.subscriptions.push(hiddenCharacterHighlightDecorationType);
    }
    if (hiddenCharacterGutterDecorationType) {
        context.subscriptions.push(hiddenCharacterGutterDecorationType);
    }
}

/**
 * Applies decorations to the given editor based on the detected hidden characters.
 * @param editor The text editor to apply decorations to.
 * @param hiddenCharacters An array of detected hidden character information.
 */
export function applyDecorations(editor: vscode.TextEditor, hiddenCharacters: HiddenCharacterInfo[]): void {
    if (!hiddenCharacterHighlightDecorationType || !hiddenCharacterGutterDecorationType) {
        console.error('Decoration types not initialized. Call initializeDecorations first.');
        return;
    }

    const highlightOptions: vscode.DecorationOptions[] = [];
    const gutterOptions: vscode.DecorationOptions[] = [];
    const uniqueLines = new Set<number>(); // Store 0-based line numbers for gutter icons

    for (const info of hiddenCharacters) {
        // VS Code API uses 0-based lines and characters
        const lineZeroBased = info.line - 1;
        // Let's assume info.column is the correct 0-based character index on the line.
        const columnZeroBased = info.column;

        if (lineZeroBased < 0 || columnZeroBased < 0) {
            console.warn(`Invalid start range for hidden character/pattern: Line ${info.line}, Column ${info.column}`);
            continue; // Skip invalid entries
        }

        let range: vscode.Range;
        let hoverMessage: string;

        // Check if this is a pattern with end coordinates
        if (info.endLine !== undefined && info.endColumn !== undefined) {
            // It's a pattern - create range spanning start to end
            const endLineZeroBased = info.endLine - 1;
            const endColumnZeroBased = info.endColumn;

            if (endLineZeroBased < lineZeroBased || (endLineZeroBased === lineZeroBased && endColumnZeroBased < columnZeroBased)) {
                console.warn(`Invalid end range for pattern: Start(${info.line},${info.column}), End(${info.endLine},${info.endColumn})`);
                continue; // Skip invalid pattern entry
            }
            // Range end position is exclusive in VS Code, so add 1 to the character index
            range = new vscode.Range(lineZeroBased, columnZeroBased, endLineZeroBased, endColumnZeroBased + 1);
            hoverMessage = `Hidden Pattern: ${info.category}\n${info.message}`;
        } else {
            // It's a single character
            // Range end position is exclusive, so add 1 to the character index
            range = new vscode.Range(lineZeroBased, columnZeroBased, lineZeroBased, columnZeroBased + 1);
            const charDisplay = info.codePoint > 0 ? ` (${info.character} / U+${info.codePoint.toString(16).toUpperCase()})` : ` (${info.character})`;
            hoverMessage = `Hidden Character: ${info.category}${charDisplay}\n${info.message}`;
        }

        highlightOptions.push({ range, hoverMessage });

        // Add line for gutter icon (only once per line)
        // If it's a pattern spanning multiple lines, add gutter icons for all affected lines
        if (info.endLine !== undefined) {
             const endLineZeroBased = info.endLine - 1;
             for (let l = lineZeroBased; l <= endLineZeroBased; l++) {
                 uniqueLines.add(l);
             }
        } else {
            uniqueLines.add(lineZeroBased);
        }
    }

     // Create gutter decoration options for unique lines
     for (const line of uniqueLines) {
        // Place the gutter icon at the beginning of the line
        const gutterRange = new vscode.Range(line, 0, line, 0);
        // Optional: Add hover message to gutter icon too
        // const gutterHoverMessage = "Line contains hidden characters";
        gutterOptions.push({ range: gutterRange /*, hoverMessage: gutterHoverMessage */ });
    }

    // Apply the decorations to the editor
    editor.setDecorations(hiddenCharacterHighlightDecorationType, highlightOptions);
    editor.setDecorations(hiddenCharacterGutterDecorationType, gutterOptions);
}

/**
 * Clears all hidden character decorations from the given editor.
 * @param editor The text editor to clear decorations from.
 */
export function clearDecorations(editor: vscode.TextEditor): void {
    if (hiddenCharacterHighlightDecorationType) {
        editor.setDecorations(hiddenCharacterHighlightDecorationType, []);
    }
    if (hiddenCharacterGutterDecorationType) {
        editor.setDecorations(hiddenCharacterGutterDecorationType, []);
    }
}

/**
 * Disposes of the decoration types. Should be called on extension deactivation.
 */
export function disposeDecorations(): void {
    hiddenCharacterHighlightDecorationType?.dispose();
    hiddenCharacterGutterDecorationType?.dispose();
    hiddenCharacterHighlightDecorationType = undefined;
    hiddenCharacterGutterDecorationType = undefined;
} 