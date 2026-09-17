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
const YOUTUBE_CHANNEL_ID = "";
const APPROVED_FILE = "approvedGroups.json";

let groupData = {};
let pendingApproval = {};

// ================= QUIZ TIMINGS =================

const QUIZ_TIMES = [
  { hour: 21, minute: 30 },
  { hour: 8 , minute: 30 },
];

const ANNOUNCE_BEFORE = 30;
const YOUTUBE_BEFORE = 60;

let lastYouTube = "";
let lastAnnouncement = "";
let lastStart = "";
let announcementPolls = {};
let announcementPollSending = {};
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

    console.log(
      "Subject Quiz Error:",
      err.message
    );

    return [];

  }
}

// ================= FIND QUIZ SUBJECT =================

async function findQuizSubject(quizCode) {

  try {

    const rootUrl =
      `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${quizCode}.json`;

    const rootRes =
      await fetch(
        rootUrl,
        {
          method: "HEAD"
        }
      );

    if (rootRes.ok) {
      return "ROOT";
    }

  } catch (e) {}

  for (
    const subject
    of SUBJECT_FOLDERS
  ) {

    try {

      const url =
        `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${subject}/${quizCode}.json`;

      const res =
        await fetch(
          url,
          {
            method: "HEAD"
          }
        );

      if (res.ok) {
        return subject;
      }

    } catch (e) {}

  }

  return null;
}

function formatSubject(subject) {

  if (subject === "ROOT") {
    return "General Knowledge";
  }

  return subject
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

// ================= CERTIFICATE =================

async function generateCertificate(
  name,
  score,
  quizCode
) {

  const fs = require('fs');
  const {
    createCanvas,
    loadImage
  } = require('@napi-rs/canvas');

  const template =
    await loadImage(
      "./certificate-template.png"
    );

  const canvas =
    createCanvas(
      template.width,
      template.height
    );

  const ctx =
    canvas.getContext('2d');

  ctx.drawImage(
    template,
    0,
    0
  );

  ctx.textAlign =
    "center";

  let safeName =
    String(
      name || ""
    ).trim();

  if (!safeName) {
    safeName =
      "Winner";
  }

  ctx.fillStyle =
    "#081225";

  ctx.font =
    "bold 58px'Noto Sans'";

  ctx.fillText(
    safeName,
    canvas.width / 2,
    500
  );

  ctx.fillStyle =
    "#d4a017";

  ctx.font =
    "bold 42px 'Noto Sans'";

  ctx.fillText(
    String(
      quizCode || ""
    ),
    canvas.width / 2,
    620
  );

  ctx.fillStyle =
    "#081225";

  ctx.font =
    "bold 18px 'Noto Sans'";

  ctx.fillText(
    Number(score).toFixed(2),
    500,
    718
  );

  const d =
    new Date();

  const date =
    `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

  ctx.fillText(
    date,
    820,
    718
  );

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

async function generateLeaderboard(
  sorted,
  quizCode
) {

  const template =
    await loadImage(
      "./dakresult.png"
    );

  const canvas =
    createCanvas(
      template.width,
      template.height
    );

  const ctx =
    canvas.getContext("2d");

  ctx.drawImage(
    template,
    0,
    0
  );

  ctx.textAlign =
    "center";

  ctx.font =
    "bold 38px 'Noto Sans'";

  ctx.fillStyle =
    "#ffffff";

  ctx.fillText(
    quizCode,
    canvas.width / 2,
    415
  );

  const d =
    new Date();

  const date =
    `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;

  ctx.textAlign =
    "center";

  ctx.fillStyle =
    "#ffffff";

  ctx.font =
    "bold 28px 'Noto Sans'";

  ctx.fillText(
    date,
    canvas.width / 2,
    1230
  );

  ctx.textAlign =
    "left";

  ctx.font =
    "bold 30px 'Noto Sans'";

  ctx.fillStyle =
    "#ffffff";

  sorted
    .slice(0,10)
    .forEach(
      (u,i) => {

        const rank =
          i + 1;

        const name =
          String(
            u.name || ""
          ).substring(
            0,
            25
          );

        const score =
          Number(
            u.score
          ).toFixed(2);

        const y =
          670 +
          (i * 50);

        ctx.textAlign =
          "center";

        ctx.font =
          "bold 34px 'Noto Sans'";

        ctx.fillStyle =
          "#FFD700";

        ctx.fillText(
          rank,
          80,
          y
        );

        ctx.textAlign =
          "left";

        ctx.font =
          "bold 30px 'Noto Sans'";

        ctx.fillStyle =
          "#ffffff";

        ctx.fillText(
          name,
          390,
          y
        );

        ctx.textAlign =
          "center";

        ctx.fillText(
          score,
          942,
          y
        );

      }
    );

  const output =
    `leaderboard-${Date.now()}.png`;

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

    if (
      msg.chat.type !== "private"
    ) {

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
                text:
                  "📘 About QuizAlpha",

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
                text:
                  "📞 Contact Owner- group approval&other ",

                url:
                  "https://t.me/Anjaneyaanwar"
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
      }
    );

  }
);

