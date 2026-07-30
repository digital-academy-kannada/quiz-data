const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const https = require('https');
const express = require('express');

const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

GlobalFonts.registerFromPath(
  "./NotoSans-Regular.ttf",
  "Noto Sans"
);

let currentQuiz = null;
let stateUpdatedForQuiz = null;

const app = express();

app.use(express.json());

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function loadCurrentQuiz() {
  try {

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${STATE_FILE}`,
      {
        headers: {
          "User-Agent": "DAK-QuizAlpha"
        }
      }
    );

    const file = await res.json();

    const data = JSON.parse(
      Buffer.from(file.content, "base64").toString("utf8")
    );

    currentQuiz = Number(data.nextQuiz);

    console.log("Current Quiz:", currentQuiz);

  } catch (err) {
    console.log("State Load Error:", err.message);
  }
}
async function getStateFile() {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${STATE_FILE}`,
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  if (!res.ok) {
    throw new Error("Unable to read state.json");
  }

  return await res.json();
}

async function updateStateFile(nextQuiz) {
  const file = await getStateFile();

  const content = Buffer.from(
    JSON.stringify({ nextQuiz }, null, 2)
  ).toString("base64");

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${STATE_FILE}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Update next quiz to ${nextQuiz}`,
        content,
        sha: file.sha,
        branch: GITHUB_BRANCH
      })
    }
  );

  if (!res.ok) {
    throw new Error("Failed to update state.json");
  }

  console.log(`state.json updated -> ${nextQuiz}`);
}

// ================= YOUTUBE SEARCH =================
async function getYouTubeVideo(quizCode) {
  try {
    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(quizCode)}&channelId=${YOUTUBE_CHANNEL_ID}&key=${YOUTUBE_API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.items && data.items.length > 0) {
      return `https://youtu.be/${data.items[0].id.videoId}`;
    }

    return null;
  } catch (err) {
    console.log("YouTube Search Error:", err.message);
    return null;
  }
}
// ================= SEND YOUTUBE =================
async function sendYouTubeMessage(chatId, quizCode) {

  const video = await getYouTubeVideo(quizCode);

  if (video) {

    await bot.sendMessage(
      chatId,

`🎥 Quiz Explanation Video

📘 Quiz : ${quizCode}

▶️ ${video}

📚 Watch the complete explanation on YouTube.`
    );

  } else {

    await bot.sendMessage(
      chatId,

`🎥 Quiz Explanation Video

📘 Quiz : ${quizCode}

⚠️ Explanation video will be uploaded soon.`
    );

  }

}

