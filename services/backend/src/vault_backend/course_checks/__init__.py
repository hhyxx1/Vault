"""Trusted, deterministic course check plugins (adapter E02: structured traces).

Checkers live server-side on purpose: the public course package may carry the
operation prompt, but expected states and the checking logic are never shipped
to or accepted from the browser. See document/course-construction/
ACTIVITY_ENGINE_PLAN.md and DELIVERY_PLAN.md (``services/backend/.../course_checks/``).

Everything here is a pure function over a trusted activity specification. There
is no eval/exec, no client-supplied expectation and no model grading. A machine
or specification fault is a server error (``environment_error`` at the API
boundary); a mismatching student row is always ``not_met``, never an environment
error.
"""