// ================= CALLBACK =================

bot.on(
  'callback_query',
  async (q) => {

    let data =
      q.data;

    // ===== QUIZ LIST =====

    if (
      data === "quizlist"
    ) {

      const subjects =
        await getSubjects();

      const buttons =
        subjects.map(
          subject => [
            {
              text:
                `📚 ${subject}`,

              callback_data:
                `subject_${subject}`
            }
          ]
        );

      return bot.sendMessage(
        q.message.chat.id,
        `📚 Select Subject\n\n`,
        {
          reply_markup: {
            inline_keyboard:
              buttons
          }
        }
      );

    }

    // ===== SUBJECT SELECT =====

    if (
      data.startsWith(
        "subject_"
      )
    ) {

      const subject =
        data.replace(
          "subject_",
          ""
        );

      const quizzes =
        await getQuizzesBySubject(
          subject
        );

      if (
        quizzes.length === 0
      ) {

        return bot.sendMessage(
          q.message.chat.id,
          `❌ No quizzes found in ${subject}`
        );

      }

      const buttons =
        quizzes.map(
          code => [
            {
              text:
                code,

              callback_data:
                `quiz_${code}`
            }
          ]
        );

      return bot.sendMessage(
        q.message.chat.id,

`📚 ${subject}

Select Quiz`,

        {
          reply_markup: {
            inline_keyboard:
              buttons
          }
        }
      );

    }

    // ===== QUIZ SELECT =====

    if (
      data.startsWith(
        "quiz_"
      )
    ) {

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

    if (
      data === "startgroup"
    ) {

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
      data.startsWith(
        "approve_"
      ) &&
      q.from.id === OWNER_ID
    ) {

      let gid =
        Number(
          data.split("_")[1]
        );

      let approved =
        loadApproved();

      if (
        !approved.includes(
          gid
        )
      ) {

        approved.push(
          gid
        );

        saveApproved(
          approved
        );

      }

      delete pendingApproval[
        gid
      ];

      bot.sendMessage(
        gid,
        "✅ Group Approved!"
      );

    }

    // ===== REJECT =====

    if (
      data.startsWith(
        "reject_"
      ) &&
      q.from.id === OWNER_ID
    ) {

      let gid =
        Number(
          data.split("_")[1]
        );

      delete pendingApproval[
        gid
      ];

      bot.sendMessage(
        gid,
        "❌ Group not approved"
      );

    }

    // ===== JOIN =====

    if (
      data.startsWith(
        "join_"
      )
    ) {

      let chatId =
        Number(
          data.split("_")[1]
        );

      let g =
        groupData[chatId];

      if (!g)
        return;

      if (
        g.running
      ) {

        return bot.answerCallbackQuery(
          q.id,
          {
            text:
              "Quiz already started 🚀"
          }
        );

      }

      let id =
        q.from.id;

      if (
        g.participants[id]
      ) {

        return bot.answerCallbackQuery(
          q.id,
          {
            text:
              "Already joined 😎"
          }
        );

      }

      g.participants[id] =
        true;

      g.names[id] =
        q.from.first_name;

      g.scores[id] =
        0;

      g.stats[id] = {

        right:
          0,

        wrong:
          0,

        attempted:
          0

      };

      g.startTime[id] =
        Date.now();

      bot.answerCallbackQuery(
        q.id,
        {
          text:
            "Joined ✅"
        }
      );

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
            chat_id:
              chatId,

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
          }
        );

      } catch (e) {}

      if (
        count >= 2 &&
        !g.running &&
        !g.autoMode
      ) {

        startQuiz(
          chatId
        );

      }

    }

  }
);

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
      !approved.includes(
        chatId
      )
    ) {

      if (
        !pendingApproval[chatId]
      ) {

        pendingApproval[chatId] =
          true;

        bot.sendMessage(

          OWNER_ID,

`📩 New Group Request

Group: ${msg.chat.title}
ID: ${chatId}`,

          {
            reply_markup: {
              inline_keyboard: [[

                {
                  text:
                    "✅ Approve",

                  callback_data:
                    `approve_${chatId}`
                },

                {
                  text:
                    "❌ Reject",

                  callback_data:
                    `reject_${chatId}`
                }

              ]]
            }
          }
        );

      }

      return bot.sendMessage(
        chatId,
        "❌ Group Not Approved"
      );

    }

    if (
      !groupData[chatId]
    ) {

      groupData[chatId] =
        {};

    }

    let g =
      groupData[chatId];

    if (
      g.running
    ) {

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

    g.running =
      false;

    g.stats = {};
    g.startTime = {};

    g.userAnswers = {};
    g.pollChatMap = {};
    g.autoMode = false;

    g.retryTimer = null;
    g.retryCount = 0;

    clearTimeout(
      g.timer
    );

    try {

      const subject =
        await findQuizSubject(
          g.quizCode
        );

      if (
        !subject
      ) {

        return bot.sendMessage(
          chatId,
          "❌ Quiz not found"
        );

      }

      g.subject =
        subject;

      const quizUrl =
        subject === "ROOT"

          ? `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${g.quizCode}.json`

          : `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${subject}/${g.quizCode}.json`;

      let res =
        await fetch(
          quizUrl
        );

      g.quiz =
        await res.json();

      if (
        !Array.isArray(
          g.quiz
        ) ||
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
          }
        );

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

  }
);

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

    g.running =
      false;

    clearTimeout(
      g.timer
    );

    result(
      chatId
    );

  }
);

