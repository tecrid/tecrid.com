# F13: authentication log privacy

The first commit proves a rejected origin was echoed into authentication logs. The factory now disables the library's uncontrolled logger, matching the VLE privacy counterpart. Existing handlers keep their safe public errors; no session/token behavior changes.

Full build, 156 unit/backend tests and 42 Worker/rendered/redirect checks pass, including a captured-console synthetic origin regression with zero outgoing mail. All test data is disposable. No production telemetry, credentials, account, schema/migration, real mail, merge or deploy was accessed. The remaining app does not log result bodies or secrets; deployed log sinks remain part of the later rehearsal.
