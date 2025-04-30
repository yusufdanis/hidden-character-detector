import * as vscode from 'vscode';
import { TextDecoder } from 'util'; // Import TextDecoder for Uint8Array -> string conversion
import * as micromatch from 'micromatch'; // Import micromatch
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

// --- Automatic Workspace Scan Globals ---
let workspaceScanIntervalTimer: NodeJS.Timeout | undefined = undefined;
let isWorkspaceScanRunning = false;

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

	const diagnostics: vscode.Diagnostic[] = results
		.map(info => createDiagnostic(info, document.uri)) // Use helper
		.filter((d): d is vscode.Diagnostic => d !== null); // Filter out nulls

	// Update the problems panel
	// Check if the document still exists before setting diagnostics
	// This helps prevent errors if the document was closed rapidly during a slow scan
	try {
		// Attempt to get the document. If it throws, the document is likely closed.
		vscode.workspace.textDocuments.find(doc => doc.uri.toString() === document.uri.toString());
		diagnosticCollection.set(document.uri, diagnostics);
		outputChannel.appendLine(`Updated diagnostics for ${document.uri.fsPath} with ${diagnostics.length} problems.`);
	} catch (error) {
		outputChannel.appendLine(`Skipped setting diagnostics for closed document: ${document.uri.fsPath}`);
	}
}

