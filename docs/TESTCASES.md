# TESTCASES

This file lists manual test cases for the MVP UI and Gemini REST flows.

1) API key missing
- Steps: open the app, leave API key empty, click `解析開始`.
- Expected: Alert "Gemini APIキーを入力してください" and no network calls.

2) Audio not selected
- Steps: Save API key, do not select file, click `解析開始`.
- Expected: Alert "音声ファイルを選択してください".

3) Unsupported audio format
- Steps: Select a .txt file or other unsupported MIME, click `解析開始`.
- Expected: Alert "対応していない音声形式です".

4) Successful transcription + summary
- Steps: Select a supported audio (short mp3), click `解析開始`.
- Expected: File upload POST to Files API (`/v1/files:upload`), then POST to `/v1/models/gemini-3.5-flash:generateContent`. Results populate `文字起こし`, `要約`, `要点`.

5) API upload failure (invalid key)
- Steps: Enter invalid API key, upload file.
- Expected: API error block shows full response (status + body). Console shows same details.

6) GenerateContent failure (model errors / rate limit)
- Steps: Force a model error by using an exhausted account or invalid model.
- Expected: API error block shows the generateContent response (HTTP status + body). Results area remains hidden.

7) Large file ( >20 MB ) behavior
- Steps: Upload a file larger than 20 MB.
- Expected: Files API upload should still work (Files API supports up to 2 GB). If upload fails due to policy, the API error block shows the server response.

8) CORS / browser blocked
- Steps: If browser blocks call due to CORS, console shows CORS error and API error block displays the client-side error message.

9) Copy buttons
- Steps: After successful results, click each `コピー`.
- Expected: Clipboard contains the corresponding content and toast "コピーしました" appears.

Notes
- When an API error occurs, copy the error text from the API error block and include it when asking for debugging help.
