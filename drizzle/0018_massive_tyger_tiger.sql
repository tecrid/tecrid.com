CREATE TABLE `test_report_imports` (
	`identifier` text PRIMARY KEY NOT NULL,
	`report_number` text NOT NULL,
	`source_sha256` text NOT NULL,
	`document_url` text NOT NULL,
	`source_organization_id` text NOT NULL,
	`controller_organization_id` text NOT NULL,
	`status` text DEFAULT 'test_pending_approval' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`controller_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
INSERT INTO organizations (id,name,slug,organization_type,website,owner_user_id,owner_email,issuer_code,issuer_status) VALUES ('org_test_kasandrinos','Kasandrinos · TEST','kasandrinos-test','brand','https://kasandrinos.com','unclaimed:test:kasandrinos','','KASTEST','pending');
--> statement-breakpoint
INSERT INTO participant_profiles (id,organization_id,public_slug,display_name,website,summary,participation_status,is_public,registry_verified,published_at) VALUES ('profile_test_kasandrinos','org_test_kasandrinos','kasandrinos-test','Kasandrinos · TEST','https://kasandrinos.com','TEST integration profile for Kasandrinos. Prepared for the eight Kasandrinos report references. Organization ownership, laboratory approval and signatures remain pending. This profile grants no document access or production issuance authority.','test_pending_approval',1,0,CURRENT_TIMESTAMP);
--> statement-breakpoint
INSERT INTO organizations (id,name,slug,organization_type,website,owner_user_id,owner_email,issuer_code,issuer_status) VALUES ('org_test_light_labs','Light Labs · TEST','light-labs-test','laboratory','https://www.lightlabs.com/','unclaimed:test:light-labs','','LLTEST','pending');
--> statement-breakpoint
INSERT INTO participant_profiles (id,organization_id,public_slug,display_name,website,summary,participation_status,is_public,registry_verified,published_at) VALUES ('profile_test_light-labs','org_test_light_labs','light-labs-test','Light Labs · TEST','https://www.lightlabs.com/','TEST integration profile for Light Labs. Prepared for the eight Kasandrinos report references. Organization ownership, laboratory approval and signatures remain pending. This profile grants no document access or production issuance authority.','test_pending_approval',1,0,CURRENT_TIMESTAMP);
--> statement-breakpoint
INSERT INTO test_report_imports (identifier,report_number,source_sha256,document_url,source_organization_id,controller_organization_id) VALUES ('SBX·TECRID-KAS-43295-8F703F25','43295','8f703f25f845c0ac5dc5a1667ab07ed3d6df1eccf3272bcb7bfa4a62f7660bfa','https://vle.exchange/reports/ll-43295','org_test_light_labs','org_test_kasandrinos');
--> statement-breakpoint
INSERT INTO test_report_imports (identifier,report_number,source_sha256,document_url,source_organization_id,controller_organization_id) VALUES ('SBX·TECRID-KAS-43296-D0E6C1AE','43296','d0e6c1ae12e57a8f03d1ab7bae9f9a189711caf60d274af549d5365981793f89','https://vle.exchange/reports/ll-43296','org_test_light_labs','org_test_kasandrinos');
--> statement-breakpoint
INSERT INTO test_report_imports (identifier,report_number,source_sha256,document_url,source_organization_id,controller_organization_id) VALUES ('SBX·TECRID-KAS-43297-C7180396','43297','c71803964c7b5b60979d47cd581c0913aedf30222021fc8e08920b2a187fcd42','https://vle.exchange/reports/ll-43297','org_test_light_labs','org_test_kasandrinos');
--> statement-breakpoint
INSERT INTO test_report_imports (identifier,report_number,source_sha256,document_url,source_organization_id,controller_organization_id) VALUES ('SBX·TECRID-KAS-43298-186B0697','43298','186b06972f3b5b79bdcf1cd78e057f2d4f271e3644d6d33695f6e4fd9842bbe9','https://vle.exchange/reports/ll-43298','org_test_light_labs','org_test_kasandrinos');
--> statement-breakpoint
INSERT INTO test_report_imports (identifier,report_number,source_sha256,document_url,source_organization_id,controller_organization_id) VALUES ('SBX·TECRID-KAS-43299-211BAFBD','43299','211bafbde330bc1d40ef5c98c09627145e4189260e80427c953969c52cffc10b','https://vle.exchange/reports/ll-43299','org_test_light_labs','org_test_kasandrinos');
--> statement-breakpoint
INSERT INTO test_report_imports (identifier,report_number,source_sha256,document_url,source_organization_id,controller_organization_id) VALUES ('SBX·TECRID-KAS-43300-E32FEA36','43300','e32fea364b0b7161922d43c98cde73431733096cc08495c4e5019dd2fd055e49','https://vle.exchange/reports/ll-43300','org_test_light_labs','org_test_kasandrinos');
--> statement-breakpoint
INSERT INTO test_report_imports (identifier,report_number,source_sha256,document_url,source_organization_id,controller_organization_id) VALUES ('SBX·TECRID-KAS-43301-49BEFE05','43301','49befe05ecd78ab5528ad730e075f079358db126eb534530e98fceaac777abc2','https://vle.exchange/reports/ll-43301','org_test_light_labs','org_test_kasandrinos');
--> statement-breakpoint
INSERT INTO test_report_imports (identifier,report_number,source_sha256,document_url,source_organization_id,controller_organization_id) VALUES ('SBX·TECRID-KAS-43302-C70F43DA','43302','c70f43dab461300136a4483deeb18670c6c2f15f994f4505df96641cf7f07e43','https://vle.exchange/reports/ll-43302','org_test_light_labs','org_test_kasandrinos');
