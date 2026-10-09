// Generated from the implemented FastAPI OpenAPI contract. Do not edit.
export interface paths {
    "/api/v1/auth/csrf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Current Csrf */
        get: operations["current_csrf_api_v1_auth_csrf_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Login */
        post: operations["login_api_v1_auth_login_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Logout */
        post: operations["logout_api_v1_auth_logout_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/nonce": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Nonce */
        post: operations["nonce_api_v1_auth_nonce_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/password-reset/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reset Confirm */
        post: operations["reset_confirm_api_v1_auth_password_reset_confirm_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/password-reset/request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reset Request */
        post: operations["reset_request_api_v1_auth_password_reset_request_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Register */
        post: operations["register_api_v1_auth_register_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Current Session */
        get: operations["current_session_api_v1_auth_session_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/verify-email": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Verify Email */
        post: operations["verify_email_api_v1_auth_verify_email_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/course-scopes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Course Scopes */
        get: operations["course_scopes_api_v1_course_scopes_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/courses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Courses */
        get: operations["courses_api_v1_courses_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/courses/{course_id}/versions/{version_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Course Version */
        get: operations["course_version_api_v1_courses__course_id__versions__version_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/execution-jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Execution Job */
        post: operations["execution_job_api_v1_execution_jobs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guest-leases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Lease */
        post: operations["create_lease_api_v1_guest_leases_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guest-leases/{lease_id}/learning-assist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Learning Assist */
        post: operations["learning_assist_api_v1_guest_leases__lease_id__learning_assist_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guest-leases/{lease_id}/operations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Operation */
        post: operations["create_operation_api_v1_guest_leases__lease_id__operations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guest-leases/{lease_id}/operations/{operation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Operation Snapshot */
        get: operations["operation_snapshot_api_v1_guest_leases__lease_id__operations__operation_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guest-leases/{lease_id}/operations/{operation_id}/ack": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Operation Ack */
        post: operations["operation_ack_api_v1_guest_leases__lease_id__operations__operation_id__ack_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guest-leases/{lease_id}/operations/{operation_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Operation Cancel */
        post: operations["operation_cancel_api_v1_guest_leases__lease_id__operations__operation_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guest-leases/{lease_id}/operations/{operation_id}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Operation Events */
        get: operations["operation_events_api_v1_guest_leases__lease_id__operations__operation_id__events_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guest-leases/{lease_id}/operations/{operation_id}/inputs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Operation Input */
        post: operations["operation_input_api_v1_guest_leases__lease_id__operations__operation_id__inputs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guest-leases/{lease_id}/personal-learning-assist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Personal Learning Assist */
        post: operations["personal_learning_assist_api_v1_guest_leases__lease_id__personal_learning_assist_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guest-nonce": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Guest Nonce */
        get: operations["guest_nonce_api_v1_guest_nonce_get"];
        put?: never;
        /** Guest Nonce Create */
        post: operations["guest_nonce_create_api_v1_guest_nonce_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Live */
        get: operations["live_api_v1_health_live_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Ready */
        get: operations["ready_api_v1_health_ready_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/model-profiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Model Profiles */
        get: operations["model_profiles_api_v1_model_profiles_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sync/claims": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Claim Local Space */
        post: operations["claimLocalSpace"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sync/claims/{claim_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Recover Claim */
        get: operations["recoverLocalClaim"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sync/spaces": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Spaces */
        get: operations["listSyncSpaces"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sync/spaces/{space_id}/batches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Sync Batch */
        post: operations["syncLocalBatch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sync/spaces/{space_id}/changes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read Changes */
        get: operations["readSyncChanges"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sync/spaces/{space_id}/conflicts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read Conflicts */
        get: operations["readSyncConflicts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** AccountOutput */
        AccountOutput: {
            /**
             * Account Type
             * @enum {string}
             */
            account_type: "student" | "teacher";
            /** Display Name */
            display_name: string;
            /** Email */
            email: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Teacher Verification State */
            teacher_verification_state: ("pending" | "verified" | "rejected" | "suspended") | null;
        };
        /** AccountSessionOutput */
        AccountSessionOutput: {
            account: components["schemas"]["AccountOutput"];
        };
        /** BatchRequest */
        BatchRequest: {
            /**
             * Batch Id
             * Format: uuid
             */
            batch_id: string;
            /**
             * Expected Account Id
             * Format: uuid
             */
            expected_account_id: string;
            /** Operations */
            operations: components["schemas"]["SyncOperation"][];
        };
        /** BatchResponse */
        BatchResponse: {
            /**
             * Batch Id
             * Format: uuid
             */
            batch_id: string;
            /** Cursor */
            cursor?: null;
            /** Results */
            results: components["schemas"]["OperationResult"][];
            /**
             * Space Id
             * Format: uuid
             */
            space_id: string;
        };
        /** CSRFOutput */
        CSRFOutput: {
            /** Csrf Token */
            csrf_token: string;
        };
        /** CatalogCourse */
        CatalogCourse: {
            /** Activities Scope */
            activities_scope: string;
            /** Code */
            code: string;
            /**
             * Content State
             * @enum {string}
             */
            content_state: "planned" | "engineering_example";
            /**
             * Count Scope
             * @enum {string}
             */
            count_scope: "not_available" | "engineering_example";
            /** Environment Boundary */
            environment_boundary: string;
            /**
             * Full Course Available
             * @constant
             */
            full_course_available: false;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Objective Count */
            objective_count: number | null;
            /**
             * Origin Kind
             * @constant
             */
            origin_kind: "platform_default";
            /** Scope Note */
            scope_note: string;
            /** Title */
            title: string;
            /** Verification Scope */
            verification_scope: string;
            /** Version */
            version: string;
            /**
             * Version Id
             * Format: uuid
             */
            version_id: string;
        };
        /** ChangeResponse */
        ChangeResponse: {
            /** Deleted */
            deleted: boolean;
            /** Object Id */
            object_id: string;
            /**
             * Object Type
             * @enum {string}
             */
            object_type: "draft" | "revision" | "evidence" | "help" | "teacher_draft" | "position" | "personal_course" | "personal_course_version" | "personal_attempt" | "personal_assist" | "course_attempt";
            /** Payload */
            payload: {
                [key: string]: unknown;
            } | null;
            /** Payload Hash */
            payload_hash: string;
            /**
             * Provenance
             * @default client_reported
             * @constant
             */
            provenance: "client_reported";
            /** Requires Review */
            requires_review: boolean;
            /** Sequence */
            sequence: string;
            /**
             * Server Object Id
             * Format: uuid
             */
            server_object_id: string;
            /** Version */
            version: string;
        };
        /** ChangesResponse */
        ChangesResponse: {
            /** Changes */
            changes: components["schemas"]["ChangeResponse"][];
            /** Has More */
            has_more: boolean;
            /** Next Cursor */
            next_cursor: string;
            /**
             * Space Id
             * Format: uuid
             */
            space_id: string;
        };
        /** ClaimRequest */
        ClaimRequest: {
            /**
             * Claim Id
             * Format: uuid
             */
            claim_id: string;
            /**
             * Expected Account Id
             * Format: uuid
             */
            expected_account_id: string;
            /** Manifest Hash */
            manifest_hash: string;
            /**
             * Origin Local Space Id
             * Format: uuid
             */
            origin_local_space_id: string;
        };
        /** ClaimResponse */
        ClaimResponse: {
            /**
             * Claim Id
             * Format: uuid
             */
            claim_id: string;
            /**
             * Committed At
             * Format: date-time
             */
            committed_at: string;
            /**
             * Expected Account Id
             * Format: uuid
             */
            expected_account_id: string;
            /** Manifest Hash */
            manifest_hash: string;
            /**
             * Origin Local Space Id
             * Format: uuid
             */
            origin_local_space_id: string;
            /**
             * Server Space Id
             * Format: uuid
             */
            server_space_id: string;
            /**
             * State
             * @default committed
             * @constant
             */
            state: "committed";
        };
        /** ConfirmationOutput */
        ConfirmationOutput: {
            /**
             * Status
             * @default confirmation_required
             * @constant
             */
            status: "confirmation_required";
        };
        /** ConfirmedOutput */
        ConfirmedOutput: {
            /**
             * Status
             * @default email_confirmed
             * @constant
             */
            status: "email_confirmed";
        };
        /** ConflictResponse */
        ConflictResponse: {
            /** Base Version */
            base_version: string;
            /**
             * Conflict Id
             * Format: uuid
             */
            conflict_id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Current Version */
            current_version: string;
            /** Incoming Payload */
            incoming_payload: {
                [key: string]: unknown;
            };
            /** Object Id */
            object_id: string;
            /**
             * Object Type
             * @enum {string}
             */
            object_type: "draft" | "revision" | "evidence" | "help" | "teacher_draft" | "position" | "personal_course" | "personal_course_version" | "personal_attempt" | "personal_assist" | "course_attempt";
            /** Payload Hash */
            payload_hash: string;
            /**
             * Provenance
             * @default client_reported
             * @constant
             */
            provenance: "client_reported";
        };
        /** ConflictsResponse */
        ConflictsResponse: {
            /** Conflicts */
            conflicts: components["schemas"]["ConflictResponse"][];
            /**
             * Space Id
             * Format: uuid
             */
            space_id: string;
        };
        /** CourseCatalog */
        CourseCatalog: {
            /** Catalog Version */
            catalog_version: string;
            /** Courses */
            courses: components["schemas"]["CatalogCourse"][];
            /** Schema Version */
            schema_version: string;
        };
        /** Criterion */
        Criterion: {
            /**
             * Id
             * @enum {string}
             */
            id: "state_trace" | "boundary_condition" | "explanation" | "independent_transfer";
            /** Reason */
            reason: string;
            /**
             * Status
             * @enum {string}
             */
            status: "met" | "not_met" | "needs_review";
        };
        /** EmailInput */
        EmailInput: {
            /** Email */
            email: string;
            /** Nonce */
            nonce: string;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** LearningAssistReply */
        LearningAssistReply: {
            /**
             * Mastery Asserted
             * @default false
             * @constant
             */
            mastery_asserted: false;
            /** Message */
            message: string;
            /** Next Action */
            next_action: string;
        };
        /** LearningAssistRequest */
        LearningAssistRequest: {
            /**
             * Activity Version
             * @constant
             */
            activity_version: "CS03-STACK-01-TRACE@0.1.0";
            /**
             * Artifact Id
             * Format: uuid
             */
            artifact_id: string;
            /**
             * Course Code
             * @constant
             */
            course_code: "CS03";
            /**
             * Course Version
             * @constant
             */
            course_version: "CS03-example-0.2.0";
            /**
             * Disclosure Accepted
             * @constant
             */
            disclosure_accepted: true;
            /**
             * Explanation
             * @default
             */
            explanation: string;
            /** Goal */
            goal: string;
            /**
             * Intent
             * @enum {string}
             */
            intent: "diagnose" | "explain" | "hint" | "practice" | "result_feedback";
            /** Model Profile Id */
            model_profile_id?: string | null;
            /**
             * Objective Code
             * @constant
             */
            objective_code: "CS03-STACK-01";
            /** Operation Id */
            operation_id?: string | null;
            /**
             * Question
             * @default
             */
            question: string;
            /**
             * Request Id
             * Format: uuid
             */
            request_id: string;
            /**
             * Revision Id
             * Format: uuid
             */
            revision_id: string;
            /**
             * Work Excerpt
             * @default
             */
            work_excerpt: string;
        };
        /** LeaseRequest */
        LeaseRequest: {
            /**
             * Course Code
             * @default CS03
             * @enum {string}
             */
            course_code: "CS03" | "CS05";
            /** Nonce */
            nonce: string;
        };
        /** LeaseResponse */
        LeaseResponse: {
            /**
             * Absolute Expires At
             * Format: date-time
             */
            absolute_expires_at: string;
            /** Allowed Operations */
            allowed_operations: ("verify_trace" | "verify_truth_table" | "learning_assist")[];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Idle Expires At
             * Format: date-time
             */
            idle_expires_at: string;
            /**
             * Lease Id
             * Format: uuid
             */
            lease_id: string;
            /**
             * Storage
             * @constant
             */
            storage: "ephemeral_memory";
            /** Token */
            token: string;
        };
        /** LogicCriterion */
        LogicCriterion: {
            /**
             * Id
             * @enum {string}
             */
            id: "implication" | "contrapositive" | "biconditional" | "explanation" | "independent_transfer";
            /** Reason */
            reason: string;
            /**
             * Status
             * @enum {string}
             */
            status: "met" | "not_met" | "needs_review";
        };
        /** LogicVerificationResult */
        LogicVerificationResult: {
            /**
             * Activity Id
             * Format: uuid
             */
            activity_id: string;
            /** Activity Version */
            activity_version: string;
            /**
             * Activity Version Id
             * Format: uuid
             */
            activity_version_id: string;
            /** Artifact Hash */
            artifact_hash: string;
            /** Checker Version */
            checker_version: string;
            /**
             * Client Artifact Id
             * Format: uuid
             */
            client_artifact_id: string;
            /**
             * Client Revision Id
             * Format: uuid
             */
            client_revision_id: string;
            /**
             * Course Code
             * @constant
             */
            course_code: "CS05";
            /**
             * Course Id
             * Format: uuid
             */
            course_id: string;
            /** Course Version */
            course_version: string;
            /**
             * Course Version Id
             * Format: uuid
             */
            course_version_id: string;
            /** Criteria */
            criteria: components["schemas"]["LogicCriterion"][];
            /**
             * Mastery Asserted
             * @constant
             */
            mastery_asserted: false;
            /** Objective Ids */
            objective_ids: string[];
            /**
             * Objective State
             * @enum {string}
             */
            objective_state: "evidence_pending_review" | "practicing";
            /**
             * Provenance
             * @constant
             */
            provenance: "server_deterministic_checker";
            /** Rows */
            rows: components["schemas"]["TruthTableFeedback"][];
            /** Runtime */
            runtime: string;
            /** Standard Version */
            standard_version: string;
            /** Summary */
            summary: string;
            /** Truth Correct */
            truth_correct: boolean;
            /**
             * Verification Id
             * Format: uuid
             */
            verification_id: string;
        };
        /** LoginInput */
        LoginInput: {
            /** Email */
            email: string;
            /** Nonce */
            nonce: string;
            /** Password */
            password: string;
        };
        /** LoginOutput */
        LoginOutput: {
            account: components["schemas"]["AccountOutput"];
            /** Csrf Token */
            csrf_token: string;
        };
        /** NonceOutput */
        NonceOutput: {
            /** Nonce */
            nonce: string;
        };
        /** NonceResponse */
        NonceResponse: {
            /**
             * Expires At
             * Format: date-time
             */
            expires_at: string;
            /** Nonce */
            nonce: string;
        };
        /** OperationInput */
        OperationInput: {
            /** Expected Revision */
            expected_revision: string;
            /**
             * Explanation
             * @default
             */
            explanation: string;
            /**
             * Op Id
             * Format: uuid
             */
            op_id: string;
            /** Trace */
            trace: components["schemas"]["TraceStep"][];
        };
        /** OperationResponse */
        OperationResponse: {
            /** Acknowledged */
            acknowledged: boolean;
            /**
             * Kind
             * @enum {string}
             */
            kind: "verify_trace" | "verify_truth_table";
            /**
             * Lease Id
             * Format: uuid
             */
            lease_id: string;
            /**
             * Operation Id
             * Format: uuid
             */
            operation_id: string;
            /** Result */
            result: components["schemas"]["VerificationResult"] | components["schemas"]["LogicVerificationResult"] | null;
            /** Revision */
            revision: string;
            /**
             * Status
             * @enum {string}
             */
            status: "awaiting_input" | "completed" | "cancelled" | "acknowledged";
            /**
             * Storage
             * @constant
             */
            storage: "ephemeral_memory";
        };
        /** OperationResult */
        OperationResult: {
            /** Conflict Id */
            conflict_id?: string | null;
            /** Current Version */
            current_version: string;
            /** Object Id */
            object_id: string;
            /** Object Type */
            object_type: ("draft" | "revision" | "evidence" | "help" | "teacher_draft" | "position" | "personal_course" | "personal_course_version" | "personal_attempt" | "personal_assist" | "course_attempt") | "attachment";
            /**
             * Op Id
             * Format: uuid
             */
            op_id: string;
            /** Reason */
            reason?: string | null;
            /**
             * Status
             * @enum {string}
             */
            status: "applied" | "already_applied" | "conflict" | "rejected" | "dependency_pending";
        };
        /** PasswordResetOutput */
        PasswordResetOutput: {
            /**
             * Status
             * @default password_reset
             * @constant
             */
            status: "password_reset";
        };
        /** PersonalLearningAssistRequest */
        PersonalLearningAssistRequest: {
            /** Attempt Excerpt */
            attempt_excerpt: string;
            /**
             * Attempt Id
             * Format: uuid
             */
            attempt_id: string;
            /** Course Goal */
            course_goal: string;
            /**
             * Course Id
             * Format: uuid
             */
            course_id: string;
            /** Course Title */
            course_title: string;
            /**
             * Disclosure Accepted
             * @constant
             */
            disclosure_accepted: true;
            /** Expected Performance */
            expected_performance: string;
            /**
             * Intent
             * @enum {string}
             */
            intent: "diagnose" | "explain" | "hint" | "practice";
            /** Model Profile Id */
            model_profile_id?: string | null;
            /** Question */
            question: string;
            /**
             * Request Id
             * Format: uuid
             */
            request_id: string;
            /**
             * Scope Version Id
             * Format: uuid
             */
            scope_version_id: string;
            /**
             * Topic Id
             * Format: uuid
             */
            topic_id: string;
            /** Topic Title */
            topic_title: string;
        };
        /** PublicModelCatalog */
        PublicModelCatalog: {
            /** Profiles */
            profiles: components["schemas"]["PublicModelProfile"][];
            /** Task Defaults */
            task_defaults: {
                [key: string]: string;
            };
        };
        /** PublicModelProfile */
        PublicModelProfile: {
            /** Capabilities */
            capabilities: string[];
            /** Id */
            id: string;
            /** Label */
            label: string;
            /** Provider */
            provider: string;
        };
        /** RegisterInput */
        RegisterInput: {
            /**
             * Account Type
             * @enum {string}
             */
            account_type: "student" | "teacher";
            /** Display Name */
            display_name: string;
            /** Email */
            email: string;
            /** Nonce */
            nonce: string;
            /** Password */
            password: string;
        };
        /** ResetConfirmInput */
        ResetConfirmInput: {
            /** Nonce */
            nonce: string;
            /** Password */
            password: string;
            /** Token */
            token: string;
        };
        /** ResetRequestedOutput */
        ResetRequestedOutput: {
            /**
             * Status
             * @default reset_requested
             * @constant
             */
            status: "reset_requested";
        };
        /** RevisionCommand */
        RevisionCommand: {
            /** Expected Revision */
            expected_revision: string;
        };
        /** SpaceResponse */
        SpaceResponse: {
            /**
             * Bound At
             * Format: date-time
             */
            bound_at: string;
            /**
             * Kind
             * @constant
             */
            kind: "personal";
            /**
             * Origin Local Space Id
             * Format: uuid
             */
            origin_local_space_id: string;
            /**
             * Space Id
             * Format: uuid
             */
            space_id: string;
            /** Version */
            version: string;
        };
        /** SpacesResponse */
        SpacesResponse: {
            /** Spaces */
            spaces: components["schemas"]["SpaceResponse"][];
        };
        /** SyncOperation */
        SyncOperation: {
            /** Base Version */
            base_version: string;
            /** Object Id */
            object_id: string;
            /** Object Type */
            object_type: ("draft" | "revision" | "evidence" | "help" | "teacher_draft" | "position" | "personal_course" | "personal_course_version" | "personal_attempt" | "personal_assist" | "course_attempt") | "attachment";
            /**
             * Op Id
             * Format: uuid
             */
            op_id: string;
            /** Payload */
            payload: {
                [key: string]: unknown;
            };
            /** Payload Hash */
            payload_hash: string;
        };
        /** TokenInput */
        TokenInput: {
            /** Nonce */
            nonce: string;
            /** Token */
            token: string;
        };
        /** TraceFeedback */
        TraceFeedback: {
            /** Correct */
            correct: boolean;
            /** Index */
            index: number;
            /** Issues */
            issues: string[];
        };
        /** TraceStep */
        TraceStep: {
            /** After Stack */
            after_stack: number[];
            /** Output */
            output: number | null;
            /** Underflow */
            underflow: boolean;
        };
        /** TraceSubmission */
        TraceSubmission: {
            /**
             * Activity Version
             * @constant
             */
            activity_version: "CS03-STACK-01-TRACE@0.1.0";
            /**
             * Client Artifact Id
             * Format: uuid
             */
            client_artifact_id: string;
            /**
             * Client Revision Id
             * Format: uuid
             */
            client_revision_id: string;
            /**
             * Course Code
             * @default CS03
             * @constant
             */
            course_code: "CS03";
            /**
             * Explanation
             * @default
             */
            explanation: string;
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "verify_trace";
            /**
             * Standard Version
             * @constant
             */
            standard_version: "stack-trace-v1";
            /** Trace */
            trace?: components["schemas"]["TraceStep"][] | null;
        };
        /** TruthTableFeedback */
        TruthTableFeedback: {
            /** Correct */
            correct: boolean;
            /** Expected */
            expected: {
                [key: string]: boolean;
            };
            /** Index */
            index: number;
            /** Issues */
            issues: ("implication" | "contrapositive" | "biconditional")[];
            /** P */
            p: boolean;
            /** Q */
            q: boolean;
        };
        /** TruthTableRow */
        TruthTableRow: {
            /** Biconditional */
            biconditional: boolean;
            /** Contrapositive */
            contrapositive: boolean;
            /** Implication */
            implication: boolean;
        };
        /** TruthTableSubmission */
        TruthTableSubmission: {
            /**
             * Activity Version
             * @constant
             */
            activity_version: "CS05-LOGIC-01-TABLE@0.1.0";
            /**
             * Client Artifact Id
             * Format: uuid
             */
            client_artifact_id: string;
            /**
             * Client Revision Id
             * Format: uuid
             */
            client_revision_id: string;
            /**
             * Course Code
             * @constant
             */
            course_code: "CS05";
            /**
             * Explanation
             * @default
             */
            explanation: string;
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            kind: "verify_truth_table";
            /** Rows */
            rows: components["schemas"]["TruthTableRow"][];
            /**
             * Standard Version
             * @constant
             */
            standard_version: "propositional-table-v1";
        };
        /** ValidationError */
        ValidationError: {
            /** Context */
            ctx?: Record<string, never>;
            /** Input */
            input?: unknown;
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
        /** VerificationResult */
        VerificationResult: {
            /**
             * Activity Id
             * Format: uuid
             */
            activity_id: string;
            /** Activity Version */
            activity_version: string;
            /**
             * Activity Version Id
             * Format: uuid
             */
            activity_version_id: string;
            /** Artifact Hash */
            artifact_hash: string;
            /** Checker Version */
            checker_version: string;
            /**
             * Client Artifact Id
             * Format: uuid
             */
            client_artifact_id: string;
            /**
             * Client Revision Id
             * Format: uuid
             */
            client_revision_id: string;
            /**
             * Course Code
             * @constant
             */
            course_code: "CS03";
            /**
             * Course Id
             * Format: uuid
             */
            course_id: string;
            /** Course Version */
            course_version: string;
            /**
             * Course Version Id
             * Format: uuid
             */
            course_version_id: string;
            /** Criteria */
            criteria: components["schemas"]["Criterion"][];
            /**
             * Mastery Asserted
             * @constant
             */
            mastery_asserted: false;
            /** Objective Ids */
            objective_ids: string[];
            /**
             * Objective State
             * @enum {string}
             */
            objective_state: "evidence_pending_review" | "practicing";
            /**
             * Provenance
             * @constant
             */
            provenance: "server_deterministic_checker";
            /** Rows */
            rows: components["schemas"]["TraceFeedback"][];
            /** Runtime */
            runtime: string;
            /** Standard Version */
            standard_version: string;
            /** Summary */
            summary: string;
            /** Trace Correct */
            trace_correct: boolean;
            /**
             * Verification Id
             * Format: uuid
             */
            verification_id: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    current_csrf_api_v1_auth_csrf_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CSRFOutput"];
                };
            };
        };
    };
    login_api_v1_auth_login_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginInput"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginOutput"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    logout_api_v1_auth_logout_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    nonce_api_v1_auth_nonce_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NonceOutput"];
                };
            };
        };
    };
    reset_confirm_api_v1_auth_password_reset_confirm_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResetConfirmInput"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PasswordResetOutput"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reset_request_api_v1_auth_password_reset_request_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailInput"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResetRequestedOutput"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    register_api_v1_auth_register_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegisterInput"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfirmationOutput"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    current_session_api_v1_auth_session_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountSessionOutput"];
                };
            };
        };
    };
    verify_email_api_v1_auth_verify_email_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TokenInput"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConfirmedOutput"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    course_scopes_api_v1_course_scopes_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    courses_api_v1_courses_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CourseCatalog"];
                };
            };
        };
    };
    course_version_api_v1_courses__course_id__versions__version_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                course_id: string;
                version_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    execution_job_api_v1_execution_jobs_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    create_lease_api_v1_guest_leases_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LeaseRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LeaseResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    learning_assist_api_v1_guest_leases__lease_id__learning_assist_post: {
        parameters: {
            query?: never;
            header?: {
                authorization?: string | null;
            };
            path: {
                lease_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LearningAssistRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LearningAssistReply"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_operation_api_v1_guest_leases__lease_id__operations_post: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
                authorization?: string | null;
            };
            path: {
                lease_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TraceSubmission"] | components["schemas"]["TruthTableSubmission"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    operation_snapshot_api_v1_guest_leases__lease_id__operations__operation_id__get: {
        parameters: {
            query?: never;
            header?: {
                authorization?: string | null;
            };
            path: {
                lease_id: string;
                operation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    operation_ack_api_v1_guest_leases__lease_id__operations__operation_id__ack_post: {
        parameters: {
            query?: never;
            header?: {
                authorization?: string | null;
            };
            path: {
                lease_id: string;
                operation_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RevisionCommand"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    operation_cancel_api_v1_guest_leases__lease_id__operations__operation_id__cancel_post: {
        parameters: {
            query?: never;
            header?: {
                authorization?: string | null;
            };
            path: {
                lease_id: string;
                operation_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RevisionCommand"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    operation_events_api_v1_guest_leases__lease_id__operations__operation_id__events_get: {
        parameters: {
            query?: never;
            header?: {
                authorization?: string | null;
                "last-event-id"?: string;
            };
            path: {
                lease_id: string;
                operation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    operation_input_api_v1_guest_leases__lease_id__operations__operation_id__inputs_post: {
        parameters: {
            query?: never;
            header?: {
                authorization?: string | null;
            };
            path: {
                lease_id: string;
                operation_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OperationInput"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperationResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    personal_learning_assist_api_v1_guest_leases__lease_id__personal_learning_assist_post: {
        parameters: {
            query?: never;
            header?: {
                authorization?: string | null;
            };
            path: {
                lease_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PersonalLearningAssistRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LearningAssistReply"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    guest_nonce_api_v1_guest_nonce_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NonceResponse"];
                };
            };
        };
    };
    guest_nonce_create_api_v1_guest_nonce_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NonceResponse"];
                };
            };
        };
    };
    live_api_v1_health_live_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    ready_api_v1_health_ready_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    model_profiles_api_v1_model_profiles_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicModelCatalog"];
                };
            };
        };
    };
    claimLocalSpace: {
        parameters: {
            query?: never;
            header?: {
                "idempotency-key"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClaimRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClaimResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    recoverLocalClaim: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                claim_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ClaimResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    listSyncSpaces: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SpacesResponse"];
                };
            };
        };
    };
    syncLocalBatch: {
        parameters: {
            query?: never;
            header?: {
                "idempotency-key"?: string | null;
            };
            path: {
                space_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BatchRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BatchResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    readSyncChanges: {
        parameters: {
            query?: {
                cursor?: string | null;
                limit?: number;
            };
            header?: never;
            path: {
                space_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChangesResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    readSyncConflicts: {
        parameters: {
            query?: {
                limit?: number;
            };
            header?: never;
            path: {
                space_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConflictsResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
