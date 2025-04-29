// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
// Assuming these exist
import { detectHiddenCharacters } from './core/detector';
import { HiddenCharacterInfo } from './core/types';
import { initializeDecorations, applyDecorations, clearDecorations, disposeDecorations } from './ui/decorations';

// Global diagnostic collection
let diagnosticCollection: vscode.DiagnosticCollection;

// Store results in memory. Key is document URI (string), Value is the array of detected characters.
const scanResults = new Map<string, HiddenCharacterInfo[]>();
let outputChannel: vscode.OutputChannel;
// Status Bar Item
let statusBarItem: vscode.StatusBarItem;

/**
 * Triggers a scan using the core detector, updates diagnostics, and applies decorations.
 * @param editor The text editor.
 */
function triggerScanUpdateAndDecorate(editor: vscode.TextEditor | undefined): void {
	if (!editor) {
		// Clear status bar if no editor is active
		updateStatusBar(undefined);
		return;
	}
	const document = editor.document;

	try {
		outputChannel.appendLine(`Scanning ${document.uri.fsPath}...`);
		const text = document.getText();
		const results = detectHiddenCharacters(text); // Use the actual detector
		outputChannel.appendLine(`Scan complete. Found ${results.length} hidden characters in ${document.uri.fsPath}.`);

		// Cache the results
		scanResults.set(document.uri.toString(), results);

		// Update Diagnostics
		updateDiagnostics(document, results);

		// Apply Decorations
		applyDecorations(editor, results);

		// Update Status Bar
		updateStatusBar(editor, results);

	} catch (error: any) {
		outputChannel.appendLine(`Error during scan or update for ${document.uri.fsPath}: ${error.message}`);
		vscode.window.showErrorMessage(`Hidden Character Detector: Error scanning file. See output channel for details.`);
		// Clear potentially stale results/decorations on error
		scanResults.delete(document.uri.toString());
		diagnosticCollection.delete(document.uri);
		clearDecorations(editor);
		// Update status bar to reflect cleared state on error
		updateStatusBar(editor, []);
	}
}

/**
 * Updates the VS Code Problems panel based on scan results.
 * @param document The document that was scanned.
 * @param results The hidden character info found.
 */
function updateDiagnostics(document: vscode.TextDocument, results: HiddenCharacterInfo[]): void {
	if (!diagnosticCollection) {
		return; // Should not happen after activation
	}

	const diagnostics: vscode.Diagnostic[] = results.map(info => {
		// VS Code Range is 0-based
		const line = info.line - 1; // Convert 1-based line to 0-based
		const column = info.column; // Assume detector provides 0-based column

		let range: vscode.Range;
		let message: string;

		// Check if this is a pattern with end coordinates
		if (info.endLine !== undefined && info.endColumn !== undefined) {
			// It's a pattern - create range spanning start to end
			const endLine = info.endLine - 1;
			const endColumn = info.endColumn;

			if (line < 0 || column < 0 || endLine < line || (endLine === line && endColumn < column)) {
                // Add a console log for debugging invalid ranges
                console.warn(`[UpdateDiagnostics] Invalid range coordinates for pattern: Start(${info.line},${info.column}), End(${info.endLine},${info.endColumn}). Skipping diagnostic.`);
                 // Return null or a special marker to filter out later, or handle error appropriately
                 // For simplicity, we'll create a minimal diagnostic at the start point
                range = new vscode.Range(Math.max(0, line), Math.max(0, column), Math.max(0, line), Math.max(0, column + 1));
                message = `Hidden Pattern: ${info.category} - Invalid range detected (Start: L${info.line}C${info.column}, End: L${info.endLine}C${info.endColumn}). ${info.message}`;

            } else {
                 // Range end position is exclusive, so add 1 to the character index
                 range = new vscode.Range(line, column, endLine, endColumn + 1);
                 message = `Hidden Pattern: ${info.category} - ${info.message}`;
            }
		} else {
			// It's a single character
			if (line < 0 || column < 0) {
                 console.warn(`[UpdateDiagnostics] Invalid range coordinates for single character: Start(${info.line},${info.column}). Skipping diagnostic.`);
                 // Return null or handle error
                 range = new vscode.Range(Math.max(0, line), Math.max(0, column), Math.max(0, line), Math.max(0, column + 1));
                 message = `Hidden Character: ${info.category} - Invalid range detected (L${info.line}C${info.column}). ${info.message}`;
            } else {
                // Range end position is exclusive, so add 1
                range = new vscode.Range(line, column, line, column + 1);
                const charDisplay = info.codePoint > 0 ? ` (${info.character} / U+${info.codePoint.toString(16).toUpperCase()})` : ` (${info.character})`;
                message = `Hidden Character: ${info.category}${charDisplay} - ${info.message}`;
            }
		}

		const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
		diagnostic.source = 'Hidden Character Detector';
		// Optional: Add a code for potential filtering or future actions
		// Use a different code for patterns vs single characters
		diagnostic.code = `hidden-${info.category.toLowerCase().replace(/\s+/g, '-')}${(info.endLine !== undefined ? '-pattern' : '')}`;

		return diagnostic;
	});

	// Update the problems panel
	diagnosticCollection.set(document.uri, diagnostics);
	outputChannel.appendLine(`Updated diagnostics for ${document.uri.fsPath} with ${diagnostics.length} problems.`);
}

