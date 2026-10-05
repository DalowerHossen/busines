<!-- .github/SECURITY.md -->

# Security policy

KD SOLUTION IT handles payment data, personally identifiable information,
and KYC documents on behalf of its customers. We take security reports
seriously and appreciate responsible disclosure.

## Reporting a vulnerability

Email **security@kdsolutionit.com** with:

- A description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a proof of concept.
- The URL, endpoint, or component affected.
- Your assessment of severity, if you have one.

Do not open a public GitHub issue for security vulnerabilities.

## What to expect

- Acknowledgement of your report within 2 business days.
- An initial severity assessment within 5 business days.
- Regular status updates until the issue is resolved.
- Credit in the release notes if you would like it, once a fix ships.

## Scope

In scope:

- The production application at the primary deployment domain.
- Public REST API endpoints and webhooks.
- Authentication, tokenized client-link access, and payment flows.

Out of scope:

- Automated vulnerability scanner output with no demonstrated impact.
- Denial-of-service testing against shared infrastructure.
- Social engineering against staff or customers.
- Issues in third-party payment gateways themselves (report those to the
  gateway provider directly).

## Safe harbor

We will not pursue legal action against researchers who make a good-faith
effort to follow this policy, avoid privacy violations and data destruction,
and give us a reasonable time to remediate before any public disclosure.

## Supported versions

Only the `main` branch and the most recent production deployment receive
security fixes. There are no long-term support branches.