// ================= BOT TOKEN =================
const bot = new TelegramBot('', {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

const OWNER_ID = 5865829688;

const GITHUB_TOKEN = "";
const GITHUB_OWNER = "digital-academy-kannada";
const GITHUB_REPO = "quiz-data";
const GITHUB_BRANCH = "main";
const STATE_FILE = "state.json";
loadCurrentQuiz();
// ================= SUBJECT FOLDERS =================
const SUBJECT_FOLDERS = [
  "GeneralKnowledge",
  "Science",
  "History",
  "Geography",
  "Polity",
  "CurrentAffairs",
  "ComputerScience",
  "EnglishGrammar",
  "EnvironmentalScience",
  "KannadaGrammar"
];
// ================= YOUTUBE =================
const YOUTUBE_API_KEY = "";
const YOUTUBE_CHANNEL_ID = "UCBvL7BoceC8BLqbzhnY0Imw";
const APPROVED_FILE = "approvedGroups.json";

let groupData = {};
let pendingApproval = {};
// ================= QUIZ TIMINGS =================
const QUIZ_TIMES = [
  { hour: 9, minute: 30 },
  { hour: 14, minute: 30 },
  { hour: 21, minute: 30 }
];

const ANNOUNCE_BEFORE = 5;
const YOUTUBE_BEFORE = 60;
let lastYouTube = "";

let lastAnnouncement = "";
let lastStart = "";
// ================= CRASH FIX =================
process.on("unhandledRejection", (err) => {
  console.log("Unhandled Rejection:", err.message);
});

process.on("uncaughtException", (err) => {
  console.log("Uncaught Exception:", err.message);
});

bot.on("polling_error", (err) => {
  console.log("Polling Error:", err.message);
});

// ================= APPROVAL =================
function loadApproved() {

  if (!fs.existsSync(APPROVED_FILE)) {
    return [];
  }

  return JSON.parse(
    fs.readFileSync(APPROVED_FILE)
  );
}

function saveApproved(data) {

  fs.writeFileSync(
    APPROVED_FILE,
    JSON.stringify(data, null, 2)
  );
}

// ================= QUIZ LIST =================
async function getQuizList() {

  try {

    const res = await fetch(
  "https://raw.githubusercontent.com/digital-academy-kannada/quiz-data/main/DAK-QuizAlphalist.json"
);

return await res.json();

  } catch (e) {

    console.log(
      "Quiz List Error:",
      e.message
    );

    return null;
  }
}

// ================= GET SUBJECTS =================
async function getSubjects() {
  console.log("getSubjects called");
return SUBJECT_FOLDERS;
}

// ================= GET QUIZZES BY SUBJECT =================
async function getQuizzesBySubject(subject) {

  try {

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${subject}`
    );

    if (!res.ok) return [];

    const files = await res.json();

    return files
      .filter(file =>
        file.name.endsWith(".json")
      )
      .map(file =>
        file.name.replace(".json", "")
      )
      .sort();

  } catch (err) {

    console.log("Subject Quiz Error:", err.message);

    return [];

  }
}

// ================= FIND QUIZ SUBJECT =================
async function findQuizSubject(quizCode) {

  // Check root folder first
  try {
    const rootUrl =
`https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${quizCode}.json`;

    const rootRes = await fetch(rootUrl, { method: "HEAD" });

    if (rootRes.ok) {
      return "ROOT";
    }
  } catch (e) {}

  // Check subject folders
  for (const subject of SUBJECT_FOLDERS) {

    try {

      const url =
`https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${subject}/${quizCode}.json`;

      const res = await fetch(url, { method: "HEAD" });

      if (res.ok) {
        return subject;
      }

    } catch (e) {}

  }

  return null;
}

function formatSubject(subject) {
  if (subject === "ROOT") return "General Knowledge";

  return subject
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}
// ================= CERTIFICATE ==============
async function generateCertificate(name, score, quizCode) {

  const fs = require('fs');
  const { createCanvas, loadImage } = require('@napi-rs/canvas');

  const template = await loadImage(
    "./certificate-template.png"
  );

  const canvas = createCanvas(
    template.width,
    template.height
  );

  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    template,
    0,
    0
  );

  ctx.textAlign = "center";

  // NAME
  let safeName = String(name || "").trim();

  if (!safeName) {
    safeName = "Winner";
  }

  ctx.fillStyle = "#081225";
  ctx.font = "bold 58px'Noto Sans'";

  ctx.fillText(
    safeName,
    canvas.width / 2,
    500
  );

  // QUIZ CODE
  ctx.fillStyle = "#d4a017";
  ctx.font = "bold 42px 'Noto Sans'";

  ctx.fillText(
    String(quizCode || ""),
    canvas.width / 2,
    620
  );

  // SCORE
  ctx.fillStyle = "#081225";
  ctx.font = "bold 18px 'Noto Sans'";

  ctx.fillText(
    Number(score).toFixed(2),
    500,
    718
  );

  // DATE
  const d = new Date();

  const date =
    `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

  ctx.fillText(
    date,
    820,
    718
  );

  // RANK
  ctx.fillText(
    "1st",
    1170,
    718
  );

  const output =
    `certificate-${Date.now()}.png`;

  fs.writeFileSync(
    output,
    canvas.toBuffer("image/png")
  );

  return output;
}
// ================= LEADERBOARD POSTER =================
async function generateLeaderboard(sorted, quizCode) {

  const template = await loadImage("./dakresult.png");

  const canvas = createCanvas(
    template.width,
    template.height
  );

  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    template,
    0,
    0
  );
// QUIZ CODE
ctx.textAlign = "center";
ctx.font = "bold 38px 'Noto Sans'";
ctx.fillStyle = "#ffffff";

ctx.fillText(
  quizCode,
  canvas.width / 2,
  415
);

// DATE
const d = new Date();

const date =
`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;

ctx.textAlign = "center";
ctx.fillStyle = "#ffffff";
ctx.font = "bold 28px 'Noto Sans'";

ctx.fillText(
    date,
    canvas.width / 2,
    1230
);

ctx.textAlign = "left";
ctx.font = "bold 30px 'Noto Sans'";
ctx.fillStyle = "#ffffff";

sorted.slice(0,10).forEach((u,i)=>{

    const rank = i + 1;
    const name = String(u.name || "").substring(0,25);
    const score = Number(u.score).toFixed(2);

    const y = 670 + (i * 50);

    // Rank
    ctx.textAlign = "center";
    ctx.font = "bold 34px 'Noto Sans'";
    ctx.fillStyle = "#FFD700";
    ctx.fillText(rank, 80, y);

    // Name
    ctx.textAlign = "left";
    ctx.font = "bold 30px 'Noto Sans'";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(name, 390, y);

    // Score
    ctx.textAlign = "center";
    ctx.fillText(score, 942, y);

});

const output = `leaderboard-${Date.now()}.png`;

fs.writeFileSync(
  output,
  canvas.toBuffer("image/png")
);

return output;
}

// ================= START =================
bot.onText(
/^(\/start(?:@[\w_]+)?|▶️ Start)$/,
  (msg) => {

  if (msg.chat.type !== "private") {
    return;
  }
  bot.sendMessage(
    msg.chat.id,

`👋 Welcome to DAK-QuizAlpha

Choose an option below:`,

{
  reply_markup: {
    inline_keyboard: [

      [
        {
          text: "📘 About QuizAlpha",
          url:
"https://digitalacademykannada.blogspot.com/2026/04/dak-quizalpha.html?m=1"
        }
      ],

      [
        {
          text:
"🚀 How to Start Quiz in Your Group",
          callback_data:
"startgroup"
        }
      ],
[
  {
    text: "📞 Contact Owner- group approval&other ",
    url: "https://t.me/Anjaneyaanwar"
  }
],

      [
        {
          text:
"📋 Quiz List",
          callback_data:
"quizlist"
        }
      ],

      [
        {
          text:
"🔥 Join Digital Academy Kannada",
          url:
"https://t.me/digital_academy_kannada"
        }
      ]

    ]
  }
});

});

// ================= CALLBACK =================
bot.on(
  'callback_query',
  async (q) => {

  let data = q.data;

// // ===== QUIZ LIST =====
if (data === "quizlist") {

    const subjects = await getSubjects();

    const buttons = subjects.map(subject => [
        {
            text: `📚 ${subject}`,
            callback_data: `subject_${subject}`
        }
    ]);

   return bot.sendMessage(
    q.message.chat.id,
    `📚 Select Subject\n\n`,
    {
        reply_markup: {
            inline_keyboard: buttons
        }
    }
);

}

// ===== SUBJECT SELECT =====
if (data.startsWith("subject_")) {

    const subject = data.replace("subject_", "");

    const quizzes = await getQuizzesBySubject(subject);

    if (quizzes.length === 0) {
        return bot.sendMessage(
            q.message.chat.id,
            `❌ No quizzes found in ${subject}`
        );
    }

    const buttons = quizzes.map(code => [
        {
            text: code,
            callback_data: `quiz_${code}`
        }
    ]);

    return bot.sendMessage(
        q.message.chat.id,
        `📚 ${subject}\n\nSelect Quiz`,
        {
            reply_markup: {
                inline_keyboard: buttons
            }
        }
    );
}

  // ===== QUIZ SELECT =====
  if (data.startsWith("quiz_")) {

    let code =
      data.split("_")[1];

    return bot.sendMessage(

      q.message.chat.id,

`⚠️ Start the quiz in your group 😊

1. Add the bot to your group
2. Make the bot admin
3. Then type & send in group:

/quiz ${code}`

    );

  }

  // ===== START GROUP =====
  if (data === "startgroup") {

    return bot.sendMessage(

      q.message.chat.id,

`🚀 How to Start Quiz in Your Group

1. Add bot to group
2. Make it admin
3. Select quiz
4. Type & send in group:

/quiz DAK-QuizAlpha100,101,..`

    );

  }

  // ===== APPROVE =====
  if (
    data.startsWith("approve_") &&
    q.from.id === OWNER_ID
  ) {

    let gid =
      Number(
        data.split("_")[1]
      );

    let approved =
      loadApproved();

    if (!approved.includes(gid)) {

      approved.push(gid);

      saveApproved(approved);

    }

    delete pendingApproval[gid];

    bot.sendMessage(
      gid,
      "✅ Group Approved!"
    );

  }

  // ===== REJECT =====
  if (
    data.startsWith("reject_") &&
    q.from.id === OWNER_ID
  ) {

    let gid =
      Number(
        data.split("_")[1]
      );

    delete pendingApproval[gid];

    bot.sendMessage(
      gid,
      "❌ Group not approved"
    );

  }

  // ===== JOIN =====
  if (data.startsWith("join_")) {

    let chatId =
      Number(
        data.split("_")[1]
      );

    let g =
      groupData[chatId];

    if (!g) return;

    if (g.running) {

      return bot.answerCallbackQuery(
        q.id,
{
  text:
"Quiz already started 🚀"
});

    }

    let id = q.from.id;

    if (g.participants[id]) {

      return bot.answerCallbackQuery(
        q.id,
{
  text:
"Already joined 😎"
});

    }

    g.participants[id] = true;
    g.names[id] =
      q.from.first_name;

    g.scores[id] = 0;

    g.stats[id] = {

      right: 0,
      wrong: 0,
      attempted: 0

    };

    g.startTime[id] =
      Date.now();

    bot.answerCallbackQuery(
      q.id,
{
  text: "Joined ✅"
});

    let count =
      Object.keys(
        g.participants
      ).length;

    try {

      await bot.editMessageText(

`🔥 First Time in Telegram History!

🏆 DAK – QuizAlpha

📉 Negative Based Quiz

📊 Total Questions: ${g.quiz.length}

📚 Subject: ${formatSubject(g.subject)}

👥 Joined: ${count}

👇 Click below to join`,

{
  chat_id: chatId,
  message_id:
    g.joinMsgId,

  reply_markup: {
    inline_keyboard: [[

      {
        text:
"🔥 Join Quiz",

        callback_data:
`join_${chatId}`
      }

    ]]
  }
});

    } catch (e) {}

    if (
  count >= 2 &&
  !g.running &&
  !g.autoMode
) {

  startQuiz(chatId);

}

  }

});

// ================= QUIZ COMMAND =================
bot.onText(
/\/quiz(?:@[\w_]+)? (.+)/,

async (msg, match) => {

  let chatId =
    msg.chat.id;

  if (
    msg.chat.type === "private"
  ) {

    return bot.sendMessage(
      chatId,
      "⚠️ Use in group only"
    );

  }

  let approved =
    loadApproved();

  if (
    !approved.includes(chatId)
  ) {

    if (!pendingApproval[chatId]) {

      pendingApproval[chatId] = true;

      bot.sendMessage(

        OWNER_ID,

`📩 New Group Request

Group: ${msg.chat.title}
ID: ${chatId}`,

{
  reply_markup: {
    inline_keyboard: [[

      {
        text: "✅ Approve",
        callback_data:
`approve_${chatId}`
      },

      {
        text: "❌ Reject",
        callback_data:
`reject_${chatId}`
      }

    ]]
  }
});

    }

    return bot.sendMessage(
      chatId,
      "❌ Group Not Approved"
    );

  }

  if (!groupData[chatId]) {
    groupData[chatId] = {};
  }

  let g =
    groupData[chatId];

  if (g.running) {

    return bot.sendMessage(
      chatId,
      "⚠️ Quiz already running!"
    );

  }

  g.quizCode =
    match[1].trim();

  g.quiz = [];
  g.i = 0;

  g.scores = {};
  g.names = {};

  g.participants = {};

  g.running = false;

  g.stats = {};
  g.startTime = {};

  g.userAnswers = {};
  g.pollChatMap = {};
  g.autoMode = false;

  g.retryTimer = null;
  g.retryCount = 0;

  clearTimeout(g.timer);

  try {

    const subject = await findQuizSubject(g.quizCode);

if (!subject) {

  return bot.sendMessage(
    chatId,
    "❌ Quiz not found"
  );

}

g.subject = subject;

const quizUrl =
  subject === "ROOT"
    ? `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${g.quizCode}.json`
    : `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${subject}/${g.quizCode}.json`;

let res = await fetch(quizUrl);

    g.quiz =
      await res.json();

    if (
      !Array.isArray(g.quiz) ||
      g.quiz.length === 0
    ) {

      return bot.sendMessage(
        chatId,
        "❌ No questions found"
      );

    }

    let msgSent =
      await bot.sendMessage(

chatId,

`🔥 First Time in Telegram History!

🏆 DAK – QuizAlpha

📉 Negative Based Quiz

📊 Total Questions: ${g.quiz.length}

📚 Subject: ${formatSubject(g.subject)}

👥 Joined: 0

👇 Click below to join`,

{
  reply_markup: {
    inline_keyboard: [[

      {
        text:
"🔥 Join Quiz",

        callback_data:
`join_${chatId}`
      }

    ]]
  }
});

    g.joinMsgId =
      msgSent.message_id;
const webLink =
`https://digitalacademykannada.blogspot.com/p/dakalpha.html?quiz=${g.quizCode}`;

await bot.sendMessage(
chatId,

`Take the Quiz on Web🌐 

${webLink}

• Save Time & Load Faster! 
• Check Your Rank and Score in the  Group!

Quiz Code: ${g.quizCode}`
);

  } catch (e) {

    console.log(
      "Quiz Load Error:",
      e.message
    );

    bot.sendMessage(
      chatId,
      "❌ Quiz not found"
    );

  }

});

