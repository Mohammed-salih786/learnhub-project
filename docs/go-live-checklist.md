# Go-Live Checklist

## Flask and MongoDB Atlas
- [ ] Separate Atlas database created for production.
- [ ] Database user is limited to the application database.
- [ ] Network access is restricted to deployment infrastructure.
- [ ] Automated backups and restore process are configured.
- [ ] `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`, and `ADMIN_EMAIL` are configured in Flask hosting.
- [ ] Flask health endpoint responds successfully.
- [ ] Admin account is provisioned with the helper script.

## Frontend
- [ ] Next.js deployment points `FLASK_API_URL` to the Flask service.
- [ ] HTTPS and production domain are enabled.
- [ ] Health endpoint shows a connected database.

## Integrations
- [ ] Razorpay keys and webhook secret are configured and validated before accepting payments.
- [ ] Email and video/file services are configured if enabled.
- [ ] Monitoring and uptime alerts cover Flask, the frontend, and Atlas.

## Product readiness
- [ ] Privacy, terms, refund, and grievance pages reviewed for India.
- [ ] Courses, categories, and plans are populated in MongoDB.
- [ ] Signup, login, role checks, and logout are checked for each role.
