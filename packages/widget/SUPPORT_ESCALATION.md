# Support Escalation Playbook

## Collect

- Diagnostics output (`window.__VALKI_DIAG__()` if available)
- Widget version + loader URL
- Screenshots or screen recordings
- Console errors (copy/paste)
- CSP headers or meta tag content
- Browser + version, OS
- Embed mode (shadow vs iframe)
- Host site URL + environment (prod/staging)

## Reproduction Steps

1. Note the exact page and path.
2. Capture the embed snippet used.
3. List user actions leading to the issue.
4. Capture whether the issue persists in a clean profile/incognito.

## Triage Checklist

- Auth
  - Login flow blocked or popup prevented?
  - Token stored/cleared properly?
- Uploads
  - File input blocked by CSP or file size?
- CSP
  - `script-src`/`style-src` allow widget assets?
  - `connect-src` allows API base URL?
- Iframe
  - Host allows `postMessage` origin?
  - Sandbox/allow attributes misconfigured?
- Host CSS
  - Host styles overriding widget buttons or inputs?

## Severity Guidelines

- **P0**: Widget fails to load for all users; no workaround.
- **P1**: Core chat flow blocked for many users; limited workaround.
- **P2**: Partial feature degradation (uploads/auth); workaround available.
- **P3**: Cosmetic or low-impact bugs; no user data loss.