// ================= STOP =================
bot.onText(
/\/stop(?:@[\w_]+)?/,

(msg) => {

  let chatId =
    msg.chat.id;

  let g =
    groupData[chatId];

  if (
    !g ||
    !g.running
  ) {

    return bot.sendMessage(
      chatId,
      "⚠️ No active quiz"
    );

  }

  g.running = false;

  clearTimeout(g.timer);

  result(chatId);

});
   async function autoLoadQuiz(chatId) {

  let quizCode = `DAK-QuizAlpha${currentQuiz}`;

  if (!groupData[chatId]) {
    groupData[chatId] = {};
  }

  let g = groupData[chatId];

  g.quizCode = quizCode;
  g.quiz = [];
  g.i = 0;

  g.scores = {};
  g.names = {};
  g.participants = {};
  g.running = false;
  g.stats = {};
  g.startTime = {};
  g.userAnswers = {};
  g.pollChatMap = {};
  g.autoMode = true;

  try {

    const subject = await findQuizSubject(quizCode);

if (!subject) {
  console.log(`Quiz not found: ${quizCode}`);
  return;
}

g.subject = subject;

const quizUrl =
  subject === "ROOT"
    ? `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${quizCode}.json`
    : `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${subject}/${quizCode}.json`;

const res = await fetch(quizUrl);

    g.quiz = await res.json();
    console.log("Loaded:", quizCode, "Questions:", g.quiz.length);

    if (!Array.isArray(g.quiz) || g.quiz.length === 0) {
      console.log("Quiz not found");
      return;
    }

    console.log(`${quizCode} Loaded Successfully`);
await bot.sendMessage(
  chatId,
`🔥 GET READY!

🏆 DAK QuizAlpha

📘 Quiz Code : ${quizCode}

⏳ Preparing to Begin the Quiz...

📚 Subject : ${formatSubject(groupData[chatId].subject)}

📊 Total Questions : ${g.quiz.length}
📉 Negative Marking : -0.25
⏱ Time Per Question : 30 Seconds

🏆 Live Leaderboard
🏅 Winner Certificate
🥇 Top 10 Poster

🔥 Be Ready for the Challenge!`
);

  } catch (err) {

    console.log("Auto Load Error:", err.message);

  }

}