// ================= AUTO LOAD QUIZ =================

async function autoLoadQuiz(
  chatId
) {

  let quizCode =
    `DAK-QuizAlpha${currentQuiz}`;

  if (!groupData[chatId]) {
    groupData[chatId] = {};
  }

  let g =
    groupData[chatId];

  if (
    g.running
  ) {

    console.log(
      `Auto load skipped: ${chatId} already running`
    );

    return false;
  }

  g.quizCode =
    quizCode;

  g.quiz = [];
  g.i = 0;

  g.scores = {};
  g.names = {};

  g.participants = {};

  g.running =
    false;

  g.stats = {};
  g.startTime = {};

  g.userAnswers = {};
  g.pollChatMap = {};

  g.autoMode =
    true;

  g.retryTimer =
    null;

  g.retryCount =
    0;

  try {

    const subject =
      await findQuizSubject(
        quizCode
      );

    if (!subject) {

      console.log(
        `Quiz not found: ${quizCode}`
      );

      return false;
    }

    g.subject =
      subject;

    const quizUrl =
      subject === "ROOT"

        ? `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${quizCode}.json`

        : `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${subject}/${quizCode}.json`;

    const res =
      await fetch(
        quizUrl
      );

    if (!res.ok) {

      console.log(
        `Quiz HTTP error: ${res.status}`
      );

      return false;
    }

    g.quiz =
      await res.json();

    if (
      !Array.isArray(
        g.quiz
      ) ||
      g.quiz.length === 0
    ) {

      console.log(
        `No questions found: ${quizCode}`
      );

      return false;
    }

    console.log(
      `${quizCode} Loaded Successfully`
    );

    return true;

  } catch (err) {

    console.log(
      "Auto Load Error:",
      err.message
    );

    return false;
  }
}

// ================= START QUIZ =================

function startQuiz(
  chatId
) {

  console.log(
    ">>> startQuiz() called:",
    chatId
  );

  const g =
    groupData[chatId];

  if (!g) {
    return;
  }

  if (
    g.running
  ) {
    return;
  }

  if (
    !Array.isArray(
      g.quiz
    ) ||
    g.quiz.length === 0
  ) {

    console.log(
      `Cannot start: quiz not loaded for ${chatId}`
    );

    return;
  }

  g.running =
    true;

  g.i =
    Number.isInteger(g.i)
      ? g.i
      : 0;
  clearTimeout(
    g.timer
  );

  g.timer =
    setTimeout(
      () => {

        sendQ(
          chatId
        );

      },
      1000
    );

}

// ================= SEND QUESTION =================

