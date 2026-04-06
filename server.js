const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
app.use(express.static('public'));
app.use(express.json({ limit: '1mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/api/generate-karte', async (req, res) => {
  const { transcript, studentName, tutorName } = req.body;

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: '書き起こしテキストが空です' });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: `あなたは大学受験塾のチューターアシスタントです。
面談の音声書き起こしテキストから、以下のカルテフォーマットに該当する情報を抽出して記入してください。

【ルール】
- 会話に出てきた内容だけを記入すること。推測で埋めない。
- 話題に上がらなかった項目は「（未確認）」と記入。
- 選択肢は番号と名称の両方を書く（例：①内発（志望校・夢／科目好き））
- 理由は簡潔に1〜2文で。
- 30分の面談で全項目が埋まることは稀。埋められる部分だけ正確に。

【フォーマット】
🔴【相性分析】

・【志望度・動機】：
・【現状偏差値】：

❶ モチベーション源（最大2つ選択）：
①内発（志望校・夢／科目好き） ②外発（親・環境） ③競争/承認（勝ちたい・褒められたい） ④危機感（成績・模試の焦り） ⑤不明
→理由：

❷ 行動特性（最大2つ選択）：
①安定実行（コツコツ） ②波あり（ムラあり） ③開始遅延（先延ばし） ④指示依存（受け身） ⑤計画崩壊（実行弱い） ⑥精度課題（ミス多い／丁寧すぎ）
→理由：

❸ メンタル傾向（最大2つ選択）：
①安定 ②不安型（自信なし・結果に敏感） ③防御型（指摘に弱い・言い訳） ④依存型（他人頼り） ⑤競争型（負けず嫌い） ⑥楽観型（危機感薄い）
→理由：

❹ 学習課題：

❺ 主観的相性判断：
[tu名:相性判定(◯・△)＋理由]

❻ 引き継ぎメモ（出した課題・何番を更新した等）：`,
      messages: [{
        role: 'user',
        content: `以下は生徒「${studentName || '（名前なし）'}」との面談の書き起こしです。チューター名は「${tutorName || '（名前なし）'}」です。
このテキストからカルテを作成してください。

---
${transcript}
---`
      }],
    });

    res.json({ karte: response.content[0].text });
  } catch (err) {
    console.error('Claude API Error:', err.message);
    res.status(500).json({ error: 'カルテ生成に失敗しました: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`カルテアプリ起動: http://localhost:${PORT}`);
});
