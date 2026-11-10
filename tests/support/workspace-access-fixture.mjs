// Synthetic local data only. Shared by rendered checks and screenshot previews.
export async function seedAccessFixture(DB) {
  await DB.prepare("UPDATE organizations SET name='Atlas Pantry',organization_type='brand' WHERE id='fixture'").run();
  await DB.prepare(`INSERT INTO organizations (id,name,slug,organization_type,owner_user_id,owner_email,issuer_code) VALUES
    ('fixture-recipient','Redwood Retail','redwood','retailer','redwood','review@redwood.example','RWD'),
    ('fixture-lab','Northstar Laboratory','northstar','laboratory','northstar','lab@northstar.example','NST')`).run();
  await DB.prepare(`INSERT INTO evidence_requests (id,requester_organization_id,controller_organization_id,program_name,purpose,product_name,product_sku,access_level,analyte_scope_json,delivery_mode,status,requested_by_user_id)
    VALUES ('access-request','fixture-recipient','fixture','Product review','Review oil results','Olive oil','OIL-100','selected_analytes','["Lead","Cadmium"]','future_sku','accepted','redwood')`).run();
  await DB.prepare(`INSERT INTO evidence_access_grants (id,request_id,controller_organization_id,recipient_organization_id,product_name,product_sku,access_level,analyte_scope_json,delivery_mode,created_by_user_id,created_at)
    VALUES ('access-grant','access-request','fixture','fixture-recipient','Olive oil','OIL-100','selected_analytes','["Lead","Cadmium"]','future_sku','email:fixture-owner','2026-11-01T12:00:00Z')`).run();
  await DB.prepare(`INSERT INTO evidence_share_codes (id,controller_organization_id,recipient_organization_id,label,purpose,scope_mode,scope_json,access_level,token_hash,token_prefix,token_last_four,status,created_by_user_id,created_at,expires_at,redeemed_at)
    VALUES ('access-share','fixture','fixture-recipient','Selected report','Product review','tecrid_set','["TECRID:DEMO-OIL-100"]','full_record','fixture-share-hash','fixture','test','redeemed','email:fixture-owner','2026-11-02T12:00:00Z','2026-12-01T12:00:00Z','2026-11-03T12:00:00Z')`).run();
  await DB.prepare(`INSERT INTO routing_authorizations (id,controller_organization_id,laboratory_organization_id,product_name,product_sku,token_hash,token_prefix,token_last_four,status,created_by_user_id,created_at,expires_at,last_used_at)
    VALUES ('access-route','fixture','fixture-lab','Olive oil','OIL-100','fixture-routing-hash','fixture','test','active','email:fixture-owner','2026-11-01T12:00:00Z','2027-02-01T12:00:00Z','2026-11-03T12:00:00Z')`).run();
}
