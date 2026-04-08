// --- 要素取得 ---
const recordBtn = document.getElementById('recordBtn');
const recordLabel = document.getElementById('recordLabel');
const timerEl = document.getElementById('timer');
const statusEl = document.getElementById('status');
const transcriptSection = document.getElementById('transcriptSection');
const transcriptEl = document.getElementById('transcript');
const generateBtn = document.getElementById('generateBtn');
const loadingEl = document.getElementById('loading');
const karteSection = document.getElementById('karteSection');
const karteEl = document.getElementById('karte');
const copyBtn = document.getElementById('copyBtn');
const copyMsg = document.getElementById('copyMsg');

// --- 状態 ---
let isRecording = false;
let timerInterval = null;
let seconds = 0;
let fullTranscript = '';     // 確定済みテキスト（前セッション分）
let sessionFinalText = '';   // 現セッションの確定済みテキスト
let recognition = null;

// --- Web Speech API セットアップ ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  statusEl.textContent = 'このブラウザは音声認識に対応していません';
  recordBtn.disabled = true;
}

function createRecognition() {
  const rec = new SpeechRecognition();
  rec.lang = 'ja-JP';
  rec.continuous = true;
  rec.interimResults = true;

  sessionFinalText = ''; // 新セッション開始時にリセット

  rec.onresult = (event) => {
    sessionFinalText = '';
    let interimText = '';

    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        sessionFinalText += result[0].transcript;
      } else {
        interimText += result[0].transcript;
      }
    }

    // 表示を更新（interimは薄く表示するため別処理）
    transcriptEl.textContent = fullTranscript + sessionFinalText + interimText;
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  };

  rec.onend = () => {
    if (!isRecording) return;
    // 確定テキストを保存して再開（Web Speech APIは途切れることがある）
    fullTranscript += sessionFinalText;
    sessionFinalText = '';
    try {
      recognition = createRecognition();
      recognition.start();
    } catch (e) { /* ignore */ }
  };

  rec.onerror = (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    console.error('Speech error:', event.error);
    if (event.error === 'not-allowed') {
      statusEl.textContent = 'マイクへのアクセスを許可してください';
      stopRecording();
    } else if (event.error === 'network') {
      statusEl.textContent = '音声認識でネットワークエラーが発生しました';
    }
  };

  return rec;
}

// --- 録音ボタン ---
recordBtn.addEventListener('click', () => {
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
});

function startRecording() {
  isRecording = true;
  fullTranscript = '';
  sessionFinalText = '';
  recordBtn.classList.add('recording');
  recordLabel.textContent = '録音停止';
  statusEl.textContent = '録音中 — 面談を進めてください';
  transcriptSection.style.display = 'block';
  transcriptEl.textContent = '（音声を待っています...）';
  transcriptEl.contentEditable = 'false'; // 録音中は編集不可
  generateBtn.style.display = 'none';
  karteSection.style.display = 'none';

  // タイマー開始
  seconds = 0;
  timerEl.textContent = '00:00';
  timerInterval = setInterval(() => {
    seconds++;
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }, 1000);

  // 音声認識開始
  recognition = createRecognition();
  recognition.start();
}

function stopRecording() {
  isRecording = false;
  recordBtn.classList.remove('recording');
  recordLabel.textContent = '面談を録音';
  statusEl.textContent = '';
  clearInterval(timerInterval);

  if (recognition) {
    try { recognition.abort(); } catch (e) { /* ignore */ }
    recognition = null;
  }

  // 確定済みテキストを確定（DOMに依存せず変数から取得）
  fullTranscript = fullTranscript + sessionFinalText;
  sessionFinalText = '';
  transcriptEl.textContent = fullTranscript;

  if (fullTranscript && fullTranscript !== '（音声を待っています...）') {
    transcriptEl.contentEditable = 'true'; // 録音後は編集可能に
    generateBtn.style.display = 'block';
    statusEl.textContent = `書き起こし完了（${Math.floor(seconds / 60)}分${seconds % 60}秒）— 誤変換があれば上のテキストを直接修正できます`;
  } else {
    statusEl.textContent = '音声が認識されませんでした。もう一度お試しください。';
  }
}

// --- カルテ生成 ---
generateBtn.addEventListener('click', async () => {
  const studentName = document.getElementById('studentName').value.trim();
  const tutorName = document.getElementById('tutorName').value.trim();

  // 編集済みの書き起こしを使用
  const transcript = transcriptEl.textContent.trim();

  generateBtn.disabled = true;
  generateBtn.textContent = '生成中...';
  loadingEl.style.display = 'block';
  karteSection.style.display = 'none';

  try {
    const res = await fetch('/api/generate-karte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, studentName, tutorName }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'サーバーエラー');
    }

    const data = await res.json();
    karteEl.textContent = data.karte;
    karteSection.style.display = 'block';
    karteSection.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    statusEl.textContent = `エラー: ${err.message}`;
  } finally {
    loadingEl.style.display = 'none';
    generateBtn.disabled = false;
    generateBtn.textContent = 'カルテを自動生成';
  }
});

// --- コピー ---
copyBtn.addEventListener('click', () => {
  const text = karteEl.textContent;
  try {
    navigator.clipboard.writeText(text).then(() => {
      showCopyMsg();
    }).catch(() => fallbackCopy(text));
  } catch {
    fallbackCopy(text);
  }
});

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showCopyMsg();
}

function showCopyMsg() {
  copyMsg.textContent = 'コピーしました！ スタプラに貼り付けてください';
  setTimeout(() => { copyMsg.textContent = ''; }, 3000);
}