async function sendQ(
  chatId
) {

  const g =
    groupData[chatId];

  if (
    !g ||
    !g.running
  ) {

    return;
  }

  try {

    if (
      g.i >=
      g.quiz.length
    ) {

      g.running =
        false;

      return result(
        chatId
      );
    }

    const raw =
      g.quiz[g.i] ||
      {};

    let q =
      raw.q ||
      raw.question;

    let options =
      raw.o ||
      raw.options;

    const answer =
      raw.correct_option_id ??
      raw.a ??
      raw.answer;

    if (q) {

      q =
        String(q);

      if (
        q.length > 280
      ) {

        q =
          q.slice(
            0,
            277
          ) +
          "...";
      }
    }

    if (
      Array.isArray(
        options
      )
    ) {

      options =
        options.map(
          o => {

            const text =
              String(o);

            return text.length > 90
              ? text.slice(
                  0,
                  87
                ) + "..."
              : text;

          }
        );
    }

    if (
      !q ||
      !Array.isArray(
        options
      ) ||
      options.length < 2 ||
      options.length > 10 ||
      answer === undefined
    ) {

      console.log(
        `Skipping bad question ${g.i + 1}`
      );

      g.i++;

      return sendQ(
        chatId
      );
    }

    const numericAnswer =
      Number(answer);

    if (
      !Number.isInteger(
        numericAnswer
      ) ||
      numericAnswer < 0 ||
      numericAnswer >= options.length
    ) {

      console.log(
        `Skipping question ${g.i + 1}: invalid answer ${answer}`
      );

      g.i++;

      return sendQ(
        chatId
      );
    }

    // ===== SEND POLL =====

    const sent =
      await bot.sendPoll(

        chatId,

        `${g.i + 1}/${g.quiz.length}. ${q}`,

        options,

        {
          type:
            "quiz",

          correct_option_id:
            numericAnswer,

          explanation:
            raw.e
              ? String(raw.e)
              : "",

          is_anonymous:
            false,

          open_period:
            30
        }
      );

    const pollId =
      sent.poll.id;

    if (
      !g.userAnswers
    ) {

      g.userAnswers =
        {};
    }

    if (
      !g.pollChatMap
    ) {

      g.pollChatMap =
        {};
    }

    g.userAnswers[pollId] =
      {};

    g.pollChatMap[pollId] =
      chatId;

    g.correct =
      numericAnswer;

    g.currentPollId =
      pollId;

    g.retryCount =
      0;

    // ===== SCORE PROCESSING =====

    setTimeout(
      () => {

        try {

          const answers =
            g.userAnswers[pollId] ||
            {};

          for (
            const userId
            in answers
          ) {

            if (
              !g.stats[userId]
            ) {

              g.stats[userId] = {

                right:
                  0,

                wrong:
                  0,

                attempted:
                  0
              };
            }

            if (
              g.scores[userId] ===
              undefined
            ) {

              g.scores[userId] =
                0;
            }

            const selected =
              answers[userId];

            g.stats[userId]
              .attempted++;

            if (
              selected ===
              g.correct
            ) {

              g.scores[userId] +=
                1;

              g.stats[userId]
                .right++;

            } else {

              g.scores[userId] -=
                0.25;

              g.stats[userId]
                .wrong++;
            }

          }

          delete g.userAnswers[
            pollId
          ];

          delete g.pollChatMap[
            pollId
          ];

        } catch (err) {

          console.log(
            "Score Processing Error:",
            err.message
          );
        }

      },
      31000
    );

    // ===== NEXT QUESTION =====

    clearTimeout(
      g.timer
    );

    g.timer =
      setTimeout(
        async () => {

          try {

            if (
              (g.i + 1) % 5 ===
              0
            ) {

              showLeaderboard(
                chatId
              );
            }

            g.i++;

            await sendQ(
              chatId
            );

          } catch (err) {

            console.log(
              "Next Question Error:",
              err.message
            );

            clearTimeout(
              g.retryTimer
            );

            g.retryTimer =
              setTimeout(
                () => {

                  sendQ(
                    chatId
                  );

                },
                5000
              );
          }

        },
        31000
      );

  } catch (err) {

    console.log(
      "sendQ Error:",
      err.message
    );

    if (
      !g.retryCount
    ) {

      g.retryCount =
        0;
    }

    g.retryCount++;

    console.log(
      `Retry Attempt: ${g.retryCount}`
    );

    if (
      g.retryCount <= 5
    ) {

      clearTimeout(
        g.retryTimer
      );

      g.retryTimer =
        setTimeout(
          () => {

            sendQ(
              chatId
            );

          },
          5000
        );

      return;
    }

    console.log(
      "Skipping broken question..."
    );

    g.retryCount =
      0;

    g.i++;

    clearTimeout(
      g.retryTimer
    );

    g.retryTimer =
      setTimeout(
        () => {

          sendQ(
            chatId
          );

        },
        1000
      );
  }
}

// ================= POLL ANSWERS =================