// ================= START QUIZ =================
function startQuiz(chatId) {
console.log(">>> startQuiz() called");
console.log("Chat ID:", chatId);

  let g =
    groupData[chatId];
if (g.running) {
    return;
}

  g.running = true;

  bot.sendMessage(
    chatId,
    "⏳ Starting Quiz..."
  );

  setTimeout(() => {

    sendQ(chatId);

  }, 1000);

}

// ================= SEND QUESTION =================
async function sendQ(chatId) {

  let g =
    groupData[chatId];

  if (!g || !g.running) {
    return;
  }

  try {

    if (g.i >= g.quiz.length) {

      g.running = false;

      return result(chatId);

    }

    let raw =
      g.quiz[g.i];

    let q =
      raw.q ||
      raw.question;

    let options =
      raw.o ||
      raw.options;

    let answer =

      raw.correct_option_id ??

      raw.a ??

      raw.answer;

    // ===== LONG QUESTION FIX =====
    if (
      q &&
      q.length > 280
    ) {

      q =
        q.slice(0, 277) + "...";

    }

    // ===== LONG OPTION FIX =====
    options =
      options.map(o =>

      o.length > 90

      ? o.slice(0, 87) + "..."

      : o

    );

    // ===== BAD QUESTION SKIP =====
    if (
      !q ||
      !options ||
      answer === undefined
    ) {

      console.log(
        `Skipping bad question ${g.i + 1}`
      );

      g.i++;

      return sendQ(chatId);

    }

    let sent =
      await bot.sendPoll(

      chatId,

`${g.i + 1}/${g.quiz.length}. ${q}`,

      options,

{
  type: "quiz",

  correct_option_id:
    Number(answer),
explanation: raw.e || "",

  is_anonymous: false,

  open_period: 30
});

    // ===== 1 SEC BUFFER =====
    await new Promise(r =>
      setTimeout(r, 1000)
    );

    let pollId =
      sent.poll.id;
// Store explanation for this poll


    // ===== RESET RETRY =====
    g.retryCount = 0;

    clearTimeout(
      g.retryTimer
    );

    g.userAnswers[pollId] = {};

    g.pollChatMap[pollId] =
      chatId;

    g.correct =
      Number(answer);
// Store current poll ID
g.currentPollId = pollId;

    // ===== SCORE PROCESS =====
    setTimeout(() => {

      let answers =
        g.userAnswers[pollId] || {};

      for (let u in answers) {

        if (!g.stats[u]) {

          g.stats[u] = {

            right: 0,
            wrong: 0,
            attempted: 0

          };

        }

        if (
          g.scores[u] === undefined
        ) {

          g.scores[u] = 0;

        }

        let a =
          answers[u];

        g.stats[u].attempted++;

        if (a === g.correct) {

          g.scores[u] += 1;

          g.stats[u].right++;

        } else {

          g.scores[u] -= 0.25;

          g.stats[u].wrong++;

        }

      }

      delete g.userAnswers[pollId];

      delete g.pollChatMap[pollId];

    }, 31000);

    // ===== NEXT QUESTION =====
    g.timer = setTimeout(
      async () => {

      try {

        if (
          (g.i + 1) % 5 === 0
        ) {

          showLeaderboard(chatId);

        }

        g.i++;

        await sendQ(chatId);

      } catch (e) {

        console.log(
          "Next Question Error:",
          e.message
        );

        clearTimeout(
          g.retryTimer
        );

        g.retryTimer =
          setTimeout(() => {

          sendQ(chatId);

        }, 5000);

      }

    }, 31000);

  } catch (e) {

    console.log(
      "sendQ Error:",
      e.message
    );

    let g =
      groupData[chatId];

    if (!g) return;

    if (!g.retryCount) {
      g.retryCount = 0;
    }

    g.retryCount++;

    console.log(
`Retry Attempt: ${g.retryCount}`
    );

    // ===== RETRY SAME QUESTION =====
    if (g.retryCount <= 5) {

      clearTimeout(
        g.retryTimer
      );

      g.retryTimer =
        setTimeout(() => {

        sendQ(chatId);

      }, 5000);

      return;

    }

    // ===== SKIP BROKEN QUESTION =====
    console.log(
      "Skipping broken question..."
    );

    g.retryCount = 0;

    g.i++;

    clearTimeout(
      g.retryTimer
    );

    g.retryTimer =
      setTimeout(() => {

      sendQ(chatId);

    }, 1000);

    return;

  }

}