// Helper function to convert HiddenCharacterInfo to vscode.Diagnostic
// Extracted from updateDiagnostics for reuse in workspace scan
function createDiagnostic(info: HiddenCharacterInfo, documentUriForContext?: vscode.Uri): vscode.Diagnostic | null {
	// VS Code Range is 0-based
	const line = info.line - 1; // Convert 1-based line to 0-based
	const column = info.column; // Assume detector provides 0-based column

	let range: vscode.Range;
	let message: string;

	// Check if this is a pattern with end coordinates
	if (info.endLine !== undefined && info.endColumn !== undefined) {
		// It's a pattern
		const endLine = info.endLine - 1;
		const endColumn = info.endColumn;

		if (line < 0 || column < 0 || endLine < line || (endLine === line && endColumn < column)) {
			console.warn(`[CreateDiagnostic] Invalid range coordinates for pattern: Start(${info.line},${info.column}), End(${info.endLine},${info.endColumn}) ${documentUriForContext ? `in ${documentUriForContext.fsPath}` : ''}. Skipping.`);
			return null; // Return null for invalid range
		} else {
			// Range end position is exclusive, so add 1 to the character index
			range = new vscode.Range(line, column, endLine, endColumn + 1);
			message = `Hidden Pattern: ${info.category} - ${info.message}`;
		}
	} else {
		// It's a single character
		if (line < 0 || column < 0) {
			console.warn(`[CreateDiagnostic] Invalid range coordinates for single character: Start(${info.line},${info.column}) ${documentUriForContext ? `in ${documentUriForContext.fsPath}` : ''}. Skipping.`);
			return null; // Return null for invalid range
		} else {
			// Range end position is exclusive, so add 1
			range = new vscode.Range(line, column, line, column + 1);
			const charDisplay = info.codePoint > 0 ? ` (${info.character} / U+${info.codePoint.toString(16).toUpperCase()})` : ` (${info.character})`;
			message = `Hidden Character: ${info.category}${charDisplay} - ${info.message}`;
		}
	}

	// Append exclusion guidance
	const exclusionGuidance = " (If this is intentional or the file should not be scanned, consider adding it to 'hiddenCharacterDetector.excludePatterns' in your settings.)";
	message += exclusionGuidance;

	const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
	diagnostic.source = 'Hidden Character Detector';
	diagnostic.code = `hidden-${info.category.toLowerCase().replace(/\s+/g, '-')}${(info.endLine !== undefined ? '-pattern' : '')}`;

	return diagnostic;
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
                    // Re-apply diagnostics from cache as well
                    updateDiagnostics(editor.document, cachedResults);
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
			outputChannel.appendLine(`Document closed: ${document.uri.fsPath}. Clearing cache.`);
			// Clear the results cache
			scanResults.delete(document.uri.toString());
			// NOTE: We don't clear diagnostics here. If the file still exists, workspace scan
			// or re-opening will repopulate them. If the file was deleted, onDidDeleteFiles handles it.
			// Update status bar if necessary (handled by onDidChangeActiveTextEditor)
			 if (!vscode.window.activeTextEditor) {
				// If closing the *last* editor, ensure status bar is hidden
				updateStatusBar(undefined);
			}
		})
	);

	// Clear diagnostics and cache when file(s) are deleted from the workspace
	context.subscriptions.push(
		vscode.workspace.onDidDeleteFiles(event => {
			outputChannel.appendLine(`Files deleted: ${event.files.map(f => f.fsPath).join(', ')}`);
			for (const fileUri of event.files) {
				outputChannel.appendLine(`  Clearing diagnostics and cache for deleted file: ${fileUri.fsPath}`);
				diagnosticCollection.delete(fileUri);
				scanResults.delete(fileUri.toString());
			}
			// Re-check active editor status bar in case the deleted file was active
			// (though onDidChangeActiveTextEditor should handle this)
			// Optional safety check:
			if (vscode.window.activeTextEditor && event.files.some(deletedUri => deletedUri.toString() === vscode.window.activeTextEditor?.document.uri.toString())) {
			    // If the active editor's file was just deleted, it will likely become undefined soon,
			    // triggering onDidChangeActiveTextEditor which calls updateStatusBar(undefined).
			    // Explicitly calling updateStatusBar(undefined) here might be redundant or cause flicker.
			    // Relying on onDidChangeActiveTextEditor is cleaner.
			} else if (!vscode.window.activeTextEditor) {
			    updateStatusBar(undefined); // Ensure status bar is hidden if no editor is active after delete
			}
		})
	);

	// --- Configuration Listener ---
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('hiddenCharacterDetector')) {
				outputChannel.appendLine('Configuration changed. Applying new settings...');
				// Re-initialize the automatic scan based on new settings
				setupAutomaticWorkspaceScan();
			}
		})
	);

	// --- Workspace Scan Command ---
	context.subscriptions.push(
		vscode.commands.registerCommand('hiddenCharacterDetector.scanWorkspace', async () => {
			await performWorkspaceScan(true); // Perform scan with progress notification
		})
	);

	// --- Initialize Automatic Scan based on initial config ---
	setupAutomaticWorkspaceScan();

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

	// Clear automatic scan timer
	if (workspaceScanIntervalTimer) {
		clearInterval(workspaceScanIntervalTimer);
		workspaceScanIntervalTimer = undefined;
		outputChannel.appendLine('Cleared automatic workspace scan timer.');
	}
}

// --- Helper function to setup (or clear) the automatic workspace scan interval ---
function setupAutomaticWorkspaceScan(): void {
	// Clear existing timer first
	if (workspaceScanIntervalTimer) {
		clearInterval(workspaceScanIntervalTimer);
		workspaceScanIntervalTimer = undefined;
		outputChannel.appendLine('Cleared previous automatic scan interval.');
	}

	const config = vscode.workspace.getConfiguration('hiddenCharacterDetector');
	const enabled = config.get<boolean>('automaticWorkspaceScan.enabled', false);
	const intervalSeconds = config.get<number>('automaticWorkspaceScan.intervalSeconds', 300); // Read seconds

	if (enabled) {
		const intervalMilliseconds = Math.max(10, intervalSeconds) * 1000; // Ensure minimum 10 seconds
		outputChannel.appendLine(`Setting up automatic workspace scan every ${intervalSeconds} seconds.`);

		// Run the scan immediately first (without progress)
		// Use setTimeout to avoid blocking activation and handle potential async errors gracefully
		setTimeout(async () => {
			outputChannel.appendLine('Performing initial automatic workspace scan...');
			await performWorkspaceScan(false);
		}, 100); // Small delay to ensure activation is fully complete

		// Then set the interval for subsequent scans
		workspaceScanIntervalTimer = setInterval(async () => {
			await performWorkspaceScan(false); // Perform scan without progress notification
		}, intervalMilliseconds);
	} else {
		outputChannel.appendLine('Automatic workspace scan is disabled.');
	}
}

