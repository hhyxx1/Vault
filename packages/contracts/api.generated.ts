// Generated from the implemented FastAPI OpenAPI contract. Do not edit.
export interface paths {
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
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
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
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** LeaseRequest */
        LeaseRequest: {
            /**
             * Course Code
             * @default CS03
             * @constant
             */
            course_code: "CS03";
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
            allowed_operations: "verify_trace"[];
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
             * @constant
             */
            kind: "verify_trace";
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
            result: components["schemas"]["VerificationResult"] | null;
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
        /** RevisionCommand */
        RevisionCommand: {
            /** Expected Revision */
            expected_revision: string;
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
             * Kind
             * @default verify_trace
             * @constant
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
                "application/json": components["schemas"]["TraceSubmission"];
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
}
