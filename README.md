# Hidden Character Detector

This VS Code extension helps you identify potentially problematic hidden Unicode characters and sequences within your code and text files. These characters can sometimes be used to obfuscate code or cause unexpected behavior.

## Features

*   **Detects Individual Hidden Characters:** Scans files for various categories of invisible or non-rendering characters, including:
    *   **Zero-Width Characters:** (e.g., `U+200B` Zero Width Space)
    *   **Bidirectional Control Characters:** (e.g., `U+202E` Right-to-Left Override) which can alter text display order.
    *   **Deprecated Tag Characters:** (e.g., `U+E0001` Language Tag)
    *   **Variation Selectors:** Which can modify the appearance of preceding characters.
*   **Detects Potential Binary Encoding:** Identifies sequences (8 characters or more) of specific zero-width characters often used to hide binary data or malicious scripts within text.
*   **Provides Detailed Information:** For each finding, the extension shows:
    *   The character (e.g., `U+200B`) or pattern type.
    *   Its exact location (line, column).
    *   The category of the character (e.g., "Zero-Width", "Bidirectional Control").
    *   A message explaining the potential risk or purpose.

## Installation

1.  Open **Visual Studio Code** or any compatible VS Code-based IDE.
2.  Go to the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3.  Search for "Hidden Character Detector".
4.  Click **Install**.
5.  Alternatively, launch VS Code Quick Open (`Ctrl+P` or `Cmd+P`), paste `ext install yusufdanis.hidden-character-detector`, and press Enter.

## Usage

The extension automatically scans open files or files within the workspace (depending on configuration, if any). Findings will be highlighted in the editor and/or listed in the Problems panel (`Ctrl+Shift+M` or `Cmd+Shift+M`).

## Known Issues

*   Currently, there are no known issues. Please report any bugs you find!

## Release Notes

See the [CHANGELOG.md](CHANGELOG.md) file for details on each release.

## Contributing

Contributions are welcome! Please refer to the contribution guidelines (if you create a CONTRIBUTING.md file) or open an issue/pull request on the repository.

[GitHub Repository](https://github.com/yusufdanis/hidden-character-detector)

## License

[MIT License](LICENSE.md)