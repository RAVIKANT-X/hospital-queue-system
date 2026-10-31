# CarePoint Hospital Appointment & Queue Management

A responsive appointment dashboard backed by an Express API and PostgreSQL. This repository provides local development and Docker Compose packaging; it has **not** been deployed to AWS.

## Architecture

```text
Browser ── React + Vite + Tailwind ── Express REST API ── PostgreSQL
              static frontend          Node.js             persistent volume
```

In Compose, the frontend is served by Nginx on port `8080`, the API is on port `5000`, and PostgreSQL is available locally on `127.0.0.1:5433` (container port `5432`).

## Features

- Dashboard appointment counts and recent visit list
- Doctor directory with specialty and booking shortcut
- Appointment booking with patient registration/reuse
- Appointment list with search, status filters, and cancellation
- Single-admin bcrypt login with expiring JWTs for patient and appointment APIs
- API health checks, input validation, and duplicate active-slot protection
- Responsive layout with loading, empty, and error states

## Local development

Requirements: Node.js 22+, npm, and PostgreSQL 16+.

1. Copy `.env.example` to `.env` and set a strong local `DB_PASSWORD`.
2. Create the `hospital_queue` database and apply [`db/init/001-schema.sql`](./db/init/001-schema.sql). The sample doctors are inserted only when the doctors table is empty.
3. Install and start the API:

   ```sh
   npm ci
   npm run dev
   ```

