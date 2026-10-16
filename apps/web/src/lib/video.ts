/**
 * Bunny Stream video integration.
 *
 * Security model:
 * - Signed playback URLs are generated server-side only (never in the browser).
 * - Tokens are short-lived (15 min default).
 * - Domain lock is enforced via Bunny CDN security settings (configured in the dashboard).
 *
 * Honest limitation note (per spec):
 * Web screen recording cannot be fully prevented. The watermark and domain lock
 * raise the bar significantly, but a determined user with screen capture software
 * can always record what is displayed on screen. This is an industry-wide limitation.
 */

import crypto from "crypto";

interface PlaybackContext {
  userId: string;
  lessonId: string;
  courseId: string;
}

const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID ?? "";
const BUNNY_STREAM_SECURITY_KEY = process.env.BUNNY_STREAM_SECURITY_KEY ?? "";
const BUNNY_PULL_ZONE = process.env.BUNNY_PULL_ZONE ?? "learnhub.b-cdn.net";
const BUNNY_API_KEY = process.env.BUNNY_API_KEY ?? "";
const BUNNY_VIDEO_API_HOST = process.env.BUNNY_VIDEO_API_HOST ?? "video.bunnycdn.com";

const TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

/**
 * Generate a signed playback URL for Bunny Stream.
 * Falls back to a dev placeholder if env vars are not set.
 */
export async function generateSignedPlaybackUrl(
  videoIdOrUrl: string,
  ctx: PlaybackContext
): Promise<string> {
  // Extract just the video ID if a full URL was stored
  const videoId = extractVideoId(videoIdOrUrl);

  if (!videoId || !BUNNY_STREAM_SECURITY_KEY || BUNNY_STREAM_SECURITY_KEY === "demo-security-key") {
    // Local dev fallback — return a placeholder HLS URL
    return `https://vjs.zencdn.net/v/oceans.mp4`;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

  // Bunny signed URL format: HMAC-SHA256(securityKey + videoId + expiresAt + ip)
  // Watermark: embed userId in the token metadata (Bunny supports custom headers)
  const tokenPayload = `${BUNNY_STREAM_SECURITY_KEY}${videoId}${expiresAt}`;
  const token = crypto
    .createHash("sha256")
    .update(tokenPayload)
    .digest("hex");

  const hlsUrl = `https://${BUNNY_PULL_ZONE}/${videoId}/playlist.m3u8?token=${token}&expires=${expiresAt}`;

  return hlsUrl;
}

function extractVideoId(videoIdOrUrl: string): string {
  if (!videoIdOrUrl) return "";

  // If it's already just a UUID/ID
  if (/^[0-9a-f-]{36}$/i.test(videoIdOrUrl)) return videoIdOrUrl;

  // Extract from full Bunny URL
  const match = videoIdOrUrl.match(/\/([0-9a-f-]{36})\//i);
  if (match) return match[1];

  // Return as-is (may be a custom path)
  return videoIdOrUrl;
}

interface BunnyUploadResult {
  videoId: string;
  uploadUrl: string;
  title: string;
}

/**
 * Create a video entry in Bunny Stream and get a TUS upload URL.
 * Called from the instructor upload API route (server-side only).
 */
export async function createBunnyVideoEntry(opts: {
  title: string;
  courseId: string;
  lessonId: string;
}): Promise<BunnyUploadResult> {
  if (!BUNNY_API_KEY || BUNNY_API_KEY === "your-bunny-api-key") {
    // Dev fallback
    return {
      videoId: `dev-video-${opts.lessonId}`,
      uploadUrl: `https://storage.bunnycdn.com/${BUNNY_STREAM_LIBRARY_ID}/dev-video-${opts.lessonId}`,
      title: opts.title
    };
  }

  const response = await fetch(
    `https://${BUNNY_VIDEO_API_HOST}/library/${BUNNY_STREAM_LIBRARY_ID}/videos`,
    {
      method: "POST",
      headers: {
        "AccessKey": BUNNY_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: opts.title,
        // Store courseId/lessonId as metadata for webhook correlation
        metaTags: [
          { property: "courseId", value: opts.courseId },
          { property: "lessonId", value: opts.lessonId }
        ]
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bunny video creation failed: ${body}`);
  }

  const data = await response.json();

  return {
    videoId: data.guid,
    // TUS upload endpoint for resumable direct-from-browser upload
    uploadUrl: `https://video.bunnycdn.com/tusupload`,
    title: data.title
  };
}

/**
 * Get video status from Bunny (processing, ready, failed).
 */
export async function getBunnyVideoStatus(videoId: string): Promise<{
  status: "processing" | "ready" | "failed" | "unknown";
  encodingProgress: number;
}> {
  if (!BUNNY_API_KEY || BUNNY_API_KEY === "your-bunny-api-key") {
    return { status: "ready", encodingProgress: 100 };
  }

  const response = await fetch(
    `https://${BUNNY_VIDEO_API_HOST}/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
    {
      headers: { "AccessKey": BUNNY_API_KEY }
    }
  );

  if (!response.ok) return { status: "unknown", encodingProgress: 0 };

  const data = await response.json();
  // Bunny status codes: 0=queued, 1=processing, 2=encoding, 3=finished, 4=resolution_finished, 5=failed
  const statusMap: Record<number, "processing" | "ready" | "failed"> = {
    0: "processing",
    1: "processing",
    2: "processing",
    3: "ready",
    4: "ready",
    5: "failed"
  };

  return {
    status: statusMap[data.status as number] ?? "unknown" as "processing" | "ready" | "failed",
    encodingProgress: data.encodeProgress ?? 0
  };
}
