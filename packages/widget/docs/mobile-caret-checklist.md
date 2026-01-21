# Mobile caret positioning checklist

Use this checklist to reproduce and verify the first-tap caret positioning on touch devices.

## Setup
- Build the widget assets: `pnpm --filter vichat-widget build`.
- Start the widget server: `pnpm --filter vichat-widget start`.
- Open `http://localhost:3000/widget/host/demo.html` on the device.

## iOS Safari
1. Open the widget and ensure the chat view is visible.
2. Tap once in the middle of the composer textarea.
3. Confirm the caret lands exactly where you tapped (no horizontal offset).
4. Type a few characters and confirm they insert at the caret.
5. Tap near the end and verify the caret moves to the end.
6. Long-press to bring up selection handles; verify selection/drag handles work.

## Android Chrome
1. Open the widget and ensure the chat view is visible.
2. Tap once in the middle of the composer textarea.
3. Confirm the caret lands exactly where you tapped (no horizontal offset).
4. Type a few characters and confirm they insert at the caret.
5. Tap near the end and verify the caret moves to the end.
6. Long-press to bring up selection handles; verify selection/drag handles work.
