-- HTTP idempotency keys are opaque, case-sensitive identifiers, unlike human search text.
ALTER TABLE idempotency_keys
 MODIFY scope VARCHAR(140) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
 MODIFY key_value VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
