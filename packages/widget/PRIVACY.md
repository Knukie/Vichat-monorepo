# Privacy Statement

This widget processes:
- Chat messages you submit.
- Image URLs or image data for attachments you send.
- An authentication token stored locally when you log in.

## Where Data Goes

The widget sends data to the configured backend at `BASE_URL` (see widget configuration). Requests are made directly from the browser to that backend.

## Local Storage

The widget stores the following keys in `localStorage`:
- `valki_auth_token_v1`: authentication token.
- `valki_history_vNext`: guest chat history (not stored when logged in).
- `valki_guest_meter_v1`: guest usage counters.
- `valki_client_id`: anonymous client identifier.

## No Tracking or Analytics

The widget does not include tracking pixels, analytics SDKs, or advertising beacons.

## User Responsibilities

Do not share secrets such as seed phrases, private keys, or passwords. You are responsible for the content you submit and the permissions granted on the host page.