// --- Status Bar Logic ---
/**
 * Updates the status bar item based on the scan results for the given editor.
 * @param editor The active text editor.
 * @param results Optional results array. If not provided, attempts to use cached results.
 */
function updateStatusBar(editor: vscode.TextEditor | undefined, results?: HiddenCharacterInfo[]): void {
	if (!statusBarItem) {
        return; // Status bar item not initialized yet
    }

	if (!editor) {
		statusBarItem.hide();
		return;
	}

	const currentResults = results ?? scanResults.get(editor.document.uri.toString());

	if (currentResults && currentResults.length > 0) {
		const count = currentResults.length;
		statusBarItem.text = `$(warning) Hidden: ${count}`;
		statusBarItem.tooltip = `${count} hidden character(s) detected. Click to focus Problems panel.`;
		statusBarItem.command = 'workbench.action.problems.focus'; // Command to focus problems panel
		statusBarItem.show();
	} else {
		// Show a neutral state or hide completely
		// statusBarItem.text = `$(pass) No Hidden Chars`;
		// statusBarItem.tooltip = "No hidden characters detected in this file.";
		// statusBarItem.command = undefined; // No command when there are no issues
		// statusBarItem.show();
		// OR simply hide:
		statusBarItem.hide();
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "hidden-character-detector" is now active!');

	outputChannel = vscode.window.createOutputChannel("Hidden Character Detector");
	outputChannel.appendLine('Extension "hidden-character-detector" activating...');

	// Initialize Diagnostic Collection
	diagnosticCollection = vscode.languages.createDiagnosticCollection('hiddenCharacterDetector');
	context.subscriptions.push(diagnosticCollection); // Ensure it's disposed on deactivation

	// Initialize decoration types
	initializeDecorations(context);

	// Initialize Status Bar Item
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100); // Priority 100
	context.subscriptions.push(statusBarItem);
	statusBarItem.text = "$(sync~spin) HCD Scan"; // Initial text while activating/initial scan
	statusBarItem.tooltip = "Hidden Character Detector initializing...";
	statusBarItem.show(); // Show initially, will be updated after scan

	outputChannel.appendLine('Initialization complete.');

	// --- Initial Scan and Decoration ---
	if (vscode.window.activeTextEditor) {
		outputChannel.appendLine(`Initial active editor found: ${vscode.window.activeTextEditor.document.uri.fsPath}. Triggering initial scan.`);

		triggerScanUpdateAndDecorate(vscode.window.activeTextEditor);
	} else {
		outputChannel.appendLine('No active editor found on activation.');
		updateStatusBar(undefined); // Clear status bar if no initial editor
	}

	// --- Event Listeners ---

	// Update diagnostics/decorations when the active editor changes
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor) {
				const docUriString = editor.document.uri.toString();
				outputChannel.appendLine(`Active editor changed: ${editor.document.uri.fsPath}.`);

				if (scanResults.has(docUriString)) {
					// Results are cached: Only update UI elements (decorations, status bar)
					outputChannel.appendLine(`  Using cached results. Updating decorations/status bar only.`);
					const cachedResults = scanResults.get(docUriString) ?? []; // Should exist, but fallback to empty
					applyDecorations(editor, cachedResults);
					updateStatusBar(editor, cachedResults);
				} else {
					// Results not cached: Trigger a full scan, which includes diagnostics update
					outputChannel.appendLine(`  No cached results found. Triggering full scan and update.`);
					triggerScanUpdateAndDecorate(editor);
				}
			} else {
				outputChannel.appendLine(`Active editor changed to undefined.`);
				updateStatusBar(undefined); // Clear status bar if no editor is active
			}
		})
	);

	// Re-scan and update when a text document is saved
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(document => {
			outputChannel.appendLine(`Document saved: ${document.uri.fsPath}.`);
			// Only re-scan/update if the saved document is currently the active one
			// Or perhaps always update if configuration allows? For now, only if active.
			const activeEditor = vscode.window.activeTextEditor;
			// Read configuration
			const scanOnSave = vscode.workspace.getConfiguration('hiddenCharacterDetector').get('scanOnSave', true);

			if (scanOnSave && activeEditor && activeEditor.document === document) {
				outputChannel.appendLine(`Saved document is active. Triggering scan.`);
				triggerScanUpdateAndDecorate(activeEditor);
			} else if (scanOnSave) {
				// If configured to scan on save even if not active, we might update cache/diagnostics
				// but not decorations. For now, let's keep it simple.
				outputChannel.appendLine(`Saved document is not active or scanOnSave is disabled. Scan not triggered.`);
				// Optionally clear cache?
				// scanResults.delete(document.uri.toString());
				// diagnosticCollection.delete(document.uri);
			}
		})
	);

	// Clear diagnostics and cache when a text document is closed
	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument(document => {
			outputChannel.appendLine(`Document closed: ${document.uri.fsPath}. Clearing diagnostics and cache.`);
			// Clear diagnostics from the Problems panel
			diagnosticCollection.delete(document.uri);
			// Clear the results cache
			scanResults.delete(document.uri.toString());
			// If the closed document was the active one, update the status bar
			if (vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString()) {
				// This case should ideally be handled by onDidChangeActiveTextEditor firing
				// but as a fallback, ensure status bar is cleared if the active editor just closed.
				// However, usually another editor becomes active OR activeTextEditor becomes undefined,
				// triggering the other listener. Let's rely on that.
			} else if (!vscode.window.activeTextEditor) {
				// If closing the *last* editor, ensure status bar is hidden
				updateStatusBar(undefined);
			}
		})
	);

	// --- Configuration Listener ---
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('hiddenCharacterDetector')) {
				outputChannel.appendLine('Configuration changed. Consider re-scanning open files or applying new settings.');
			}
		})
	);

	// --- Manual Scan Command ---
	context.subscriptions.push(
		vscode.commands.registerCommand('hiddenCharacterDetector.scanActiveEditor', () => {
			outputChannel.appendLine('Manual scan command triggered.');
			if (vscode.window.activeTextEditor) {
				triggerScanUpdateAndDecorate(vscode.window.activeTextEditor);
				vscode.window.showInformationMessage('Hidden Character Scan Complete.');
			} else {
				vscode.window.showWarningMessage('No active editor to scan.');
			}
		})
	);

	outputChannel.appendLine('Extension "hidden-character-detector" activation finished.');
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Deactivating hidden-character-detector extension.');
	// Dispose of decoration types
	disposeDecorations();
	// Dispose diagnostic collection (clears problems panel)
	diagnosticCollection?.dispose();
	// Dispose status bar item
	statusBarItem?.dispose();
	// Clear the cache
	scanResults.clear();
	// Dispose output channel
	outputChannel?.dispose();
	outputChannel?.appendLine('Extension "hidden-character-detector" deactivating.');
}
