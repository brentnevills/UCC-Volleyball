# Firebase Security Specification

## 1. Data Invariants
1. A single document in `teams/{teamId}/members/{userId}` strictly limits access to team documents. Without membership, no read or write is possible to any subcollection of `{teamId}`.
2. A user can only self-assign themselves as a member if `request.auth.uid == userId`.
3. All data records (matches, sets, stats) MUST explicitly declare their `teamId` mapping.
4. An authenticated user must be Google Verified (`email_verified == true`).
5. All IDs must strictly align with `^[a-zA-Z0-9_\\-]+$`.

## 2. The "Dirty Dozen" Payloads
1. Payload: Join team with spoofed UID.
2. Payload: Read settings without being a member.
3. Payload: Update setting with out-of-schema types.
4. Payload: Inject large string values into ID variables.
5. Payload: Write a match with a missing `teamId`.
6. Payload: Write a stat missing a `timestamp`.
7. Payload: Query list operations across teams without filtering `resource.data.teamId == teamId`.
8. Payload: Add a 2000-element array to opponent notes.
9. Payload: Spoof a verified email signature on login.
10. Payload: Alter the `teamId` on an existing match document.
11. Payload: Attempt to set a `userId` in `teams/members` without being signed in.
12. Payload: Attempt to write a match with an invalid `type` payload format.

## 3. The Test Runner
A complete `firestore.rules.test.ts` file must verify all above payloads return PERMISSION_DENIED.
