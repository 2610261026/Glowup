# Security Specification - Glowup AI

## Data Invariants
1. A Transformation record must always belong to the user who generated it.
2. User profiles can only be modified by the owner (except for credits which are system-managed).
3. Transactions are immutable once completed and can only be read by the owner or system.
4. Document IDs must be valid (max 128 chars, alphanumeric + underscores/hyphens).

## The "Dirty Dozen" Payloads (Red Team Tests)

1. **Identity Spoofing**: Attempt to create a user profile with a different `uid` than the authenticated user.
2. **Credit Hijacking**: Attempt to update own `credits` field directly.
3. **Ghost Collection**: Attempt to write to a random collection like `/hacker_logs`.
4. **ID Poisoning**: Attempt to create a document with a 2KB string as the ID.
5. **PII Leak**: Attempt to read another user's private profile.
6. **State Skip**: Attempt to set a Transaction status to 'completed' without a payment ID.
7. **Size Attack**: Attempt to save a 1MB string in the `preset` field.
8. **Immutability Breach**: Attempt to change the `userId` of an existing transformation.
9. **Relational Omission**: Create a transformation without a valid `userId` reference.
10. **Query Scraping**: Attempt to list all transactions without a filter on `userId`.
11. **Type Mismatch**: Send a boolean to the `credits` (number) field.
12. **Future Timestamp**: Send a `createdAt` timestamp from 2099.

## Test Runner
See `firestore.rules.test.ts` for implementation.