bot.on('poll_answer', (msg) => {
  const p = msg.poll_id;
  const u = msg.user.id;
  const a = msg.option_ids?.[0];

  // ===== ANNOUNCEMENT POLL =====
  // Check POLL ID first.
  // Do NOT use option number alone to identify announcement polls.
  for (const chatId in announcementPolls) {
    const info = announcementPolls[chatId];

    if (info && info.pollId === p) {

      // Option 4 of announcement poll = WEB
      if (a === 3) {
        const webLink =
          `https://digitalacademykannada.blogspot.com/p/dakalpha.html?quiz=${info.quizCode}`;

        bot.editMessageReplyMarkup(
          {
            inline_keyboard: [[
              {
                text: "🌐 PLAY QUIZ IN WEB",
                url: webLink
              }
            ]]
          },
          {
            chat_id: chatId,
            message_id: info.messageId
          }
        ).catch(err =>
          console.log("Web Button Error:", err.message)
        );
      }

      // Announcement poll handled
      return;
    }
  }

  // ===== NORMAL QUIZ ANSWERS =====

  // Ignore empty/retracted answers
  if (a === undefined) return;

  for (const chatId in groupData) {
    const g = groupData[chatId];

    if (g.pollChatMap && g.pollChatMap[p]) {

      if (!g.userAnswers[p]) {
        g.userAnswers[p] = {};
      }

      g.userAnswers[p][u] = a;

      g.names[u] = msg.user.first_name;
      g.participants[u] = true;

      if (g.scores[u] === undefined) {
        g.scores[u] = 0;
      }

      if (!g.stats[u]) {
        g.stats[u] = {
          right: 0,
          wrong: 0,
          attempted: 0
        };
      }

      break;
    }
  }
});              
// ================= LEADERBOARD =================

function showLeaderboard(
  chatId
) {

  const g =
    groupData[chatId];

  if (!g) {
    return;
  }

  const sorted =
    Object.entries(
      g.scores || {}
    )
    .sort(
      (a, b) =>
        Number(b[1]) -
        Number(a[1])
    );

  const funLines = [

    "🔥 Competition getting intense...",

    "👀 Leaderboard changing fast...",

    "⚡ One answer can change everything...",

    "🏆 Top ranks are fighting hard...",

    "😎 Silent players climbing leaderboard..."

  ];

  const randomLine =
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
    .forEach(
      (u, i) => {

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
`${medal} ${i + 1}. ${g.names[u[0]] || "Unknown"} — ${Number(u[1]).toFixed(2)} score\n`;

      }
    );

  text +=
`\n📉 Negative marking active (-0.25)\n`;

  text +=
`\n${randomLine}`;

  bot.sendMessage(
    chatId,
    text
  )
  .catch(
    err =>
      console.log(
        "Leaderboard Send Error:",
        err.message
      )
  );

}
// ================= RESULT =================

