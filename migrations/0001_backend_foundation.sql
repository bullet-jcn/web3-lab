CREATE TYPE user_status AS ENUM ('active', 'disabled');
CREATE TYPE transaction_intent_kind AS ENUM (
  'native-transfer',
  'erc20-transfer',
  'erc20-approval',
  'erc20-revoke',
  'permit2-lockdown',
  'batch'
);
CREATE TYPE transaction_intent_status AS ENUM (
  'created',
  'broadcast',
  'confirmed',
  'reverted',
  'cancelled',
  'replaced'
);
CREATE TYPE risk_decision AS ENUM ('blocked', 'cancelled', 'proceeded-to-wallet');

CREATE TABLE users (
  id uuid PRIMARY KEY,
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address varchar(42) NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_authenticated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallets_address_format CHECK (address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT wallets_address_unique UNIQUE (address),
  CONSTRAINT wallets_id_user_unique UNIQUE (id, user_id)
);

CREATE INDEX wallets_user_id_idx ON wallets(user_id);

CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL,
  chain_id bigint NOT NULL,
  token_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT sessions_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sessions_chain_id_positive CHECK (chain_id > 0),
  CONSTRAINT sessions_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT sessions_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT sessions_wallet_owner_fk
    FOREIGN KEY (wallet_id, user_id) REFERENCES wallets(id, user_id) ON DELETE CASCADE
);

CREATE INDEX sessions_active_token_idx
  ON sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX sessions_user_id_idx ON sessions(user_id);

CREATE TABLE watchlist_entries (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain_id bigint NOT NULL,
  address varchar(42) NOT NULL,
  label varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watchlist_chain_id_positive CHECK (chain_id > 0),
  CONSTRAINT watchlist_address_format CHECK (address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT watchlist_label_not_blank CHECK (label IS NULL OR btrim(label) <> ''),
  CONSTRAINT watchlist_owner_chain_address_unique UNIQUE (user_id, chain_id, address)
);

CREATE INDEX watchlist_entries_user_chain_idx ON watchlist_entries(user_id, chain_id, created_at);

CREATE TABLE transaction_intents (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  wallet_id uuid NOT NULL,
  chain_id bigint NOT NULL,
  kind transaction_intent_kind NOT NULL,
  status transaction_intent_status NOT NULL DEFAULT 'created',
  idempotency_key varchar(128) NOT NULL,
  request_fingerprint char(64) NOT NULL,
  target_address varchar(42),
  transaction_hash char(66),
  replaced_by_hash char(66),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transaction_intents_chain_id_positive CHECK (chain_id > 0),
  CONSTRAINT transaction_intents_idempotency_key_not_blank CHECK (btrim(idempotency_key) <> ''),
  CONSTRAINT transaction_intents_request_fingerprint_format
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT transaction_intents_target_address_format
    CHECK (target_address IS NULL OR target_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT transaction_intents_transaction_hash_format
    CHECK (transaction_hash IS NULL OR transaction_hash ~ '^0x[0-9a-f]{64}$'),
  CONSTRAINT transaction_intents_replaced_by_hash_format
    CHECK (replaced_by_hash IS NULL OR replaced_by_hash ~ '^0x[0-9a-f]{64}$'),
  CONSTRAINT transaction_intents_user_idempotency_unique UNIQUE (user_id, idempotency_key),
  CONSTRAINT transaction_intents_id_chain_hash_unique UNIQUE (id, chain_id, transaction_hash),
  CONSTRAINT transaction_intents_id_identity_chain_unique UNIQUE (id, user_id, wallet_id, chain_id),
  CONSTRAINT transaction_intents_wallet_owner_fk
    FOREIGN KEY (wallet_id, user_id) REFERENCES wallets(id, user_id) ON DELETE RESTRICT
);

CREATE INDEX transaction_intents_user_created_idx
  ON transaction_intents(user_id, created_at DESC);
CREATE UNIQUE INDEX transaction_intents_chain_hash_unique
  ON transaction_intents(chain_id, transaction_hash)
  WHERE transaction_hash IS NOT NULL;

CREATE TABLE transaction_receipts (
  id uuid PRIMARY KEY,
  intent_id uuid NOT NULL,
  chain_id bigint NOT NULL,
  transaction_hash char(66) NOT NULL,
  status varchar(8) NOT NULL,
  block_number numeric(78, 0) NOT NULL,
  gas_used numeric(78, 0) NOT NULL,
  effective_gas_price numeric(78, 0),
  observed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transaction_receipts_chain_id_positive CHECK (chain_id > 0),
  CONSTRAINT transaction_receipts_hash_format CHECK (transaction_hash ~ '^0x[0-9a-f]{64}$'),
  CONSTRAINT transaction_receipts_status CHECK (status IN ('success', 'reverted')),
  CONSTRAINT transaction_receipts_block_number_nonnegative CHECK (block_number >= 0),
  CONSTRAINT transaction_receipts_gas_used_nonnegative CHECK (gas_used >= 0),
  CONSTRAINT transaction_receipts_effective_gas_price_nonnegative
    CHECK (effective_gas_price IS NULL OR effective_gas_price >= 0),
  CONSTRAINT transaction_receipts_intent_unique UNIQUE (intent_id),
  CONSTRAINT transaction_receipts_chain_hash_unique UNIQUE (chain_id, transaction_hash),
  CONSTRAINT transaction_receipts_intent_transaction_fk
    FOREIGN KEY (intent_id, chain_id, transaction_hash)
    REFERENCES transaction_intents(id, chain_id, transaction_hash) ON DELETE CASCADE
);

CREATE TABLE risk_reports (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  wallet_id uuid NOT NULL,
  intent_id uuid,
  chain_id bigint NOT NULL,
  operation varchar(64) NOT NULL,
  target_address varchar(42),
  finding_codes text[] NOT NULL,
  highest_severity varchar(8) NOT NULL,
  decision risk_decision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT risk_reports_chain_id_positive CHECK (chain_id > 0),
  CONSTRAINT risk_reports_operation_not_blank CHECK (btrim(operation) <> ''),
  CONSTRAINT risk_reports_target_address_format
    CHECK (target_address IS NULL OR target_address ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT risk_reports_findings_present CHECK (cardinality(finding_codes) BETWEEN 1 AND 50),
  CONSTRAINT risk_reports_finding_codes_not_blank CHECK (
    array_position(finding_codes, '') IS NULL
  ),
  CONSTRAINT risk_reports_highest_severity CHECK (highest_severity IN ('low', 'medium', 'high')),
  CONSTRAINT risk_reports_wallet_owner_fk
    FOREIGN KEY (wallet_id, user_id) REFERENCES wallets(id, user_id) ON DELETE RESTRICT,
  CONSTRAINT risk_reports_intent_context_fk
    FOREIGN KEY (intent_id, user_id, wallet_id, chain_id)
    REFERENCES transaction_intents(id, user_id, wallet_id, chain_id) ON DELETE RESTRICT
);

CREATE INDEX risk_reports_user_created_idx ON risk_reports(user_id, created_at DESC);
CREATE INDEX risk_reports_intent_id_idx ON risk_reports(intent_id) WHERE intent_id IS NOT NULL;

COMMENT ON COLUMN sessions.token_hash IS
  'SHA-256 hash of the opaque session token; the raw bearer token must never be persisted.';
COMMENT ON COLUMN transaction_intents.request_fingerprint IS
  'Deterministic SHA-256 fingerprint used to detect idempotency-key reuse with different public intent data.';
COMMENT ON TABLE risk_reports IS
  'Deterministic finding codes and user decisions only; never store signatures, private keys, raw calldata, typed data, or AI prose.';
