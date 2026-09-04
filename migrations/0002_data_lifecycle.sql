ALTER TABLE risk_reports
  DROP CONSTRAINT risk_reports_intent_context_fk,
  DROP CONSTRAINT risk_reports_wallet_owner_fk,
  DROP CONSTRAINT risk_reports_user_id_fkey;

ALTER TABLE transaction_intents
  DROP CONSTRAINT transaction_intents_wallet_owner_fk,
  DROP CONSTRAINT transaction_intents_user_id_fkey;

ALTER TABLE transaction_intents
  ADD CONSTRAINT transaction_intents_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT transaction_intents_wallet_owner_fk
    FOREIGN KEY (wallet_id, user_id) REFERENCES wallets(id, user_id) ON DELETE CASCADE;

ALTER TABLE risk_reports
  ADD CONSTRAINT risk_reports_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT risk_reports_wallet_owner_fk
    FOREIGN KEY (wallet_id, user_id) REFERENCES wallets(id, user_id) ON DELETE CASCADE,
  ADD CONSTRAINT risk_reports_intent_context_fk
    FOREIGN KEY (intent_id, user_id, wallet_id, chain_id)
    REFERENCES transaction_intents(id, user_id, wallet_id, chain_id)
    ON DELETE SET NULL (intent_id);

CREATE INDEX sessions_retention_idx ON sessions(expires_at, revoked_at);
CREATE INDEX transaction_intents_retention_idx ON transaction_intents(updated_at, status);
CREATE INDEX risk_reports_retention_idx ON risk_reports(created_at);

COMMENT ON INDEX sessions_retention_idx IS
  'Supports bounded removal after the documented expired/revoked session retention window.';
COMMENT ON INDEX transaction_intents_retention_idx IS
  'Supports removal of abandoned intents and expired transaction history.';
COMMENT ON INDEX risk_reports_retention_idx IS
  'Supports removal of deterministic risk history after its documented retention window.';