4. Configure admin login as described in [Admin authentication](#admin-authentication).
5. In a second terminal, install and start the frontend:

   ```sh
   cd client
   npm ci
   npm run dev
   ```

Open `http://localhost:5173`. The Vite frontend defaults to the API at `http://localhost:5000`.

## Docker Compose

Docker Desktop (or another Docker Engine with Compose) must be running.

```sh
docker compose up --build
```

Open `http://localhost:8080`. PostgreSQL data is stored in the named `postgres_data` volume. The initialization script runs only when PostgreSQL first creates a data directory; it does not overwrite or migrate an existing volume. **Do not use `docker compose down -v`** if you need to preserve data.

Copy `.env.example` to `.env` before Compose startup. Compose requires `DB_PASSWORD`; `VITE_API_URL` may be set when building the frontend for a non-local API URL. For an existing database, confirm its schema and backups before applying any migrations manually.

## Environment variables

| Variable | Used by | Description |
|---|---|---|
| `PORT` | API | HTTP port; defaults to `5000` |
| `DB_HOST` | API | PostgreSQL host; `db` in Compose, `localhost` locally |
| `DB_PORT` | API | PostgreSQL port; defaults to `5432` |
| `DB_NAME` | API | Database name; defaults to `hospital_queue` |
| `DB_USER` | API | Database user; defaults to `postgres` |
| `DB_PASSWORD` | API / Compose | PostgreSQL password; required by Compose |
| `ADMIN_USERNAME` | API | Single admin login name |
| `ADMIN_PASSWORD_HASH` | API | bcrypt hash of the admin password |
| `JWT_SECRET` | API | Random signing key with at least 32 characters |
| `JWT_EXPIRES_IN` | API | Token lifetime; defaults to `8h` |
| `CORS_ORIGINS` | API | Comma-separated allowed browser origins |
| `VITE_API_URL` | Frontend build | Base URL for the Express API; defaults to `http://localhost:5000` |

Never commit `.env` or use production secrets in a local frontend build.

## Admin authentication

The admin signs in at the dashboard. The API checks one configured username and bcrypt password hash, then returns an eight-hour HS256 JWT. Appointment and patient endpoints require that bearer token; doctor listing and health checks remain available without login. The dashboard keeps the token in session storage and clears it on sign-out or an expired-token response.

Generate a password hash without saving the plaintext password to the repository:

```powershell
$env:ADMIN_INITIAL_PASSWORD = Read-Host "Choose an admin password (at least 12 characters)"
npm run hash-admin-password
Remove-Item Env:ADMIN_INITIAL_PASSWORD
```

Copy the printed bcrypt hash into `ADMIN_PASSWORD_HASH` in `.env`, choose `ADMIN_USERNAME`, and set a random JWT secret (for example, `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`). Configure the same variables in AWS Secrets Manager for a deployed API; never put the password or JWT secret in frontend variables or source control. Compose can start without these values, but login and protected routes return `503` until configured.

## API

All responses are JSON. Booking timestamps should be ISO-8601 strings.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Admin login (`username`, `password`); returns a bearer JWT |
| `GET` | `/health` | API health |
| `GET` | `/db-health` | Database connectivity |
| `GET` | `/api/doctors` | List doctors |
| `POST` | `/api/patients` | Register a patient (`name`, `email`) |
| `GET` | `/api/patients?email=...` | Find a patient by exact email |
| `POST` | `/api/appointments` | Book (`patient_id`, `doctor_id`, `appointment_time`) |
| `GET` | `/api/appointments` | List appointments |
| `GET` | `/api/appointments/:id` | Retrieve one appointment |
| `PATCH` | `/api/appointments/:id/cancel` | Cancel a booked appointment |

Send `Authorization: Bearer <token>` to all `/api/appointments` and `/api/patients` routes. Cancellation changes a visit to `cancelled` rather than deleting it. A partial unique index prevents duplicate doctor/time slots while an appointment is not cancelled.

## Production safety

This simple single-admin login is not a complete production identity or patient-data compliance solution. CORS is not an access-control boundary. Before public exposure or real patient data, complete security review, TLS, managed secrets, privacy/compliance controls, and operational safeguards.

## Tests and builds

```sh
npm test
npm run build
```

The Node test suite exercises API routing and behavior using an in-memory PostgreSQL query stub; it is not a substitute for testing against a running PostgreSQL server. Docker Compose health checks and `/db-health` cover live connectivity when Docker is available.

## AWS deployment readiness

**Your stated limit is no out-of-pocket AWS expense. No AWS workflow has been run and no resources have been created.** You mentioned having an AWS free trial, but this workspace has no AWS account session/CLI, so I cannot verify its activation, plan, remaining credits, expiry, or service eligibility. A free trial is not a universal $0 guarantee: some services may be excluded, usage can exceed allowances, and charges can begin when credits/benefits end or the account is upgraded. AWS Budgets are alerts, not hard spending limits.

Before any AWS action, check the AWS console's account plan and **Billing and Cost Management → Credits/Free Tier**. Confirm that each exact service, Region, size, runtime, storage, and data-transfer amount is included and that the expected amount due is $0. Do not upgrade the account. If $0 cannot be verified, keep the application local and do not provision.

### Cost choices

The following are on-demand list-price estimates, not an account-specific quote. The Mumbai rates below were read from AWS's public `ap-south-1` price list and assume 730 hours/month; free-trial credits and account eligibility are not included.

| Service/design | Planning amount | Notes |
|---|---:|---|
| Lowest-cost Lightsail demo | AWS lists a Linux bundle with 2 GB RAM, 2 vCPU, 60 GB SSD, and 3 TB transfer at **$12/month**. Verify Mumbai pricing and trial eligibility before use. | One host could run Docker Compose and keep PostgreSQL on its persistent disk. No ECS, ECR, or managed RDS; one host is a single point of failure. Snapshots, overage, and domain costs are extra. This is **not $0** at list price. |
| Fargate API | **$9.47/month** | One always-on Linux/x86 task at 0.25 vCPU and 0.5 GB RAM. Mumbai rates: $0.04256/vCPU-hour and $0.004655/GB-hour. |
| RDS PostgreSQL | **$17.95/month** | One `db.t4g.micro` Single-AZ at $0.021/hour plus 20 GB gp3 at $0.131/GB-month; backups beyond included allowance cost extra. |
| Application Load Balancer | **At least $24.75/month** | $0.0239/hour plus two public IPv4 addresses at $0.005/address-hour; variable LCU charges are extra. |
| NAT Gateway | **Budget roughly $45–$55+/month** | One always-on gateway, including a planning allowance for its public IPv4; data processing/transfer is extra. Confirm the exact Mumbai design in AWS Pricing Calculator. A second AZ gateway adds another fixed charge. |
| ECR private image storage | **$0.10/GB-month** | 2 GB of stored images is about $0.20/month; same-region pulls are not charged for transfer. |
| S3 Standard | **$0.025/GB-month** | 1 GB is about $0.03/month; requests are extra. |
| CloudFront | **$0 plan is listed, subject to limits** | Verify eligibility and limits. AWS says its flat-rate plan cannot be combined with other offers/promotions. Pay-as-you-go traffic is variable. |
| CloudWatch | **Budget $1–$5+/month for a small demo** | Actual log ingestion/retention, alarms, and custom metrics determine cost. |

The managed ECS/Fargate + ALB + private RDS design with one NAT gateway is roughly **$100–$120/month before taxes and variable traffic**, even at low traffic. Multi-AZ RDS and a NAT gateway in each AZ increase this materially. Stopping RDS does not stop storage/backup billing; ALB, NAT, and always-on compute can continue to bill while idle. See [AWS Free Tier](https://aws.amazon.com/free/), [AWS Free Tier FAQs](https://aws.amazon.com/free/free-tier-faqs/), and the [AWS Pricing Calculator](https://calculator.aws/). Do not rely on credits until the console confirms the exact services/usage are eligible. No AWS design is recommended for provisioning until the $0 requirement can be verified.

### Managed architecture (for learning, not currently approved to provision)

```text
Browser ─HTTPS─> CloudFront ─> private S3 bucket (React/Vite)
   └────HTTPS──> public ALB ─> ECS/Fargate API in private app subnets
                                      ├─> private RDS PostgreSQL
                                      └─> NAT gateway ─> ECR / Secrets Manager
GitHub Actions ─OIDC─> deployment IAM role ─> ECR / ECS / S3 / CloudFront
ECS task logs ─> CloudWatch Logs
```

### Manual deployment workflow

[`deploy-aws.yml`](./.github/workflows/deploy-aws.yml) is **manual-only** and targets infrastructure that already exists; it does not provision AWS resources. It defaults to `ap-south-1`, serializes deployments, checks HTTPS URLs and the expected 12-digit account ID, tests/builds before AWS access, uses a commit-SHA image tag, waits for ECS stability, checks API/database/auth, publishes S3 assets, invalidates CloudFront, and checks the frontend URL. If ECS stability or API verification fails, it attempts to restore the previous task definition.

Do not run it until explicitly approved and the no-charge requirement is verified. For a future approved setup, protect GitHub's `production` environment with required reviewers and set `AWS_DEPLOY_ROLE_ARN`. Configure OIDC trust for audience `sts.amazonaws.com` and only `repo:RAVIKANT-X/hospital-queue-system:environment:production`; do not store long-lived AWS keys. Restrict permissions to the intended ECR repo, ECS cluster/service/task family, S3 bucket, CloudFront distribution, and ECS task roles (`iam:PassRole`). Enable ECR tag immutability.

Pre-create and verify the VPC/subnets/security groups, ECR repository, ECS cluster/service/roles, private RDS, private S3 bucket with CloudFront Origin Access Control, distribution, log group, HTTPS listener/certificate, and DNS. Configure ECS secrets/environment (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `CORS_ORIGINS`). The workflow does not create secrets or run database migrations. `CORS_ORIGINS` must contain the CloudFront origin.

**Rollback:** failed API deployment verification triggers an attempt to restore the recorded previous ECS task definition and wait for stability. If frontend publishing/verification fails after the API passes, use the run log to redeploy the previous known-good commit with the same reviewed inputs, then invalidate CloudFront. S3 sync intentionally omits `--delete`. Keep database backups and apply only reviewed, forward migrations.

### Current verification and blockers

- The source contains the single-admin bcrypt/JWT implementation, and protects patient and appointment routes. Prior unit tests and frontend build passed; that is not proof of a running deployment.
- Docker currently reports an API container healthy but host requests to `127.0.0.1:5000` fail; PostgreSQL is unhealthy. Docker also cannot read its PostgreSQL log file because its filesystem reports read-only. The running containers are not a verified deployment of the current source.
- The C: drive had about 373 MiB free at the last check. Do not rebuild/recreate the database container or clean Docker data until the filesystem issue is diagnosed. Preserve the existing named PostgreSQL volume.
- No AWS activation/credits were verified, no AWS resources were created, and no production workflow was run. No deployed URL or live end-to-end result is available.
