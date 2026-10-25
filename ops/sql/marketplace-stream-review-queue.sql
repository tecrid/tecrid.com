-- OPERATOR GATE REQUIRED. Never run automatically during migration or deployment.
-- After migration 0024 and separate release approval, queue existing marketplace
-- deliveries for current-authority review. This does not grant consent or publish.
-- At most one operator_review job per delivery, including repeated execution.
INSERT INTO marketplace_stream_jobs (delivery_id, cause, created_at)
SELECT d.id, 'operator_review', strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM evidence_deliveries d
JOIN organizations o ON o.id = d.recipient_organization_id
WHERE o.organization_type = 'marketplace'
  AND NOT EXISTS (
    SELECT 1 FROM marketplace_stream_jobs j
    WHERE j.delivery_id = d.id AND j.cause = 'operator_review'
  );
