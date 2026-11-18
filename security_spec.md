# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **User Profile Isolation (PII Guard)**: `/users/{userId}` documents contain PII (`email`, `phone`, `address`). Only the verified authenticated owner (`request.auth.uid == userId && request.auth.token.email_verified == true`) may `get`, `create`, or `update` their own profile. Blanket `list` queries on `/users` are strictly denied.
2. **Cart Item Ownership (Master Gate)**: `/users/{userId}/cartItems/{itemId}` items are strictly readable and writable only by the owner `userId == request.auth.uid`, with strict key allowlists, server timestamp checks, and numeric quantity bounds (`1 <= qty <= 20`).
3. **Order & Payment Integrity**: `/orders/{orderId}` records must lock `userId == request.auth.uid`, `upiVpa == '9311635332@fam'`, `paymentMethod == 'UPI_FAM'`, `status == 'pending_verification'`, valid 10–24 character alphanumeric `utrReference`, and `createdAt == request.time`. Once created, orders are immutable by the client (no client-side status forging to `'paid'` or `'shipped'`).
4. **Order Line Items Atomicity**: `/orders/{orderId}/items/{itemId}` requires the parent `/orders/{orderId}` document to exist (or be created in the same atomic batch via `existsAfter` / `getAfter`) and belong to `request.auth.uid`.
5. **Query Security**: `allow list` on `/orders` strictly enforces `resource.data.userId == request.auth.uid`, preventing any user from listing another user's orders.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Profile Read**: `GET /users/userA` with `auth: null`.
2. **Cross-User PII Read**: `GET /users/userA` with `auth: { uid: 'userB', email_verified: true }`.
3. **Unverified Email Write**: `CREATE /users/userA` with `auth: { uid: 'userA', email_verified: false }`.
4. **Ghost Field Shadow Write on Profile**: `CREATE /users/userA` with `{ uid: 'userA', ..., isAdmin: true }`.
5. **UID Spoofing on Cart Item**: `CREATE /users/userA/cartItems/item1` with `{ userId: 'userB', ... }`.
6. **Negative Price Injection on Cart Item**: `CREATE /users/userA/cartItems/item1` with `{ ..., unitPriceInr: -500, qty: 1 }`.
7. **Excessive Quantity Exhaustion**: `CREATE /users/userA/cartItems/item1` with `{ ..., qty: 9999 }`.
8. **UPI VPA Hijacking on Order**: `CREATE /orders/ord123` with `{ ..., upiVpa: 'attacker@upi', status: 'pending_verification' }`.
9. **Self-Confirmed Status Bypass on Order**: `CREATE /orders/ord123` with `{ ..., upiVpa: '9311635332@fam', status: 'confirmed' }`.
10. **Client Timestamp Forgery on Order**: `CREATE /orders/ord123` with `{ ..., createdAt: '2020-01-01T00:00:00Z' }`.
11. **Order Mutation After Creation**: `UPDATE /orders/ord123` with `{ status: 'paid' }` by owner.
12. **Blanket Order Scraping**: `LIST /orders` without `where('userId', '==', auth.uid)`.
