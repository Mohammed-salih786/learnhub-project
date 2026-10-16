# Video — LearnHub

## Provider: Bunny Stream

Bunny Stream is chosen for affordable bandwidth costs (important for India), built-in HLS, 
TUS resumable upload, signed playback URLs, and a South Asia CDN PoP.

## Upload Flow (Instructor)

```
Instructor selects video file in browser
  → POST /api/instructor/upload (creates Bunny video entry, returns upload URL + TUS headers)
  → Browser TUS client uploads directly to Bunny (file never passes through our server)
  → Bunny processes video (status: processing → ready)
  → Bunny fires webhook → our endpoint updates lesson.video_url status
```

This approach avoids uploading large files through Vercel (bandwidth costs, 4.5MB body limit on serverless).

## TUS Client (Browser)

Use `tus-js-client` in the instructor upload UI:

```typescript
import * as tus from "tus-js-client";

const upload = new tus.Upload(file, {
  endpoint: "https://video.bunnycdn.com/tusupload",
  retryDelays: [0, 3000, 5000, 10000],
  headers: {
    AuthorizationSignature: response.tusHeaders.AuthorizationSignature,
    AuthorizationExpire: response.tusHeaders.AuthorizationExpire,
    VideoId: response.tusHeaders.VideoId,
    LibraryId: response.tusHeaders.LibraryId,
  },
  metadata: { filename: file.name, filetype: file.type },
  onProgress: (bytesUploaded, bytesTotal) => {
    const percent = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
    setProgress(percent);
  },
  onSuccess: () => setStatus("ready"),
  onError: (error) => setStatus("failed"),
});
upload.start();
```

## Playback

1. Student requests lesson → `GET /api/student/lessons/:id`
2. Server checks entitlement (subscription/trial/preview)
3. If entitled: generates signed HLS URL (`generateSignedPlaybackUrl` in `src/lib/video.ts`)
4. URL expires in **15 minutes** — client must re-request if playback is paused longer
5. Client plays with HLS.js or Video.js

## Signed URL Algorithm

```
token = HMAC-SHA256(BUNNY_STREAM_SECURITY_KEY + videoId + expiresAt)
url = https://{BUNNY_PULL_ZONE}/{videoId}/playlist.m3u8?token={token}&expires={expiresAt}
```

## Domain Lock

Configure in Bunny CDN dashboard:
- Security → Allowed Referrers: `learnhub.in`
- This blocks direct URL sharing to non-whitelisted domains

## User Watermark

A subtle text watermark (user ID + timestamp) is overlaid on the video via CSS/canvas overlay 
in the player component. This discourages casual screen sharing but does not prevent screen recording.

> **Honest limitation**: Web screen recording cannot be fully prevented. Any content 
> displayed in a browser can be captured by screen recording software. The watermark and 
> domain lock raise the barrier but are not a technical guarantee against piracy.

## Environment Variables

```
BUNNY_API_KEY=           # For creating/managing videos via API
BUNNY_LIBRARY_ID=        # Your Bunny video library ID
BUNNY_STREAM_SECURITY_KEY= # For signing playback URLs
BUNNY_PULL_ZONE=         # Your CDN pull zone hostname
BUNNY_VIDEO_API_HOST=video.bunnycdn.com
```
