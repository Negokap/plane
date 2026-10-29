# Setjoo Projects: build and deploy pipeline

```
merge to setjoo-oidc ──▶ AWS CodeBuild "plane-build" ──▶ ECR "plane" ──▶ sj-app-prod-01 (hst-2) ──▶ https://projects.setjoo.com
                         deploy/build.sh: 6 images,      tags          deploy/deploy.sh: secrets from Infisical,
                         tagged <service>-<commit>       <svc>-<sha>   migrate, start, health check, auto-rollback
```

Production only. No staging.

## For developers

1. Branch off `setjoo-oidc`, build your feature, and open a PR into `setjoo-oidc`.
2. GitHub Actions runs upstream Plane's lint and build checks on the PR.
3. After review, merge. About 30–40 minutes later the change is live. The CodeBuild log shows each step.

You never need AWS access, server access or secret values. If your feature needs a new
environment variable, put its **name** in the PR description. Arya adds the value to
Infisical (`plane` project, `prod`) before the merge. Values in the browser bundle (`VITE_*`)
are build args in `deploy/build.sh`, not secrets.

## Running it by hand (people with server access)

- Status: `ssh hst-2 'cat /opt/setjoo-projects/.deployed-tag; docker ps'`
- Redeploy or roll back to a commit already in ECR:
  `ssh hst-2 'cd /opt/setjoo-projects && sudo PLANE_IMAGE=535391556744.dkr.ecr.us-east-1.amazonaws.com/plane PLANE_TAG=<sha> bash deploy.sh'`
  (The ECR login on the box lasts 12 hours. Re-run the CodeBuild project if it has expired.)
- Rebuild without a code change: start a build of `plane-build` in the AWS console.

## Secrets

All runtime config sits in one Infisical project, **`plane`, env `prod`**, at secrets.pierrepjoseph.com.
On every deploy it is exported into `/opt/setjoo-projects/.env` (root-only, mode 600). Every container reads
that one file. The key names are in `DEPLOYMENT.md`. Do **not** put `PORT` there: live gets `PORT=3000` from the
compose file, and the API would also pick it up. The box's machine identity is read-only. Only Arya and Pierre
change values.

## One-time setup (Arya)

Nothing here has been run yet.

1. **AWS** (account 535391556744, us-east-1), same shape as kobnoo-build:
   - ECR repo `plane` with a lifecycle rule keeping the last 60 images (10 deploys × 6 services).
   - SSH key pair for the pipeline: the private key goes into SSM SecureString `/plane/deploy-ssh-key`.
   - IAM role `plane-codebuild-role`: ECR push/pull on `plane`, `ssm:GetParameter` on `/plane/deploy-ssh-key`, CloudWatch logs.
   - CodeBuild project `plane-build`: source GitHub `Negokap/plane`, image `aws/codebuild/standard:7.0`,
     **privileged**, `BUILD_GENERAL1_LARGE`, buildspec `buildspec.yml`, webhook PUSH on `^refs/heads/setjoo-oidc$`.
2. **Server (hst-2)**:
   - Add the pipeline's public key to `deploy`'s `~/.ssh/authorized_keys`.
   - Install the Infisical CLI.
   - `sudo mkdir -p /opt/setjoo-projects && sudo chown deploy: /opt/setjoo-projects`.
3. **Infisical**:
   - Create project `plane` (env `prod`).
   - Import the current values. This merge runs on the box, and the file never leaves it until you import it:
     `cd /opt/plane && sudo sh -c 'cat apps/api/.env .env apps/live/.env | grep -v "^PORT=" | awk -F= "/=/ && !s[\$1]++" > /root/plane-import.env'`
     (the API's values win; the root `.env` POSTGRES_PORT belonged to the removed local DB).
     Import it through the UI's .env import, then delete `/root/plane-import.env`.
   - Create a read-only machine identity for `plane/prod`. Write its `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`
     and `INFISICAL_PROJECT_ID` into `/root/.infisical/plane.env` (mode 600).
4. **GitHub**: protect `setjoo-oidc` (PR plus one review required, no direct pushes). Merging is then the only way to deploy.
5. **First deploy**: start `plane-build` by hand. It takes the running containers over from `/opt/plane` with no data
   move, because the compose project name `plane` keeps the same containers and volumes. Keep `/opt/plane` as a
   reference until the first deploy is healthy.
