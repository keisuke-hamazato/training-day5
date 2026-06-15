# API_NOTES

このファイルは `app.js` の Gemini 呼び出しプレースホルダを実際の API 形に合わせて修正する際の補助メモです。


1) 文字起こし（transcription）

- Approach used in this frontend-only MVP:
  1. Upload the audio file to Gemini Files API: `POST https://api.ai.google.dev/v1/files:upload` (multipart/form-data, `file` field).
  2. Call GenerateContent with the uploaded file reference: `POST https://api.ai.google.dev/v1/models/{model}:generateContent` with `contents` referencing the uploaded file resource and an instruction part requesting transcription.

- Authentication: `Authorization: Bearer <API_KEY>` header.

- Example flow (curl-like, simplified):

```bash
# 1) Upload file
curl -X POST "https://api.ai.google.dev/v1/files:upload" \
  -H "Authorization: Bearer $GEMINI_API_KEY" \
  -F "file=@lecture.m4a"

# Response includes a resource name, e.g. 'files/ABCD...'

# 2) Ask model to transcribe using the uploaded file
curl -X POST "https://api.ai.google.dev/v1/models/gemini-3.5-flash:generateContent" \
  -H "Authorization: Bearer $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-3.5-flash","contents":[{"parts":[{"fileUri":"files/ABCD..."}],"role":"user"},{"parts":[{"text":"あなたは高精度な音声文字起こしAIです。音声内容を日本語で正確に文字起こししてください。出力は文字起こし本文のみ返してください。"}],"role":"user"}]}'
```


2) 要約 / 要点生成（generateContent）

- Input: include the transcript text in a content part and a user instruction that requests a 3-line summary and 3–5 bullet key points in Japanese.
- Endpoint used in this MVP: `POST https://api.ai.google.dev/v1/models/gemini-3.5-flash:generateContent`
- Example payload (JSON):

```json
{
  "model": "gemini-3.5-flash",
  "contents": [
    { "parts": [ { "text": "以下の講義内容を要約してください。\n\n要件:\n- 要約は3行程度\n- 要点は3〜5個\n- 日本語で出力\n\n講義内容:\n${TRANSCRIPT}" } ], "role": "user" }
  ],
  "config": { "response_format": { "text": { "mime_type": "text/plain" } } }
}
```

The response JSON typically includes `candidates` -> content -> parts with `text` fields (example: `response.candidates[0].content.parts[0].text`).


3) CORS とブラウザ直接呼び出し

- The Gemini REST endpoints may allow browser calls when the API key and account permit it, but many deployments restrict CORS. If you encounter CORS errors, you'll see them in the browser console; the app will show the error body in the `API エラー` panel.
- For production, consider using ephemeral tokens or a small server/proxy to avoid embedding long-lived keys in the browser.


4) app.js のポイント

- `sendAudioToGemini` in this repo uploads via `POST /v1/files:upload` and then calls `POST /v1/models/{model}:generateContent` with a file reference + instruction part.
- `sendTranscriptForSummary` calls `POST /v1/models/{model}:generateContent` with a text prompt that includes the transcript; the code reads `candidates[0].content.parts[*].text` or fallbacks.

5) セキュリティ注意

- `localStorage` に保存された API キーはブラウザの他のスクリプトから読み取れるため、公開共有される環境で使わないでください。短期的には開発や個人用途に向きますが、公開アプリではエフェメラルトークンやサーバ側プロキシを検討してください.

References
- Models page: https://ai.google.dev/gemini-api/docs/models
- Audio guide: https://ai.google.dev/gemini-api/docs/audio
- Files API: https://ai.google.dev/gemini-api/docs/files
- Quickstart / generateContent: https://ai.google.dev/gemini-api/docs/quickstart

