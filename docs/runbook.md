# LearnHub Runbook

## API or database unavailable

1. Check `http://localhost:3000/api/health` or the deployed health endpoint.
2. Confirm Flask is running and `FLASK_API_URL` points to it.
3. Check Atlas status, database user permissions, network access list, `MONGODB_URI`, and `MONGODB_DATABASE`.
4. Review Flask service logs for connection timeouts and application errors.

## Account access

- LearnHub accounts live in the `profiles` collection.
- Use `py backend/create_admin.py` to create/update the configured administrator.
- If a user's role changes, log them out and back in to issue a new JWT.

## Backups

Use MongoDB Atlas automated backups for hosted databases. Before restore, take an on-demand snapshot. Restore into a separate database first, verify collections and application access, then schedule the production restore.

For a local logical export, use `mongodump --uri "$env:MONGODB_URI" --db "$env:MONGODB_DATABASE" --out .\backups` and protect the backup because it contains user data.

## Secret rotation

Rotate the Atlas database user password, `JWT_SECRET`, and payment provider secrets in the service environment, then redeploy. Rotating `JWT_SECRET` invalidates all active sessions.
