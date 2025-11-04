# Privacy Policy

Coda Markdown Export (coda-md-export)

Last updated: November 4, 2025

This browser extension exports Coda documents to Markdown and related archive formats. We are committed to keeping your data private and describing clearly how the extension accesses and uses data.

What information we access

- Coda document content (text, images, attachments, links) — only when you explicitly request an export for a given document.
- A user-provided Coda API key or browser authentication token — stored locally in the extension storage to make calls to the Coda API when you initiate an export.
- Minimal local preferences and temporary cache data needed to resume or re-run exports (timestamps, export settings).

What we do with the information

- Exported document content is converted into Markdown/archives and saved or downloaded to your device at your request.
- API keys and preferences are stored locally in browser extension storage. They are used only to call Coda APIs on your behalf.
- We do not read from the clipboard; the extension may write exported content to the clipboard only when you explicitly choose "Copy".

Remote services and optional remote code

- The extension makes HTTPS requests to Coda APIs and to cloud storage URLs (for example, S3) to retrieve exports. These network calls are performed only when you initiate an export.
- The extension may offer optional, user-initiated remote conversion or update checks. Any remote code or service usage is opt-in, integrity-checked, and clearly described before you enable it.

Data sharing and transfers

- We do not sell your data or share it with third parties except as needed to provide the export functionality (for example, fetching export files from Coda's storage endpoints) or as required by law.
- If you opt into an optional remote conversion service, data sent to that service will be described and require your explicit consent.

Security

- All network transmissions of personal or sensitive data are performed over HTTPS.
- API keys and any sensitive data stored locally are kept in browser extension storage; we do not transmit stored keys to developer servers unless you explicitly enable a feature that requires it.

Limited Use disclosure
This extension accesses Coda document content and a user-provided Coda API key only to export documents to Markdown or downloadable archives. Data is used solely to perform the export and is not used for advertising, profiling, or human review except with explicit user consent (for example, optional support cases). Exports occur only when you initiate them; we do not collect browsing history or other site data.

Contact and support
For questions or support, open an issue in the project repository: https://github.com/professor-eggs/coda-md-export.
