# Instructor uploads

Allowed file extension and MIME pairs: mp4/video/mp4, webm/video/webm, pdf/application/pdf, png/image/png, jpg or jpeg/image/jpeg, webp/image/webp, and zip/application/zip or application/x-zip-compressed. The upload endpoint validates both values and returns 415 for unsupported or mismatched content. It returns 413 above `UPLOAD_MAX_MB` (default 4 MB on Vercel, 100 MB elsewhere).

Set `STORAGE_PROVIDER=local` only for local development outside Vercel. On Vercel, configure `STORAGE_PROVIDER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_BASE_URL`. For an S3-compatible service, also set `S3_ENDPOINT_URL`.

The browser calls `POST /api/learnhub/instructor/upload/presign` with `{ "fileName": "lesson.pdf", "contentType": "application/pdf" }`, then PUTs the file directly to the returned `uploadUrl` with the returned `Content-Type` header. It stores the returned public `url` in the course or lesson record. The multipart upload endpoint remains available for local development and small files.

Configure the bucket CORS policy to allow direct browser PUTs from the frontend origins. Example AWS S3 CORS configuration (replace origins with the exact dev and production frontend origins):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-frontend.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Never expose S3 secret access keys to the browser. The presign endpoint uses the backend credentials to create a short-lived upload URL.