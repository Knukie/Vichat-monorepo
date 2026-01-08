# Threat Model

## Assets
- Authentication token (localStorage).
- Chat content (messages and attachments).
- Uploaded image URLs or data URLs.

## Adversaries
- Hostile host page or other scripts running on the same origin.
- Network attacker (MITM) on insecure transport.
- XSS on the host page or injected third-party scripts.
- Clickjacking or UI redressing.
- Malicious links embedded in chat content.

## Mitigations
- Shadow DOM encapsulation for UI isolation.
- Strict `postMessage` origin checks for authentication events.
- Markdown rendering uses text nodes; links are limited to `https://`.
- Links are opened with `rel="noopener noreferrer"` and `target="_blank"`.
- CSP guidance via strict test pages for host integration.

## Residual Risks
- Host page can access the widget and its shadow root if same-origin scripts are malicious.
- Tokens stored in `localStorage` are exposed to XSS on the host page.
- If `BASE_URL` is misconfigured or served over non-HTTPS, data could be exposed.

## Future Work
- Provide an iframe-hosted embed option with postMessage-only communication.
- Optional token storage in memory-only mode.
- Document recommended CSP and Trusted Types integration for hosts.