function result(chatId) {

  console.log(
    "========== RESULT CALLED =========="
  );

  const g =
    groupData[chatId];

  if (!g) {
    return;
  }

  clearTimeout(g.timer);
  clearTimeout(g.retryTimer);

  g.running = false;

  const sorted =
    Object.entries(
      g.scores || {}
    ).sort(
      (a, b) =>
        Number(b[1]) - Number(a[1])
    );

  let text =
`🏁 Quiz ${g.quizCode} Finished!

`;

  if (sorted.length === 0) {

    text +=
      `😅 No participants found`;

    return bot.sendMessage(
      chatId,
      text
    );

  }

  text +=
`📉 Negative marking applied (-0.25)

🏆 Final Leaderboard

`;

  sorted.forEach(
    (u, i) => {

      const userId =
        u[0];

      const stats =
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
`${medal} ${i + 1}. ${g.names[userId] || "Unknown"}
Score: ${Number(u[1]).toFixed(2)} | Right: ${stats.right} | Wrong: ${stats.wrong} | Attempted: ${stats.attempted}

`;

    }
  );

  const winnerName =
    g.names[sorted[0][0]] ||
    "Unknown";

  const winnerScore =
    Number(sorted[0][1]);

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

              allow_group_chats:
                true,

              allow_user_chats:
                false,

              allow_channel_chats:
                false,

              allow_bot_chats:
                false

            }

          }

        ]]

      }
    }
  )
  .catch(
    err =>
      console.log(
        "Result Message Error:",
        err.message
      )
  );

  // ===== LEADERBOARD POSTER =====

  const leaderboardData =
    sorted.map(
      ([userId, score]) => ({

        name:
          g.names[userId] ||
          "Unknown",

        score:
          Number(score)

      })
    );

  generateLeaderboard(
    leaderboardData,
    g.quizCode
  )
  .then(
    async leaderboardPath => {

      try {

        await bot.sendPhoto(
          chatId,

          fs.createReadStream(
            leaderboardPath
          ),

          {
            caption:
`👑 Congratulations to the TOP 10!

🏆 Champions

📘 Quiz: ${g.quizCode}`
          }

        );

      }
      catch (err) {

        console.log(
          "Leaderboard Send Error:",
          err.message
        );

      }

      try {

        fs.unlinkSync(
          leaderboardPath
        );

      }
      catch (e) {}

    }
  )
  .catch(
    err => {

      console.log(
        "Leaderboard Error:",
        err.message
      );

    }
  );

  // ===== CERTIFICATE =====

  generateCertificate(
    winnerName,
    winnerScore,
    g.quizCode
  )
  .then(
    async path => {

      try {

        await bot.sendPhoto(
          chatId,

          fs.createReadStream(
            path
          ),

          {
            caption:
`🏆 Congratulations ${winnerName}!

🥇 Rank : 1st Place
📘 Quiz : ${g.quizCode}

🔥 DAK QuizAlpha`
          }

        );

      }
      catch (err) {

        console.log(
          "Certificate Send Error:",
          err.message
        );

      }

      try {

        fs.unlinkSync(path);

      }
      catch (e) {}

    }
  )
  .catch(
    err => {

      console.log(
        "Certificate Error:",
        err.message
      );

    }
  );

  // ===== YOUTUBE =====

  sendYouTubeMessage(
    chatId,
    g.quizCode
  )
  .catch(
    err => {

      console.log(
        "YouTube Message Error:",
        err.message
      );

    }
  );

  // ===== AUTO QUIZ INCREMENT =====

  if (g.autoMode) {

    if (
      stateUpdatedForQuiz !==
      g.quizCode
    ) {

      stateUpdatedForQuiz =
        g.quizCode;

      const nextQuiz =
        Number(currentQuiz) + 1;

      currentQuiz =
        nextQuiz;

      updateStateFile(
        nextQuiz
      )
      .then(
        () => {

          console.log(
            `Next Quiz -> DAK-QuizAlpha${nextQuiz}`
          );

        }
      )
      .catch(
        err => {

          console.log(
            "State Update Error:",
            err.message
          );

        }
      );

    }
    else {

      console.log(
        `Already updated for ${g.quizCode}`
      );

    }

  }

}
// ================= /RESULT =================

bot.onText(
  /\/result(?:@[\w_]+)?/,
  (msg) => {

    const chatId =
      msg.chat.id;

    const g =
      groupData[chatId];

    if (!g) {

      return bot.sendMessage(
        chatId,
        "⚠️ No quiz data available."
      );

    }

    if (g.running) {

      return bot.sendMessage(
        chatId,
        "⚠️ Quiz is still running."
      );

    }

    return result(
      chatId
    );

  }
);

// ================= /STATUS =================

bot.onText(
  /\/status(?:@[\w_]+)?/,
  (msg) => {

    const chatId =
      msg.chat.id;

    const g =
      groupData[chatId];

    if (!g) {

      return bot.sendMessage(
        chatId,
        "ℹ️ No quiz has been loaded."
      );

    }

    const participants =
      Object.keys(
        g.participants || {}
      ).length;

    bot.sendMessage(
      chatId,

`📊 DAK QuizAlpha Status

📘 Quiz:
${g.quizCode || "Not loaded"}

📚 Subject:
${formatSubject(
  g.subject || "ROOT"
)}

📊 Questions:
${
  Array.isArray(g.quiz)
    ? g.quiz.length
    : 0
}

👥 Participants:
${participants}

${
  g.running
    ? "🟢 Quiz Running"
    : "🔴 Quiz Not Running"
}`
    );

  }
);

// ================= GROUP REQUEST =================

bot.onText(
  /\/request(?:@[\w_]+)?/,
  async (msg) => {

    const chatId =
      msg.chat.id;

    if (
      msg.chat.type === "private"
    ) {

      return;
    }

    const approved =
      loadApproved();

    if (
      approved.includes(chatId)
    ) {

      return bot.sendMessage(
        chatId,
        "✅ This group is already approved."
      );

    }

    pendingApproval[chatId] =
      msg.chat.title ||
      "Unknown Group";

    try {

      await bot.sendMessage(
        OWNER_ID,

`🔔 New Group Approval Request

👥 Group:
${msg.chat.title || "Unknown"}

🆔 Chat ID:
${chatId}`,

        {
          reply_markup: {

            inline_keyboard: [[

              {
                text:
                  "✅ Approve",

                callback_data:
                  `approve_${chatId}`
              },

              {
                text:
                  "❌ Reject",

                callback_data:
                  `reject_${chatId}`
              }

            ]]

          }
        }
      );

      return bot.sendMessage(
        chatId,
        "📨 Approval request sent to the owner."
      );

    }
    catch (err) {

      console.log(
        "Approval Request Error:",
        err.message
      );

    }

  }
);
// ================= AUTO SCHEDULER =================

