# Manual test plan - ViChat widget

## Scenario A: Login -> close -> reopen (overlay always opens)
1. Open the widget and log in.
2. Close the widget overlay.
3. Click the bubble to reopen.
4. Confirm the overlay opens immediately and messages load.

**Expected**
- Overlay opens immediately on bubble click.
- Messages render once load completes.
- No “dead click.”

**Expected console logs**
- `[ViChat debug] ensure overlay open` (reason `bubble click`).

## Scenario B: Login -> token corrupt -> close -> reopen (401/403 handling)
1. Log in and confirm messages load.
2. Corrupt the auth token in localStorage (e.g. set to `invalid`).
3. Close the widget overlay.
4. Click the bubble to reopen.

**Expected**
- Overlay opens immediately.
- Token is cleared and session label switches to guest.
- Login prompt is visible (soft auth overlay), login button visible.

**Expected console logs**
- `[ViChat] auth token invalid` (reason `fetchMessages` or `fetchMe`).
- `[ViChat debug] ensure overlay open` (reason `bubble click`).

## Scenario C: Login -> Network offline -> close -> reopen (fetch failure)
1. Log in and confirm messages load.
2. Simulate offline mode (DevTools or disconnect).
3. Close the widget overlay.
4. Click the bubble to reopen.

**Expected**
- Overlay opens immediately.
- A generic error message appears if no prior messages are rendered.
- Widget remains usable as guest if token is later cleared.

**Expected console logs**
- `[ViChat] failed to load messages` with `status: 0`.
- `[ViChat debug] ensure overlay open` (reason `bubble click`).
