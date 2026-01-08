# Accessibility Notes

## Supported

- Overlay uses `role="dialog"` with `aria-modal="true"`.
- Focus management:
  - Opening the overlay focuses the composer textarea.
  - Closing the overlay returns focus to the badge.
- Escape closes the topmost modal (delete/logout/auth), then the overlay.
- Buttons expose `aria-label` values.
- Confirmation/auth dialogs use `aria-labelledby` and `aria-describedby`.
- Messages use `aria-live="polite"`.

## Known Limitations

- No full focus trap within the overlay; tab order follows DOM order.
- Localization does not currently cover every string in the widget.
- Screen reader output depends on host page language settings.

## How to Test

- Keyboard:
  1. Open the badge.
  2. Verify focus lands on the composer textarea.
  3. Press `Tab` through controls in the overlay.
  4. Open Delete or Logout confirm, press `Escape`, verify only the modal closes.
  5. Close the overlay and confirm focus returns to the badge.
- Screen reader:
  - Confirm the overlay announces as a dialog.
  - Confirm Delete/Logout dialogs announce title and description.