// IST helper
function getISTTime() {

  const parts =
    new Intl.DateTimeFormat(
      "en-IN",
      {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }
    ).formatToParts(new Date());

  let hour =
    Number(
      parts.find(
        p => p.type === "hour"
      ).value
    );

  if (hour === 24) {
    hour = 0;
  }

  return {
    hour,
    minute:
      Number(
        parts.find(
          p => p.type === "minute"
        ).value
      ),
    second:
      Number(
        parts.find(
          p => p.type === "second"
        ).value
      )
  };
}

// ================= IST DATE KEY =================

function getISTDateKey() {

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(new Date());

}

// ================= COUNTDOWN TEXT =================

function formatCountdown(totalSeconds) {

  totalSeconds =
    Math.max(
      0,
      Math.floor(totalSeconds)
    );

  const minutes =
    Math.floor(
      totalSeconds / 60
    );

  const seconds =
    totalSeconds % 60;

  return (
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  );

}

// ================= AUTO SCHEDULER =================

setInterval(
  async () => {

    try {

      if (
        currentQuiz === null ||
        !Number.isFinite(
          Number(currentQuiz)
        )
      ) {

        return;

      }

      const {
        hour,
        minute,
        second
      } =
        getISTTime();

      const today =
        getISTDateKey();

      // ================= DAILY RESET =================

      if (
        global.lastReset !== today
      ) {

        global.lastReset =
          today;

        lastYouTube =
          "";

        lastAnnouncement =
          "";

        lastStart =
          "";

        announcementPolls =
          {};

        console.log(
          "🔄 Scheduler daily reset"
        );

      }

      const nowTotalSeconds =
        (
          hour * 60 +
          minute
        ) * 60 +
        second;

      // ================= YOUTUBE 1 HOUR BEFORE =================

      for (
        const quizTime
        of QUIZ_TIMES
      ) {

        const quizKey =
          `${quizTime.hour}:${quizTime.minute}`;

        let youtubeSeconds =
          (
            quizTime.hour * 60 +
            quizTime.minute
          ) * 60 -
          (
            YOUTUBE_BEFORE * 60
          );

        youtubeSeconds =
          (
            youtubeSeconds +
            86400
          ) % 86400;

        if (
          nowTotalSeconds >= youtubeSeconds &&
          nowTotalSeconds <
            youtubeSeconds + 1 &&
          lastYouTube !==
            `${today}-${quizKey}`
        ) {

          lastYouTube =
            `${today}-${quizKey}`;

          const approved =
            loadApproved();

          const quizCode =
            `DAK-QuizAlpha${currentQuiz}`;

          for (
            const chatId
            of approved
          ) {
            try {

              await sendYouTubeMessage(
                chatId,
                quizCode
              );

            }
            catch (err) {

              console.log(
                "YouTube Scheduler Error:",
                err.message
              );

            }

          }

        }

      }

      // ================= 5 MINUTE ANNOUNCEMENT POLL =================

      for (
        const quizTime
        of QUIZ_TIMES
      ) {

        const quizKey =
          `${quizTime.hour}:${quizTime.minute}`;

        const startSeconds =
          (
            quizTime.hour * 60 +
            quizTime.minute
          ) * 60;

        let remaining =
          startSeconds -
          nowTotalSeconds;

        if (
          remaining < 0
        ) {

          continue;

        }

        const announceSeconds =
          ANNOUNCE_BEFORE * 60;

        if (
          remaining >
          announceSeconds
        ) {

          continue;

        }

        const approved =
          loadApproved();

        // ================= CREATE POLL =================

if (
  remaining <= announceSeconds &&
  remaining > announceSeconds - 60
) {

  for (
    const chatId
    of approved
  ) {

    // ===== 1. CHECK EXISTING POLL =====
    if (announcementPolls[chatId]) {
      continue;
    }

    // ===== 2. CHECK RUNNING QUIZ =====
    if (
      groupData[chatId] &&
      groupData[chatId].running
    ) {
      continue;
    }

    // ===== 3. LOCK IMMEDIATELY =====
    // IMPORTANT: This is BEFORE any await.
    announcementPolls[chatId] = {
      sending: true
    };

    const quizCode =
      `DAK-QuizAlpha${currentQuiz}`;

            try {

              const subject =
                await findQuizSubject(
                  quizCode
                );

              if (!subject) {

                console.log(
                  `Announcement quiz not found: ${quizCode}`
                );

                continue;

              }

              const quizUrl =
                subject === "ROOT"

                  ? `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${quizCode}.json`

                  : `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${subject}/${quizCode}.json`;

              const res =
                await fetch(
                  quizUrl
                );

              if (!res.ok) {

                continue;

              }

              const quizData =
                await res.json();

              if (
                !Array.isArray(
                  quizData
                ) ||
                quizData.length === 0
              ) {

                continue;

              }

              if (
                !groupData[chatId]
              ) {

                groupData[chatId] =
                  {};

              }

              const g =
                groupData[chatId];

              g.quizCode =
                quizCode;

              g.subject =
                subject;

              g.quiz =
                quizData;

              g.autoMode =
                true;

              g.running =
                false;

              g.i =
                0;

              g.scores =
                {};

              g.names =
                {};

              g.participants =
                {};

              g.stats =
                {};

              g.startTime =
                {};

              g.userAnswers =
                {};

              g.pollChatMap =
                {};

              const startTime =
                `${String(quizTime.hour).padStart(2, "0")}:${String(quizTime.minute).padStart(2, "0")}`;

              const countdown =
                formatCountdown(
                  remaining
                );

              const announcement =
`📢 DAK QUIZALPHA

Quiz Code: ${quizCode}
Subjects: ${formatSubject(subject)}       
Questions: ${quizData.length}                           
Time: 30 Sec/Q                            
Negative: -0.25                           

Starts: ${startTime} IST                  
Announced Before: ${ANNOUNCE_BEFORE} min        

 Are you ready?👇`;

const sent =
  await bot.sendPoll(
    chatId,
    announcement,
    [
      "🙋 Iam waiting",
      "⏭️ Next quiz",
      "❌ Not today",
      "🌐 I play quiz in web"
    ],
    {
      is_anonymous: false,
      allows_multiple_answers: false,
      open_period:
        ANNOUNCE_BEFORE * 60
    }
  );

announcementPolls[
  chatId
] = {

  pollId:
    sent.poll.id,

  quizCode:
    quizCode,

  subject:
    subject,

  quizLength:
    quizData.length,

  startSeconds:
    startSeconds,

  messageId:
    sent.message_id

};

console.log(
  `📢 Announcement poll sent: ${chatId}`
);

            }
            catch (err) {
  // ===== 4. REMOVE LOCK ONLY IF SENDING FAILED =====

  console.log(
    "Announcement Poll Error:",
    err.message
  );
}

          }

        }

        // ================= START QUIZ =================

        if (
          hour === quizTime.hour &&
          minute === quizTime.minute &&
          lastStart !==
            `${today}-${quizKey}`
        ) {

          lastStart =
            `${today}-${quizKey}`;

          const approved =
            loadApproved();

          for (
            const chatId
            of approved
          ) {

            try {

              const info =
                announcementPolls[
                  chatId
                ];

              const quizCode =
                `DAK-QuizAlpha${currentQuiz}`;

              let loaded =
                false;

              if (
                info &&
                info.quizCode ===
                  quizCode
              ) {

                loaded =
                  true;

              }
              else {

                loaded =
                  await autoLoadQuiz(
                    chatId
                  );

              }

              if (!loaded) {

                continue;

              }

              const g =
                groupData[chatId];

              if (
                !g ||
                !Array.isArray(
                  g.quiz
                ) ||
                g.quiz.length === 0
              ) {

                continue;

              }

              console.log(
                `🚀 Starting ${quizCode} in ${chatId}`
              );

              /*
                No extra announcement here.
                The announcement poll simply expires,
                then the first quiz question starts.
              */

              startQuiz(
                chatId
              );

              delete announcementPolls[
                chatId
              ];

            }
            catch (err) {

              console.log(
                "Auto Start Error:",
                err.message
              );

            }

          }

        }

      }

    }
    catch (err) {

      console.log(
        "Scheduler Error:",
        err.message
      );

    }

  },
  1000
);

// ================= SERVER =================

app.get(
  "/",
  (req, res) => {

    res.send(
      "DAK QuizAlpha Bot is running 🚀"
    );

  }
);

const PORT =
  process.env.PORT ||
  3000;

app.listen(
  PORT,
  () => {

    console.log(
      `Server running on port ${PORT}`
    );

  }
);

// ================= STARTUP =================

loadCurrentQuiz();

console.log(
  "🔥 DAK QuizAlpha Bot started successfully"
);