// --- Refactored Workspace Scan Implementation ---
async function performWorkspaceScan(showProgress: boolean, token?: vscode.CancellationToken): Promise<void> {
	if (isWorkspaceScanRunning) {
		outputChannel.appendLine('Workspace scan requested, but one is already in progress. Skipping.');
		return;
	}
	isWorkspaceScanRunning = true;
	outputChannel.appendLine(`Starting workspace scan... (ShowProgress: ${showProgress})`);

	try {
		if (showProgress) {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Scanning workspace for hidden characters...",
				cancellable: true
			}, async (progress, progressToken) => {
				await runScanLogic(showProgress, progress, progressToken);
			});
		} else {
			// For background scan, create a simple cancellation source that we control
			// (Though cancellation isn't strictly necessary here unless we want to stop it mid-run)
			const cancellationSource = new vscode.CancellationTokenSource();
			await runScanLogic(showProgress, undefined, cancellationSource.token);
		}
	} catch (error) {
		outputChannel.appendLine(`Error during workspace scan: ${error}`);
		vscode.window.showErrorMessage('Hidden Character Detector: Error during workspace scan. See output channel.');
	} finally {
		isWorkspaceScanRunning = false;
		outputChannel.appendLine('Workspace scan finished.');
	}
}

// Core logic, takes optional progress and token
async function runScanLogic(showProgress: boolean, progress?: vscode.Progress<{ message?: string; increment?: number }>, token?: vscode.CancellationToken): Promise<void> {
	outputChannel.appendLine('Starting workspace scan logic...');
	let totalFilesScanned = 0;
	let totalHiddenFound = 0;

	// 1. Get configuration
	const config = vscode.workspace.getConfiguration('hiddenCharacterDetector');
	const excludePatternsArray = config.get<string[]>('excludePatterns', []); // Get patterns as an array

	// Combine the array into a single glob string for the exclude parameter
	// Use brace expansion {p1,p2,...}. If the array is empty, use null.
	const excludeGlob = excludePatternsArray.length > 0 ? `{${excludePatternsArray.join(',')}}` : null;

	outputChannel.appendLine(`Exclusion glob pattern: ${excludeGlob ?? 'N/A'}`);

	// 2. Find files, passing the combined exclude glob directly
	// This is much more efficient as VS Code's finder will skip excluded directories/files.
	const files = await vscode.workspace.findFiles('**/*', excludeGlob, undefined, token);
	const totalFiles = files.length; // This is now the count of *non-excluded* files
	outputChannel.appendLine(`Found ${totalFiles} files to scan (after exclusions).`);

	// Log the actual URIs found for debugging
	if (totalFiles > 0) {
		outputChannel.appendLine(`  First file: ${files[0].fsPath}`);
		outputChannel.appendLine(`  Last file: ${files[totalFiles - 1].fsPath}`);
	}

	if (totalFiles === 0) {
		outputChannel.appendLine('No files found to scan.');
		if (progress) {
            progress.report({ message: 'Workspace Scan: No files found.' });
        }
		// Explicitly clear any stale diagnostics if no files are found after exclusions
		diagnosticCollection.clear();
		outputChannel.appendLine('Cleared all diagnostics as no files were found to scan.');
		return;
	}

	const increment = totalFiles > 0 ? 100 / totalFiles : 0;

	// 3. Process files
	let i = 0; // Declare i outside the loop for logging after
	for (i = 0; i < totalFiles; i++) {
		const fileUri = files[i];
		const fileUriString = fileUri.toString(); // Use string form for map/set keys

		if (token?.isCancellationRequested) {
			outputChannel.appendLine('Workspace scan cancelled by user.');
			vscode.window.showInformationMessage('Workspace scan cancelled.');
			return; // Do not update diagnostics if cancelled
		}

		const relativePath = vscode.workspace.asRelativePath(fileUri, false);
		outputChannel.appendLine(`Processing file ${i + 1}/${totalFiles}: ${relativePath}...`); // Added per-file log

		totalFilesScanned++; // Increment scanned count (all files reaching here are scanned)
		if (progress) {
            progress.report({ increment, message: `Scanning: ${relativePath}...` });
        }

		try {
			// Read file content as Uint8Array first to handle potential encoding issues
			const fileContentBytes = await vscode.workspace.fs.readFile(fileUri);
			// Use TextDecoder for safe conversion (defaults to UTF-8)
			const decoder = new TextDecoder('utf-8', { fatal: false }); // Allow lenient decoding
			const fileContent = decoder.decode(fileContentBytes);

			const results = detectHiddenCharacters(fileContent);

			if (results.length > 0) {
				totalHiddenFound += results.length;
				// outputChannel.appendLine(`Found ${results.length} hidden characters in ${relativePath}.`); // Reduce log noise

				const fileDiagnostics = results
					.map(info => createDiagnostic(info, fileUri)) // Pass URI for context in logs
					.filter((d): d is vscode.Diagnostic => d !== null); // Filter out nulls

				if (fileDiagnostics.length > 0) {
					// Update cache immediately for this file
					scanResults.set(fileUriString, results);
					// **Set diagnostics incrementally**
					diagnosticCollection.set(fileUri, fileDiagnostics);
					// outputChannel.appendLine(`  Set ${fileDiagnostics.length} diagnostics for ${relativePath}`); // Optional detailed log
				} else {
                    // If diagnostics were filtered out (e.g., invalid ranges), clear cache and diagnostics
                    scanResults.delete(fileUriString);
					// **Clear diagnostics incrementally**
					diagnosticCollection.delete(fileUri);
                }
			} else {
				// Clear cache and diagnostics if no hidden characters found
				scanResults.delete(fileUriString);
				// **Clear diagnostics incrementally**
			}

			// Add a small delay to prevent UI freezing on very large workspaces
			// await new Promise(resolve => setTimeout(resolve, 5)); // Keep commented unless needed

		} catch (error: any) {
			// Handle file read errors (e.g., binary files, permissions)
			outputChannel.appendLine(`Error scanning file ${relativePath}: ${error.message}`);
			// Clear cache and ensure no diagnostics are set for errored file
			scanResults.delete(fileUriString);
			// **Clear diagnostics incrementally on error**
			diagnosticCollection.delete(fileUri);
		}
	}

	// Log after loop completion
	outputChannel.appendLine(`Finished processing loop. Final index i = ${i}, totalFiles = ${totalFiles}.`);

	// 4. Final update
	const finalMessage = `Workspace Scan Complete: ${totalHiddenFound} issue(s) found in ${totalFilesScanned} scanned files.`;
	if (progress) {
		// Use totalFilesScanned which reflects the number actually processed
		// Update the progress notification message
		progress.report({ increment: 100, message: finalMessage });
	}
	// Adjust final log message to reflect that totalFiles is already the post-exclusion count
	outputChannel.appendLine(`Workspace scan complete. Scanned ${totalFilesScanned} files. Found ${totalHiddenFound} hidden characters.`);

	// Only show the final notification if this was a manual scan (showProgress is true)
	if (showProgress) {
		vscode.window.showInformationMessage(`Workspace scan complete. Found ${totalHiddenFound} hidden character(s) in ${totalFilesScanned} files.`);
	}

	// Update status bar based on the active editor AFTER the workspace scan completes
	// This prevents the status bar from potentially showing stale info during the scan
	const activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		const activeResults = scanResults.get(activeEditor.document.uri.toString());
		updateStatusBar(activeEditor, activeResults); // Use cached results if available
	} else {
		updateStatusBar(undefined); // Clear status bar if no active editor
	}
}