// ================= POLL ANSWERS =================
bot.on(
  'poll_answer',
  (msg) => {

  let p =
    msg.poll_id;

  let u =
    msg.user.id;

  let a =
    msg.option_ids[0];

  for (let chatId in groupData) {

    let g =
      groupData[chatId];

    if (g.pollChatMap[p]) {

      if (!g.userAnswers[p]) {

        g.userAnswers[p] = {};

      }

      g.userAnswers[p][u] = a;

      g.names[u] =
        msg.user.first_name;

      break;

    }

  }

});

// ================= LEADERBOARD =================
function showLeaderboard(chatId) {

  let g =
    groupData[chatId];

  let sorted =
    Object.entries(g.scores)

    .sort((a, b) =>
      b[1] - a[1]
    );

  let funLines = [

"🔥 Competition getting intense...",

"👀 Leaderboard changing fast...",

"⚡ One answer can change everything...",

"🏆 Top ranks are fighting hard...",

"😎 Silent players climbing leaderboard..."

  ];

  let randomLine =

    funLines[
      Math.floor(
        Math.random() *
        funLines.length
      )
    ];

  let text =
`🏆 TOP 5 PLAYERS 🏆

📊 LIVE LEADERBOARD

🥇🥈🥉 Rankings Updated

`;

  sorted
    .slice(0, 5)

    .forEach((u, i) => {

    let medal = "";

    if (i === 0) {
      medal = "🥇";
    }

    else if (i === 1) {
      medal = "🥈";
    }

    else if (i === 2) {
      medal = "🥉";
    }

    text +=

`${medal} ${i + 1}. ${g.names[u[0]]} — ${u[1].toFixed(2)} score\n`;

  });

  text +=
`\n📉 Negative marking active (-0.25)\n`;

  text +=
`\n${randomLine}`;

  bot.sendMessage(
    chatId,
    text
  );

}
// ================= RESULT =================
function result(chatId) {

  console.log("========== RESULT CALLED ==========");
  console.log("Chat ID:", chatId);

  let g =
    groupData[chatId];

  console.log("Quiz:", g?.quizCode);

  if (!g) return;

  let sorted =
    Object.entries(g.scores)

    .sort((a, b) =>
      b[1] - a[1]
    );

  let text =
`🏁 Quiz ${g.quizCode} Finished!\n\n`;

  if (sorted.length === 0) {

    text +=
      `😅 No participants found`;

    return bot.sendMessage(
      chatId,
      text
    );

  }

  text +=
`📉 Negative marking applied (-0.25)\n\n`;

  text +=
`🏆 Final Leaderboard\n\n`;

  sorted.forEach((u, i) => {

    let userId = u[0];

    let stats =
      g.stats[userId] || {

      right: 0,
      wrong: 0,
      attempted: 0

    };

    let medal = "";

    if (i === 0) {
      medal = "🥇";
    }

    else if (i === 1) {
      medal = "🥈";
    }

    else if (i === 2) {
      medal = "🥉";
    }

    text +=
`${medal} ${i + 1}. ${g.names[userId]}\n`;

    text +=
`Score: ${u[1].toFixed(2)} | Right: ${stats.right} | Wrong: ${stats.wrong} | Attempted: ${stats.attempted}\n\n`;

  });

  let winnerName =
    g.names[sorted[0][0]];

  let winnerScore =
    sorted[0][1];

  text +=
`🎉 Congratulations ${winnerName} for securing 1st place 🏆`;

  // ===== RESULT MESSAGE =====
  bot.sendMessage(
    chatId,
    text,
{
  reply_markup: {
    inline_keyboard: [[

      {
        text:
`🚀 Start ${g.quizCode}`,

        switch_inline_query_chosen_chat: {

query:
`⚠️ First Add Bot To Group
⚠️ Give Bot Admin Permission

Then Start Quiz Using:

/quiz ${g.quizCode}`,

allow_group_chats: true,

allow_user_chats: false,

allow_channel_chats: false,

allow_bot_chats: false

        }
      }

    ]]
  }
});

const leaderboardData = sorted.map(([userId, score]) => ({
  name: g.names[userId],
  score
}));

generateLeaderboard(
  leaderboardData,
  g.quizCode
).then(async (leaderboardPath) => {

  await bot.sendPhoto(
    chatId,
    fs.createReadStream(leaderboardPath),
    {
      caption:
`👑 Congratulations to the TOP 10!

🏆 Champions

📘 Quiz: ${g.quizCode}` 
    }
  );

  fs.unlinkSync(leaderboardPath);

}).catch(err => {
  console.log("Leaderboard Error:", err.message);
});
  // ===== CERTIFICATE =====
  generateCertificate(

    winnerName,
    winnerScore,
    g.quizCode

  ).then(async (path) => {

    await bot.sendPhoto(
chatId,
fs.createReadStream(path),
{
  caption:
`🏆 Congratulations ${winnerName}!

🥇 Rank : 1st Place
📘 Quiz : ${g.quizCode}

🔥 DAK QuizAlpha`
});

    // ===== DELETE FILE =====
    fs.unlinkSync(path);

  }).catch(err => {

    console.log(
      "Certificate Error:",
      err.message
    );

  });
// ===== YOUTUBE EXPLANATION =====
sendYouTubeMessage(chatId, g.quizCode).catch(err => {
  console.log("YouTube Message Error:", err.message);
});
// ===== AUTO QUIZ INCREMENT =====
if (g.autoMode) {

    if (stateUpdatedForQuiz !== g.quizCode) {

        stateUpdatedForQuiz = g.quizCode;

        currentQuiz++;

        updateStateFile(currentQuiz)
            .then(() => {
                console.log(`Next Quiz -> DAK-QuizAlpha${currentQuiz}`);
            })
            .catch(err => {
                console.log("State Update Error:", err.message);
            });

    } else {

        console.log(`Already updated for ${g.quizCode}`);

    }

}
}
// ================= AUTO SCHEDULER =================

