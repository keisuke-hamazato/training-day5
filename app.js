// Unified frontend-only implementation matched to index.html IDs
(function(){
  const KEY_NAME = 'gemini_api_key';
  // Vertex AI model (Tokyo region stable naming)
  const MODEL = 'gemini-3.5-flash';
  // Use v1 for stability with the new AQ key
  const ENDPOINT = (apiKey) => `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${apiKey}`;

  const ALLOWED_TYPES = ['audio/mpeg','audio/wav','audio/mp4','audio/x-m4a','audio/webm','audio/ogg','audio/aac','audio/flac','audio/aiff'];

  const $ = id => document.getElementById(id);
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');

  function setLoading(on, text){
    const btn = $('analyzeBtn');
    if(on){ if(btn) btn.disabled = true; if($('statusText')) $('statusText').textContent = text || '処理中...'; show($('loading')); hide($('results')); hide($('apiError')); }
    else { if(btn) btn.disabled = false; hide($('loading')); }
  }

  function showToast(msg='コピーしました'){
    const t = $('toast'); if(!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2000);
  }

  function showApiError(msg){ console.error(msg); if($('apiErrorText')) $('apiErrorText').textContent = msg; show($('apiError')); }
  function clearApiError(){ if($('apiErrorText')) $('apiErrorText').textContent = ''; hide($('apiError')); }

  function fileToBase64(file){
    return new Promise((resolve, reject)=>{
      const r = new FileReader();
      r.onerror = () => reject(new Error('ファイル読み込みに失敗しました'));
      r.onload = () => {
        const res = r.result; const idx = res.indexOf(','); if(idx === -1) return reject(new Error('Base64データの解析に失敗しました')); resolve(res.slice(idx+1));
      };
      r.readAsDataURL(file);
    });
  }

  async function sendGenerateRequest(apiKey, body){
    const url = ENDPOINT(apiKey);
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const text = await resp.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch(e) { json = null; }

    if(!resp.ok){
      const err = new Error(`APIエラー: status=${resp.status} ${resp.statusText}`);
      err.status = resp.status;
      err.body = text;
      err.json = json;
      throw err;
    }
    return json;
  }

  function extractText(resp) {
    if (!resp) return '';
    // Handle standard generateContent response
    if (resp.candidates && resp.candidates[0] && resp.candidates[0].content && resp.candidates[0].content.parts) {
      return resp.candidates[0].content.parts.map(p => p.text || '').join('');
    }
    // Fallback for other potential formats
    if (Array.isArray(resp)) {
      return resp.map(chunk => {
        if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
          return chunk.candidates[0].content.parts.map(p => p.text || '').join('');
        }
        return '';
      }).join('');
    }
    return typeof resp === 'string' ? resp : JSON.stringify(resp);
  }

  function splitSummaryAndPoints(text){
    const s = text || '';
    const summaryMatch = s.match(/【\s*要約\s*】\s*([\s\S]*?)(?=【\s*要点\s*】|$)/);
    const pointsMatch = s.match(/【\s*要点\s*】\s*([\s\S]*)/);
    let summary = '', points = [];
    if(summaryMatch) summary = summaryMatch[1].trim(); else summary = s.split('\n').map(l=>l.trim()).filter(Boolean).slice(0,3).join('\n');
    if(pointsMatch){ const raw = pointsMatch[1].trim(); points = raw.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>l.replace(/^[-*・\u2022\s]+/, '').trim()).slice(0,5); }
    else { const rest = s.replace(summary,'').split('\n').map(l=>l.trim()).filter(Boolean).slice(0,5); points = rest.slice(0,5); }
    return { summary, points };
  }

  function handleCopy(e){
    const target = e.currentTarget.dataset.target;
    let text = '';
    if(target === 'transcript') text = ($('transcript') && $('transcript').innerText) || '';
    if(target === 'summary') text = ($('summary') && $('summary').innerText) || '';
    if(target === 'points') text = ($('points') && Array.from($('points').children).map(li=>li.innerText).join('\n')) || '';
    navigator.clipboard.writeText(text).then(()=>showToast('コピーしました'), ()=>showToast('コピー失敗'));
  }

  async function handleAnalyze(){
    clearApiError();
    const apiKey = localStorage.getItem(KEY_NAME);
    if(!apiKey){ alert('Gemini APIキーを保存してください'); return; }
    const fileEl = $('fileInput'); if(!fileEl || !fileEl.files || fileEl.files.length === 0){ alert('音声ファイルを選択してください'); return; }
    const file = fileEl.files[0]; if(!ALLOWED_TYPES.includes(file.type)){ alert('対応していない音声形式です: ' + file.type); return; }

    try{
      // Step1 transcription
      setLoading(true, '音声を文字起こし中...');
      const b64 = await fileToBase64(file);
      const body1 = { contents: [{ parts: [ { inlineData: { mimeType: file.type, data: b64 } }, { text: 'あなたは高精度な音声文字起こしAIです。音声内容を日本語で正確に文字起こししてください。出力は文字起こし本文のみ返してください。余計な説明は不要です。' } ] }] };
      const res1 = await sendGenerateRequest(apiKey, body1);
      const transcript = extractText(res1) || '';
      if($('transcript')) $('transcript').innerText = transcript;

      // Step2 summary
      setLoading(true, '要約と要点を生成中...');
      const prompt = `以下の講義内容を要約してください。\n要件：\n- 要約は3行程度\n- 要点は3〜5個\n- 日本語で出力\n出力形式：\n【要約】\n（要約文）\n【要点】\n- 項目1\n- 項目2\n講義内容：\n${transcript}`;
      const body2 = { contents: [{ parts: [ { text: prompt } ] }] };
      const res2 = await sendGenerateRequest(apiKey, body2);
      const raw = extractText(res2) || '';
      const { summary, points } = splitSummaryAndPoints(raw);
      if($('summary')) $('summary').innerText = summary;
      if($('points')){ const ul = $('points'); ul.innerHTML = ''; points.forEach(p=>{ const li = document.createElement('li'); li.innerText = p; ul.appendChild(li); }); }

      hide($('loading'));
      show($('results'));
    }catch(err){
      console.error('Detailed Error Object:', err);
      let errorMsg = `解析に失敗しました (Status: ${err.status || 'unknown'})`;
      
      if (err.json && err.json.error) {
        errorMsg += `\nMessage: ${err.json.error.message || JSON.stringify(err.json.error)}`;
      } else if (err.body) {
        errorMsg += `\nResponse Body: ${err.body.substring(0, 200)}...`;
      }

      if(err && err.status === 429) showApiError('利用回数上限に達しました。しばらく経ってから再試行してください。\n' + errorMsg);
      else if(err && err.status === 503) showApiError('サービスが一時的に混み合っています。少し時間をおいてから再度お試しください。\n' + errorMsg);
      else showApiError(errorMsg + '\nAPIキーまたは通信状況を確認してください');
    }finally{ setLoading(false); }
  }

  function saveApiKey(){ const v = ($('apiKeyInput') && $('apiKeyInput').value || '').trim(); if(!v){ alert('APIキーを入力してください'); return; } localStorage.setItem(KEY_NAME, v); hide($('api-key-form')); show($('api-key-actions')); runDiagnostics(); }

  function changeApiKey(){ show($('api-key-form')); hide($('api-key-actions')); }

  async function runDiagnostics(){
    const apiKey = localStorage.getItem(KEY_NAME);
    if(!apiKey) return;
    const modelSelect = $('modelSelect');
    if(modelSelect) modelSelect.innerHTML = '<option value="">モデルを取得中...</option>';

    try {
      const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
      const resp = await fetch(url);
      const json = await resp.json();
      
      if(json.models && modelSelect) {
        // Filter generateContent models
        const filtered = json.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'));
        modelSelect.innerHTML = '';
        filtered.forEach(m => {
          const name = m.name.replace('models/', '');
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          // Prefer flash as default
          if(name.includes('flash') && !modelSelect.value.includes('flash')) opt.selected = true;
          modelSelect.appendChild(opt);
        });
      }
    } catch(e) {
      console.error('Diagnostics Error:', e);
      if(modelSelect) modelSelect.innerHTML = '<option value="gemini-3.5-flash">gemini-3.5-flash (取得失敗)</option>';
    }
  }

  function init(){
    const saved = localStorage.getItem(KEY_NAME);
    if(saved){ hide($('api-key-form')); show($('api-key-actions')); runDiagnostics(); } else { show($('api-key-form')); hide($('api-key-actions')); }
    if($('saveApiKeyBtn')) $('saveApiKeyBtn').addEventListener('click', saveApiKey);
    if($('changeApiKeyBtn')) $('changeApiKeyBtn').addEventListener('click', changeApiKey);
    if($('analyzeBtn')) $('analyzeBtn').addEventListener('click', handleAnalyze);
    document.querySelectorAll('.copy-btn').forEach(btn=>btn.addEventListener('click', handleCopy));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
