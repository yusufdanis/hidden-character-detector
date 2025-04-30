# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.3] - 2024-07-30
### Added
- **Workspace Scanning:** New command (`Hidden Character: Scan Entire Workspace`) and automatic background scanning for all workspace files.
- **Automatic Workspace Scan Configuration:** Settings (`hiddenCharacterDetector.automaticWorkspaceScan.enabled`, `hiddenCharacterDetector.automaticWorkspaceScan.intervalSeconds`) to control background scans.
- **Exclusion Configuration:** New setting (`hiddenCharacterDetector.excludePatterns`) to exclude specific files/folders (using glob patterns) from all scans. Includes a comprehensive list of defaults for common build artifacts, dependencies, and binary files.
- **Additional Character Detection:** Added detection for `U+2028` (Line Separator), `U+2029` (Paragraph Separator), and `U+180E` (Mongolian Vowel Separator).

### Changed
- **Improved Emoji Handling:** Reduced false positives by adding heuristics to ignore common `U+FE0F` (VS16) and `U+200D` (ZWJ) usage within valid emoji sequences.
- **Refined Diagnostic Messages:** Included guidance on using the `excludePatterns` setting in diagnostic messages.
- **Updated `package.json` Description:** Improved extension description for clarity.
- **Configuration Change Handling:** Settings changes now correctly re-initialize automatic scanning.

### Fixed
- Ensured diagnostics and decorations are properly reapplied when switching back to an already scanned editor tab.
- Improved clearing of diagnostics and cache when files are closed or deleted.
- Enhanced diagnostic range calculation and added checks for invalid ranges.
- Refactored workspace scanning for better progress reporting, cancellation, and error handling.

## [0.0.2] - 2024-07-29
### Fixed
- Updated VS Code engine compatibility to work with Cursor (VS Code ^1.96.0).

## [0.0.1] - 2024-07-29
### Added
- Initial release of the Hidden Character Detector extension.