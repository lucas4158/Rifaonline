# Security Specification: RifaMaster Firestore Security

## Data Invariants

1. **Locks (`/locks/{numberId}`)**:
   - The document ID (`numberId`) must be a 3-character numeric string (e.g., `"015"`).
   - A lock must contain a valid `sessionId` (string, max 50 chars) and an `expiresAt` (integer, epoch millisecond timestamp in the future).
   - The field structure must have exactly these keys: `['sessionId', 'expiresAt']`.

2. **Orders (`/orders/{orderId}`)**:
   - The document ID (`orderId`) must be a 5-character uppercase alphanumeric string (e.g., `"KJ8FA"`).
   - An order must contain: `id`, `name`, `phone`, `nums`, `val`, `status`, `createdAt`, `paymentId`, `paymentType`, `qrCode`, and `qrCodeBase64`.
   - On creation (`create`), `status` **MUST** be `"Aguardando"`. Customers are strictly forbidden from self-approving orders (setting to `"Pago"`).
   - The `val` (value) must be positive and proportional to the number of cotas ordered.
   - During update, fields like `id`, `name`, `phone`, `createdAt` are immutable and cannot be tampered with. Only the `status`, `nums`, and `val` (when releasing cotas) may change.

3. **Raffle Config (`/raffle/config`)**:
   - The config must contain: `title`, `description`, `price`, `totalNumbers`, `isActive`, `imageUrl`, `pixKey`, `pixReceiver`, `pixBank`, `pixPhone`, `winnerNumber`, and `winnerName`.
   - `price` and `totalNumbers` must be positive integers.
   - `winnerNumber` must either be empty or a 3-digit numeric string matching an existing cota.

---

## The "Dirty Dozen" Malicious Payloads

The following payloads represent malicious attempts to bypass identity, integrity, and state rules:

### 1. Config Hijack — Unauthorized Prize Inflation
```json
// Path: /raffle/config
{
  "title": "iPhone 15 Pro Max",
  "description": "Premium Smartphone",
  "price": 0.01,
  "totalNumbers": 1000000,
  "isActive": true
}
```
*Expected: Rejected. Price and totalNumbers must be valid positive values, and full config keys must match.*

### 2. Lock Poisoning — Phantom Selection Locks
```json
// Path: /locks/999 (Invalid Cota Number ID)
{
  "sessionId": "hacker_session",
  "expiresAt": 99999999999999
}
```
*Expected: Rejected. Document ID must be in the correct range of valid raffle numbers (3-character digits).*

### 3. Lock Spoofing — Injecting Arbitrary Fields
```json
// Path: /locks/012
{
  "sessionId": "hacker_session",
  "expiresAt": 2854000000000,
  "isPreApproved": true,
  "userRole": "moderator"
}
```
*Expected: Rejected. Keys outside the strict lock schema are prohibited.*

### 4. Lock Expiring — Historical Locking
```json
// Path: /locks/015
{
  "sessionId": "hacker_session",
  "expiresAt": 100000000000 // In the past
}
```
*Expected: Rejected. Expiration timestamp must be in the future.*

### 5. Order Creation Bypass — Self-Approving Ticket
```json
// Path: /orders/HACKD
{
  "id": "HACKD",
  "name": "Malicious User",
  "phone": "5511999999999",
  "nums": ["012", "013"],
  "val": 20,
  "status": "Pago", // Self-payment bypass!
  "createdAt": "2026-05-20T15:23:49Z",
  "paymentId": "MAN_HACKED",
  "paymentType": "ManualPix",
  "qrCode": "",
  "qrCodeBase64": ""
}
```
*Expected: Rejected. Creation of orders is only allowed with status "Aguardando".*

### 6. Order Key Poisoning — Injecting Backdoors
```json
// Path: /orders/BACKD
{
  "id": "BACKD",
  "name": "Malicious User",
  "phone": "5511999999999",
  "nums": ["012"],
  "val": 10,
  "status": "Aguardando",
  "createdAt": "2026-05-20T15:23:49Z",
  "paymentId": "MAN_HACKED",
  "paymentType": "ManualPix",
  "qrCode": "",
  "qrCodeBase64": "",
  "backdoor_access_role": "owner"
}
```
*Expected: Rejected. Strict key verification must prevent extra properties from being saved.*

### 7. Order Spoofing — Zero or Negative Pricing
```json
// Path: /orders/CHEAP
{
  "id": "CHEAP",
  "name": "Cheater",
  "phone": "5511999999999",
  "nums": ["012", "013"],
  "val": -100, // Negative amount
  "status": "Aguardando",
  "createdAt": "2026-05-20T15:23:49Z",
  "paymentId": "MAN123",
  "paymentType": "ManualPix",
  "qrCode": "",
  "qrCodeBase64": ""
}
```
*Expected: Rejected. Order val must be positive.*

### 8. Order Status Hijacking — Client Force-Confirming Payment during Update
```json
// Path: /orders/K3F8S
// Existing status: "Aguardando"
// Update Payload:
{
  "status": "Pago",
  "phone": "5511000000000" // Maliciously modifying phone number
}
```
*Expected: Rejected. Only the white-listed fields (like status) may change during updates, and metadata must remain immutable.*

### 9. Lock Scraping / Spoofing ID Length
```json
// Path: /locks/this_id_is_too_long_and_designed_to_exhaust_allocated_wallet_resources_and_crash_checks
{
  "sessionId": "hack",
  "expiresAt": 1900000000000
}
```
*Expected: Rejected. Lock path ID must be exactly 3 characters.*

### 10. Order Tampering — Shifting Numbers and Deleting History
```json
// Path: /orders/K3F8S
// Existing nums: ["012", "015"]
// Update Payload:
{
  "nums": ["012", "015", "044"], // Injecting extra number without pricing correction
  "val": 20
}
```
*Expected: Rejected. Updates must preserve the relational pricing rules.*

### 11. Custom Order ID Poisoning
```json
// Path: /orders/BAD_ID_WITH_SPECIAL_SYMBOLS_$%^*
{
  "id": "BAD_ID_WITH_SPECIAL_SYMBOLS_$%^*",
  "name": "User",
  "phone": "13123131",
  "nums": ["001"],
  "val": 10,
  "status": "Aguardando",
  "createdAt": "2026-05-20T15:23:49Z"
}
```
*Expected: Rejected. Document ID must conform to alpha-numeric uppercase formats.*

### 12. Config Winner Manipulation
```json
// Path: /raffle/config
// Update Payload:
{
  "winnerNumber": "999" // Ticket doesn't exist
}
```
*Expected: Rejected. Winner ticket must map inside the coordinate bounds of totalNumbers.*
