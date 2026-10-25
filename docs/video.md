# Video and file storage - LearnHub

The Flask upload endpoint currently saves an uploaded file to the backend's local `uploads/` directory and returns its relative path. This is suitable only for local development; ephemeral Flask hosts will not retain uploaded files across redeploys or instances.

Before production course publishing, connect the Flask API to durable object storage or a video provider, store the resulting URL and metadata in the MongoDB `lessons` collection, and restrict playback through the lesson entitlement route. Do not send large files through serverless hosting.

The frontend contains basic lesson playback UI. Signed playback URLs, resumable provider uploads, and webhook-based video processing need provider credentials and implementation before production use.