setInterval(async () => {

  const now = new Date();

  const hour = now.getHours();
  const minute = now.getMinutes();
  const nowMinutes = hour * 60 + minute;

console.log(`Time: ${hour}:${minute}`);
// console.clear();

console.log("====================================");
console.log("      DAK-QuizAlpha Scheduler");
console.log("====================================");
console.log(`Current Time : ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`);
console.log("");

console.log("Next Quiz");
console.log(`DAK-QuizAlpha${currentQuiz}`);

console.log("====================================");

  const today = now.toDateString();

  if (global.lastReset !== today) {

    global.lastReset = today;

    lastAnnouncement = "";
    lastStart = "";

}
// ===== 1 HOUR YOUTUBE MESSAGE =====
for (const quiz of QUIZ_TIMES) {

    const currentKey = `${quiz.hour}:${quiz.minute}`;

    const youtubeMinutes =
        (quiz.hour * 60 + quiz.minute) - YOUTUBE_BEFORE;

    if (
        nowMinutes === youtubeMinutes &&
        lastYouTube !== currentKey
    ) {

        lastYouTube = currentKey;

        const approved = loadApproved();

        for (const chatId of approved) {

            let quizNumber = currentQuiz;

const quizCode = `DAK-QuizAlpha${quizNumber}`;

await sendYouTubeMessage(chatId, quizCode);

        }

    }

}

// ===== Announcement =====
for (const quiz of QUIZ_TIMES) {

    console.log(`Checking: ${quiz.hour}:${quiz.minute}`);

   
    const currentKey = `${quiz.hour}:${quiz.minute}`;

  
const announceMinutes = (quiz.hour * 60 + quiz.minute) - ANNOUNCE_BEFORE;



       if (
    nowMinutes === announceMinutes &&
    lastAnnouncement !== currentKey
) {

lastAnnouncement = currentKey;

        console.log(`📢 Announcement: ${currentKey}`);

        const approved = loadApproved();

        for (const chatId of approved) {

            if (!groupData[chatId]) {
                groupData[chatId] = {};
            }

            const g = groupData[chatId];

let quizNumber = currentQuiz;

const quizCode = `DAK-QuizAlpha${quizNumber}`;

            try {
const subject = await findQuizSubject(quizCode);

if (!subject) {
    console.log(`Quiz not found: ${quizCode}`);
    continue;
}

g.subject = subject;

                const quizUrl =
subject === "ROOT"
  ? `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${quizCode}.json`
  : `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${subject}/${quizCode}.json`;

const res = await fetch(quizUrl);

                g.quiz = await res.json();

                await bot.sendMessage(
                    chatId,

`🚨 GET READY!

🏆 DAK QuizAlpha

📚 Subject : ${formatSubject(subject)}

📘 Quiz Code : ${quizCode}

📚 Subject : ${formatSubject(g.subject)}

⏰ Start Time : ${String(quiz.hour).padStart(2,"0")}:${String(quiz.minute).padStart(2,"0")}

⌛ Remaining Time : ${ANNOUNCE_BEFORE} Minute(s)

📊 Total Questions : ${g.quiz.length}
📉 Negative Marking : -0.25
⏱ Time Per Question : 30 Seconds

🏆 Live Leaderboard
🥇 Winner Certificate
🎖 Top 10 Result Poster

🔥 Best of Luck!`
                );

            } catch (err) {

                console.log("Announcement Error:", err.message);

            }

        }

    }

}
  // ===== Auto Start =====
for (const quiz of QUIZ_TIMES) {

    const currentKey = `${quiz.hour}:${quiz.minute}`;

   const startMinutes = quiz.hour * 60 + quiz.minute;

if (
    hour === quiz.hour &&
    minute === quiz.minute &&
    lastStart !== currentKey
) {
lastStart = currentKey;

        console.log(`🚀 Starting Quiz: ${currentKey}`);

        const approved = loadApproved();

        for (const chatId of approved) {

            let quizNumber = currentQuiz;

await autoLoadQuiz(chatId);
console.log("After autoLoadQuiz");
if (
    !groupData[chatId].quiz ||
    groupData[chatId].quiz.length === 0
) {
    console.log(`Skipped ${chatId} - Quiz not loaded`);
    continue;
}

            const webLink =
`https://digitalacademykannada.blogspot.com/p/dakalpha.html?quiz=DAK-QuizAlpha${currentQuiz}`;

            await bot.sendMessage(
                chatId,

`🚀 QUIZ STARTED!

🏆 DAK QuizAlpha

📚 Subject : ${formatSubject(groupData[chatId].subject)}

📘 Quiz Code : DAK-QuizAlpha${currentQuiz}

🌐 Play on Web

${webLink}

⚡ Saves Time
🚀 Loads Faster
📊 Live Rank & Score
📱 Smooth Mobile Experience

📊 Total Questions : ${groupData[chatId].quiz.length}

📚 Subject : ${formatSubject(groupData[chatId].subject)}

📉 Negative Marking : -0.25

⏱ Time Per Question : 30 Seconds

🏆 Live Leaderboard
🥇 Winner Certificate
🎖 Top 10 Result Poster

💡 Play on the website for a faster experience and live ranking!

⏳ Polls will start in a few seconds...

🔥 Best of Luck!`
            );

            setTimeout(() => {
                startQuiz(chatId);
            }, 3000);

        }

    }

}

}, 1000);
