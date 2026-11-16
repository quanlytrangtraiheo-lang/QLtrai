# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity & Email Verification**: No user without `request.auth != null && request.auth.token.email_verified == true` may read or write any document.
2. **PII Isolation**: `/users/{userId}` contains `email` and is readable/writable strictly by `request.auth.uid == userId` or verified bootstrapped admin.
3. **Master Gate & Farm Ownership**: All farm subcollections (`/farms/{farmId}/...`) verify parent `/farms/{farmId}` existence on create/get/update/delete, and require the caller to be the farm `ownerId`, an active staff member in `/farms/{farmId}/staff/{uid}`, or the bootstrapped admin (`quanlytrangtraiheo@gmail.com`).
4. **Query Enforcer (No O(n) reads in `list`)**: All `allow list` rules check `resource.data.farmOwnerId == request.auth.uid` (or `request.auth.uid in resource.data.memberUids` on `/farms`) without invoking `get()` or `exists()`.
5. **Immutable Audit & Temporal Integrity**: `createdAt == request.time` on create; `createdAt`, `createdBy`, `farmId`, and `farmOwnerId` are immutable on update; `updatedAt == request.time` on update.
6. **Role Escalation Prevention**: Users cannot assign themselves admin privileges on `/farms/{farmId}/staff` unless they are the farm owner or an existing farm admin.
7. **Strict Schema & Size Bounds**: Every string field enforces `.size() <= maxLength`, IDs match `^[a-zA-Z0-9_-]+$`, and `keys().hasOnly(...)` rejects shadow fields.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Read `/farms/farm1/sows/sow1` with `auth = null`.
2. **Unverified Email Spoof**: Write `/farms/farm1` with `auth.token.email = "quanlytrangtraiheo@gmail.com"` and `email_verified = false`.
3. **PII Cross-User Read**: User B attempts `get` on `/users/userA`.
4. **Shadow Field Injection (Create)**: Create a sow with extra ghost field `isVerified: true`.
5. **Shadow Field Injection (Update)**: Update a pigGroup with extra ghost field `bypassAudit: true`.
6. **ID Poisoning**: Create a document at `/farms/farm1/sows/bad$id_with_spaces_or_200_chars...`.
7. **Identity Spoofing**: User B creates a sow under `farm1` setting `createdBy: "userA"`.
8. **Client Timestamp Forgery**: Create a transaction with `createdAt: Timestamp(2020-01-01)` instead of `request.time`.
9. **Immutable Field Mutation**: Update a `FinancialTx` attempting to change `farmId` or `createdBy`.
10. **Non-Member List Scraping**: User B runs a `list` query on `/farms/farm1/transactions` where `resource.data.farmOwnerId == "userA"`.
11. **Privilege Escalation**: A `worker` staff member attempts to update their own `/farms/farm1/staff/{uid}` document from `role: "worker"` to `role: "admin"`.
12. **Resource Exhaustion (1MB String)**: Create a `HealthLog` with `symptoms` string exceeding 800 characters.
