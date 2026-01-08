# Valki Talki QA Gates

## Bundle size
- [ ] Main bundle (public/valki-talki-main.*.js) is < 120kb gzip (guideline).

## CSP tests
- [ ] Host1..Host5 CSP pages load without CSP violations.
- [ ] No inline scripts required for installation when using data attributes.

## Auth flow sanity
- [ ] OAuth popup and return flow completes.
- [ ] Token postMessage origin check restricts to BASE_URL origin.

## Uploads
- [ ] Accepts png/jpg only.
- [ ] Max 4 attachments per message.
- [ ] Max 5MB per image.

## Console hygiene
- [ ] No console errors on happy path (no login, default usage).
- [ ] Errors only log on intentional failures (network offline, auth error).

## Accessibility smoke
- [ ] Escape key closes overlay/auth.
- [ ] Buttons include aria-labels where appropriate.
- [ ] Inputs are focusable and visible when opened.

## Security
- [ ] No HTML injection in bot messages (renders as text/markdown only).
- [ ] Links use `rel="noopener noreferrer"` and `target="_blank"`.
