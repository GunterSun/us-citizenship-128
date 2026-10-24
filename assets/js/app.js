/**
 * 美国公民入籍考试 128 题全真复习指南 - 核心逻辑交互引擎
 * USCIS Civics Test 128 App Engine
 * 支持手机、平板、电脑端自适应，配有语音TTS朗读、抽认卡、全真模考、本州定制
 */

(function() {
  'use strict';

  // ==========================================
  // 1. 全局状态 State
  // ==========================================
  const State = {
    allQuestions: [],
    activeTab: 'list', // 'list' | 'flashcard' | 'exam' | 'mistakes' | 'bookmarks'
    filterCategory: 'all', // 'all' | 'starred' | 'part1' | 'part2' | 'part3' | 'bookmarks' | 'mistakes'
    searchQuery: '',
    hideChinese: false,
    seniorMode: false,
    
    // 学习记录持久化
    bookmarks: new Set(),
    mastered: new Set(),
    mistakes: new Set(),
    
    // 抽认卡状态
    fcIndex: 0,
    fcQueue: [],
    fcFlipped: false,
    
    // 随身磨耳朵音频播放器状态
    isPlayingContinuous: false,
    currentAudioIndex: 0,
    audioRate: 0.9, // 默认略慢一些，更适合听力备考
    audioQueue: [],
    audioPhase: 0, // 0: Question En, 1: Question Zh, 2: Answer En, 3: Answer Zh
    
    // 全真模拟考场
    exam: {
      type: 'standard', // 'standard' (20题及格12) | 'senior' (10题及格6)
      totalCount: 20,
      passThreshold: 12,
      questions: [],
      currentIndex: 0,
      userAnswers: [], // { question, isCorrect, revealed }
      isFinished: false
    },
    
    // 州官员定制 (Q23, Q29, Q61, Q62)
    stateCustom: {
      stateName: '加州 (California)',
      senator: 'Alex Padilla / Laphonza Butler',
      representative: '您的选区国会众议员 (根据您居住地邮编核查)',
      governor: 'Gavin Newsom (纽森)',
      capital: 'Sacramento (萨克拉门托)'
    }
  };

  // 预设州数据
  const STATE_PRESETS = {
    'CA': {
      stateName: '加州 (California)',
      senator: 'Alex Padilla',
      representative: '根据住址邮编核实 (如 Adam Schiff, Ted Lieu 等)',
      governor: 'Gavin Newsom (纽森)',
      capital: 'Sacramento (萨克拉门托)'
    },
    'NY': {
      stateName: '纽约州 (New York)',
      senator: 'Chuck Schumer / Kirsten Gillibrand',
      representative: '根据住址邮编核实 (如 Grace Meng 孟昭文 等)',
      governor: 'Kathy Hochul (霍楚)',
      capital: 'Albany (奥尔巴尼)'
    },
    'TX': {
      stateName: '德州 (Texas)',
      senator: 'Ted Cruz / John Cornyn',
      representative: '根据住址邮编核实',
      governor: 'Greg Abbott (阿博特)',
      capital: 'Austin (奥斯汀)'
    },
    'WA': {
      stateName: '华盛顿州 (Washington)',
      senator: 'Patty Murray / Maria Cantwell',
      representative: '根据住址邮编核实 (如 Pramila Jayapal 等)',
      governor: 'Bob Ferguson (或现任州长)',
      capital: 'Olympia (奥林匹亚)'
    },
    'FL': {
      stateName: '佛州 (Florida)',
      senator: 'Rick Scott / Marco Rubio',
      representative: '根据住址邮编核实',
      governor: 'Ron DeSantis (德桑蒂斯)',
      capital: 'Tallahassee (塔拉哈西)'
    },
    'IL': {
      stateName: '伊利诺伊州 (Illinois)',
      senator: 'Dick Durbin / Tammy Duckworth',
      representative: '根据住址邮编核实',
      governor: 'JB Pritzker (普利茨克)',
      capital: 'Springfield (斯普林菲尔德)'
    }
  };

  // ==========================================
  // 2. 初始化与本地持久化加载
  // ==========================================
  function init() {
    loadQuestions();
    loadStorage();
    setupAudioTTS();
    bindEvents();
    renderAll();
    setupQRCodeModal();
  }

  function loadQuestions() {
    if (window.USCIS_128_QUESTIONS && Array.isArray(window.USCIS_128_QUESTIONS)) {
      State.allQuestions = JSON.parse(JSON.stringify(window.USCIS_128_QUESTIONS));
    } else {
      console.error("USCIS_128_QUESTIONS 数据未找到");
    }
    applyStateCustomToQuestions();
  }

  function applyStateCustomToQuestions() {
    State.allQuestions.forEach(q => {
      if (q.id === 23) {
        q.answerEn = State.stateCustom.senator;
        q.answerZh = `${State.stateCustom.stateName}参议员：${State.stateCustom.senator}`;
      } else if (q.id === 29) {
        q.answerEn = State.stateCustom.representative;
        q.answerZh = `依选区而定：${State.stateCustom.representative}`;
      } else if (q.id === 61) {
        q.answerEn = State.stateCustom.governor;
        q.answerZh = `${State.stateCustom.stateName}现任州长：${State.stateCustom.governor}`;
      } else if (q.id === 62) {
        q.answerEn = State.stateCustom.capital;
        q.answerZh = `${State.stateCustom.stateName}首府：${State.stateCustom.capital}`;
      }
    });
  }

  function loadStorage() {
    try {
      const b = localStorage.getItem('uscis_bookmarks');
      if (b) State.bookmarks = new Set(JSON.parse(b));
      
      const m = localStorage.getItem('uscis_mastered');
      if (m) State.mastered = new Set(JSON.parse(m));
      
      const w = localStorage.getItem('uscis_mistakes');
      if (w) State.mistakes = new Set(JSON.parse(w));
      
      const s = localStorage.getItem('uscis_state_custom');
      if (s) State.stateCustom = JSON.parse(s);

      const hc = localStorage.getItem('uscis_hide_chinese');
      if (hc === 'true') {
        State.hideChinese = true;
        document.body.classList.add('hide-chinese');
        const chk = document.getElementById('toggle-hide-chinese');
        if (chk) chk.checked = true;
      }

      const sm = localStorage.getItem('uscis_senior_mode');
      if (sm === 'true') {
        State.seniorMode = true;
        document.body.classList.add('senior-mode');
        const chk = document.getElementById('toggle-senior-mode');
        if (chk) chk.checked = true;
      }
    } catch (e) {
      console.warn("Storage load error:", e);
    }
  }

  function saveStorage() {
    try {
      localStorage.setItem('uscis_bookmarks', JSON.stringify(Array.from(State.bookmarks)));
      localStorage.setItem('uscis_mastered', JSON.stringify(Array.from(State.mastered)));
      localStorage.setItem('uscis_mistakes', JSON.stringify(Array.from(State.mistakes)));
      localStorage.setItem('uscis_state_custom', JSON.stringify(State.stateCustom));
      localStorage.setItem('uscis_hide_chinese', State.hideChinese.toString());
      localStorage.setItem('uscis_senior_mode', State.seniorMode.toString());
    } catch (e) {
      console.warn("Storage save error:", e);
    }
  }

  // ==========================================
  // 3. TTS 语音朗读引擎 (Web Speech API)
  // ==========================================
  let synth = window.speechSynthesis;
  let voices = [];
  let enVoice = null;
  let zhVoice = null;

  function setupAudioTTS() {
    if (!synth) {
      console.warn("Web Speech Synthesis not supported in this browser.");
      return;
    }
    function updateVoices() {
      voices = synth.getVoices();
      enVoice = voices.find(v => v.lang.startsWith('en-US') && (v.name.includes('Samantha') || v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Siri'))) 
             || voices.find(v => v.lang.startsWith('en-US')) 
             || voices.find(v => v.lang.startsWith('en'));
             
      zhVoice = voices.find(v => (v.lang === 'zh-CN' || v.lang === 'zh-TW') && (v.name.includes('Tingting') || v.name.includes('Google') || v.name.includes('Natural')))
             || voices.find(v => v.lang.startsWith('zh'));
    }
    updateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = updateVoices;
    }
  }

  function stopAllSpeech() {
    if (synth) {
      synth.cancel();
    }
    State.isPlayingContinuous = false;
    updatePlayerUI();
  }

  function speakText(text, lang = 'en', onEndCallback = null) {
    if (!synth) return;
    synth.cancel(); // Stop current

    // Clean brackets/slashes for natural reading
    const cleanText = text.replace(/[\(\)\[\]\/·]/g, ' ').replace(/\s+/g, ' ').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = State.audioRate;
    utterance.pitch = 1.0;

    if (lang === 'en') {
      utterance.lang = 'en-US';
      if (enVoice) utterance.voice = enVoice;
    } else {
      utterance.lang = 'zh-CN';
      if (zhVoice) utterance.voice = zhVoice;
    }

    if (onEndCallback) {
      utterance.onend = onEndCallback;
      utterance.onerror = onEndCallback;
    }

    synth.speak(utterance);
  }

  // 连续磨耳朵循环朗读
  function startContinuousPlay(startIndex = 0) {
    const list = getFilteredQuestions();
    if (list.length === 0) return;
    
    State.audioQueue = list;
    State.currentAudioIndex = Math.min(Math.max(0, startIndex), list.length - 1);
    State.isPlayingContinuous = true;
    State.audioPhase = 0;
    
    playNextContinuousSegment();
    updatePlayerUI();
  }

  function playNextContinuousSegment() {
    if (!State.isPlayingContinuous) return;
    if (State.currentAudioIndex >= State.audioQueue.length) {
      // 循环回第一题
      State.currentAudioIndex = 0;
    }
    
    const q = State.audioQueue[State.currentAudioIndex];
    updatePlayerUI(q);
    
    // 朗读流程：
    // Phase 0: 英文提问 -> Phase 1: 中文提问 (若未开启隐藏中文) -> Phase 2: 英文回答 -> Phase 3: 中文回答 -> 暂停800ms -> 下一题
    if (State.audioPhase === 0) {
      speakText(`Question ${q.id}. ${q.questionEn}`, 'en', () => {
        if (!State.isPlayingContinuous) return;
        setTimeout(() => {
          State.audioPhase = 1;
          playNextContinuousSegment();
        }, 300);
      });
    } else if (State.audioPhase === 1) {
      if (State.hideChinese) {
        State.audioPhase = 2;
        playNextContinuousSegment();
        return;
      }
      speakText(q.questionZh, 'zh', () => {
        if (!State.isPlayingContinuous) return;
        setTimeout(() => {
          State.audioPhase = 2;
          playNextContinuousSegment();
        }, 300);
      });
    } else if (State.audioPhase === 2) {
      speakText(`Answer: ${q.answerEn}`, 'en', () => {
        if (!State.isPlayingContinuous) return;
        setTimeout(() => {
          State.audioPhase = 3;
          playNextContinuousSegment();
        }, 300);
      });
    } else if (State.audioPhase === 3) {
      if (State.hideChinese) {
        advanceToNextQuestion();
        return;
      }
      speakText(q.answerZh, 'zh', () => {
        if (!State.isPlayingContinuous) return;
        advanceToNextQuestion();
      });
    }
  }

  function advanceToNextQuestion() {
    setTimeout(() => {
      if (!State.isPlayingContinuous) return;
      State.audioPhase = 0;
      State.currentAudioIndex = (State.currentAudioIndex + 1) % State.audioQueue.length;
      playNextContinuousSegment();
    }, 1000);
  }

  function updatePlayerUI(currentQ) {
    const playBtn = document.getElementById('player-play-btn');
    const titleEl = document.getElementById('player-title');
    const subEl = document.getElementById('player-sub');
    const speedBtn = document.getElementById('player-speed-btn');

    if (playBtn) {
      playBtn.innerHTML = State.isPlayingContinuous ? '⏸' : '▶';
      playBtn.setAttribute('title', State.isPlayingContinuous ? '暂停朗读' : '开始磨耳朵连续朗读');
    }

    if (speedBtn) {
      speedBtn.innerText = `${State.audioRate}x`;
    }

    const q = currentQ || (State.audioQueue[State.currentAudioIndex] || State.allQuestions[0]);
    if (q && titleEl) {
      titleEl.innerText = `${q.id}. ${q.questionEn}`;
    }
    if (q && subEl) {
      subEl.innerText = `${q.answerEn} · ${q.answerZh}`;
    }
  }

  // ==========================================
  // 4. 数据筛选与计算
  // ==========================================
  function getFilteredQuestions() {
    let list = [...State.allQuestions];

    // Filter by tab / category
    if (State.filterCategory === 'starred') {
      list = list.filter(q => q.starred);
    } else if (State.filterCategory === 'part1') {
      list = list.filter(q => q.part.includes('PART 1'));
    } else if (State.filterCategory === 'part2') {
      list = list.filter(q => q.part.includes('PART 2'));
    } else if (State.filterCategory === 'part3') {
      list = list.filter(q => q.part.includes('PART 3'));
    } else if (State.filterCategory === 'bookmarks') {
      list = list.filter(q => State.bookmarks.has(q.id));
    } else if (State.filterCategory === 'mistakes') {
      list = list.filter(q => State.mistakes.has(q.id));
    }

    // Filter by Search Query
    if (State.searchQuery.trim() !== '') {
      const qLower = State.searchQuery.trim().toLowerCase();
      list = list.filter(q => {
        return q.id.toString() === qLower ||
               q.questionEn.toLowerCase().includes(qLower) ||
               q.questionZh.includes(qLower) ||
               q.answerEn.toLowerCase().includes(qLower) ||
               q.answerZh.includes(qLower) ||
               (q.keywords && q.keywords.toLowerCase().includes(qLower));
      });
    }

    return list;
  }

  // ==========================================
  // 5. 视图渲染 (View Rendering)
  // ==========================================
  function renderAll() {
    updateBadges();
    if (State.activeTab === 'list') {
      renderListView();
    } else if (State.activeTab === 'flashcard') {
      renderFlashcardView();
    } else if (State.activeTab === 'exam') {
      renderExamView();
    } else if (State.activeTab === 'mistakes') {
      renderMistakesView();
    }
  }

  function updateBadges() {
    const starCount = State.allQuestions.filter(q => q.starred).length;
    const bookCount = State.bookmarks.size;
    const misCount = State.mistakes.size;
    
    const starBadge = document.getElementById('badge-starred-count');
    if (starBadge) starBadge.innerText = `${starCount}题`;

    const bookBadge = document.getElementById('badge-bookmarks-count');
    if (bookBadge) bookBadge.innerText = bookCount;

    const misBadge = document.getElementById('badge-mistakes-count');
    if (misBadge) misBadge.innerText = misCount;

    const bannerStats = document.getElementById('stats-summary');
    if (bannerStats) {
      bannerStats.innerHTML = `已掌握: <strong style="color:var(--accent-green)">${State.mastered.size}</strong>/128 | 错题本: <strong style="color:var(--accent-red)">${misCount}</strong> | 收藏: <strong style="color:var(--accent-gold)">${bookCount}</strong>`;
    }
  }

  // 渲染列表学习模式
  function renderListView() {
    const container = document.getElementById('question-list-container');
    if (!container) return;

    const list = getFilteredQuestions();
    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 48px 16px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
          <div style="font-size: 2.4rem; margin-bottom: 8px;">🔍</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: #FFF;">没有找到匹配的考题</div>
          <p style="font-size: 0.85rem; margin-top: 6px;">可尝试切换筛选条件或清空搜索关键词</p>
        </div>
      `;
      return;
    }

    let html = '';
    list.forEach(q => {
      const isStarred = q.starred;
      const isBookmarked = State.bookmarks.has(q.id);
      const isMastered = State.mastered.has(q.id);

      html += `
        <article class="question-card ${isStarred ? 'is-starred' : ''} ${isMastered ? 'is-mastered' : ''}" data-id="${q.id}">
          <div class="card-top-row">
            <div class="card-tags">
              <span class="q-badge-num">第 ${q.id} 题</span>
              ${isStarred ? '<span class="q-badge-star">⭐ 65/20长者必考</span>' : ''}
              <span class="q-badge-cat">${q.category}</span>
            </div>
            <div class="card-actions-quick">
              <button class="btn-card-action btn-bookmark ${isBookmarked ? 'bookmarked' : ''}" title="${isBookmarked ? '取消收藏' : '收藏此题'}" data-action="toggle-bookmark" data-id="${q.id}">
                ${isBookmarked ? '★' : '☆'}
              </button>
              <button class="btn-card-action btn-master ${isMastered ? 'mastered' : ''}" title="${isMastered ? '已掌握 (点击标记未掌握)' : '标记为已掌握'}" data-action="toggle-mastered" data-id="${q.id}">
                ${isMastered ? '✓ 已掌握' : '○ 掌握'}
              </button>
            </div>
          </div>

          <div class="card-question-box">
            <div class="q-text-en">
              <span>${q.questionEn}</span>
              <button class="btn-speech" data-action="speak-q" data-id="${q.id}" title="朗读英文考题">
                🔊 听考题
              </button>
            </div>
            <div class="q-text-zh">${q.questionZh}</div>
          </div>

          <div class="card-answer-box">
            <div class="ans-header">
              <div class="ans-label">
                <span>官方标准答法</span>
              </div>
              <button class="btn-speech" data-action="speak-a" data-id="${q.id}" title="朗读官方标准答案">
                🔊 听答案
              </button>
            </div>
            <div class="ans-text-en">${q.answerEn}</div>
            <div class="ans-text-zh">${q.answerZh}</div>
          </div>

          <div class="card-footer-tip">
            ${q.keywords ? `
              <div class="keywords-tag">
                <span>🎯 听力抓取词:</span>
                <strong>${q.keywords}</strong>
              </div>
            ` : ''}
            ${q.tip ? `
              <div class="mnemonic-tip">
                💡 ${q.tip}
              </div>
            ` : ''}
          </div>
        </article>
      `;
    });

    container.innerHTML = html;
  }

  // 渲染记忆抽认卡 (Flashcards 3D)
  function renderFlashcardView() {
    const list = getFilteredQuestions();
    if (list.length === 0) {
      const container = document.getElementById('flashcard-container');
      if (container) {
        container.innerHTML = `
          <div style="text-align:center; padding: 40px; color: var(--text-muted);">
            <h3>当前筛选分类下无卡片</h3>
            <p>请点击上方“全部128题”或“长者20题”后再试</p>
          </div>
        `;
      }
      return;
    }

    if (State.fcIndex >= list.length) State.fcIndex = 0;
    const q = list[State.fcIndex];
    const isBookmarked = State.bookmarks.has(q.id);

    // 更新进度条
    const progressPct = Math.round(((State.fcIndex + 1) / list.length) * 100);
    const pBar = document.getElementById('fc-progress-bar');
    if (pBar) pBar.style.width = `${progressPct}%`;

    const countText = document.getElementById('fc-counter-text');
    if (countText) countText.innerText = `卡片 ${State.fcIndex + 1} / ${list.length}`;

    const inner = document.getElementById('flashcard-inner');
    if (inner) {
      inner.classList.toggle('is-flipped', State.fcFlipped);
      inner.innerHTML = `
        <!-- 正面: 英文问题与听力 -->
        <div class="flashcard-face flashcard-front">
          <div class="fc-face-header">
            <span class="q-badge-num">第 ${q.id} 题</span>
            ${q.starred ? '<span class="q-badge-star">⭐ 65/20长者必考</span>' : ''}
            <button class="btn-card-action ${isBookmarked ? 'bookmarked' : ''}" data-action="toggle-bookmark" data-id="${q.id}">
              ${isBookmarked ? '★ 收藏' : '☆ 收藏'}
            </button>
          </div>

          <div class="fc-face-content">
            <div class="q-big-en">${q.questionEn}</div>
            <div class="q-big-zh">${q.questionZh}</div>
          </div>

          <div class="fc-face-footer">
            <button class="btn-speech" data-action="speak-q" data-id="${q.id}">
              🔊 播放提问发音
            </button>
            <span>👆 点击卡片翻转看答案</span>
          </div>
        </div>

        <!-- 背面: 官方答案与速记技巧 -->
        <div class="flashcard-face flashcard-back">
          <div class="fc-face-header">
            <span class="ans-label">官方参考答案</span>
            <button class="btn-speech" data-action="speak-a" data-id="${q.id}">
              🔊 朗读标准回答
            </button>
          </div>

          <div class="fc-face-content">
            <div class="ans-big-en">${q.answerEn}</div>
            <div class="ans-big-zh">${q.answerZh}</div>
            ${q.keywords ? `
              <div style="margin-top: 14px; font-size: 0.88rem; color: var(--accent-gold);">
                🎯 抓听关键词: <strong>${q.keywords}</strong>
              </div>
            ` : ''}
            ${q.tip ? `
              <div style="margin-top: 6px; font-size: 0.82rem; color: #A7F3D0;">
                💡 ${q.tip}
              </div>
            ` : ''}
          </div>

          <div class="fc-face-footer">
            <span>🔄 再次点击可翻回正面</span>
          </div>
        </div>
      `;
    }
  }

  // 渲染全真模考 (Mock Exam)
  function renderExamView() {
    const setupCard = document.getElementById('exam-setup-card');
    const activeCard = document.getElementById('exam-active-card');
    const resultCard = document.getElementById('exam-result-card');

    if (!State.exam.questions || State.exam.questions.length === 0) {
      if (setupCard) setupCard.style.display = 'block';
      if (activeCard) activeCard.style.display = 'none';
      if (resultCard) resultCard.style.display = 'none';
      return;
    }

    if (State.exam.isFinished) {
      if (setupCard) setupCard.style.display = 'none';
      if (activeCard) activeCard.style.display = 'none';
      if (resultCard) {
        resultCard.style.display = 'block';
        renderExamResult();
      }
      return;
    }

    // 考试进行中
    if (setupCard) setupCard.style.display = 'none';
    if (resultCard) resultCard.style.display = 'none';
    if (activeCard) {
      activeCard.style.display = 'block';
      renderExamCurrentQuestion();
    }
  }

  function startExam(type = 'standard') {
    State.exam.type = type;
    let pool = [];
    if (type === 'senior') {
      pool = State.allQuestions.filter(q => q.starred);
      State.exam.totalCount = 10;
      State.exam.passThreshold = 6;
    } else {
      pool = [...State.allQuestions];
      State.exam.totalCount = 20;
      State.exam.passThreshold = 12;
    }

    // 随机抽取
    const shuffled = pool.sort(() => 0.5 - Math.random());
    State.exam.questions = shuffled.slice(0, State.exam.totalCount);
    State.exam.currentIndex = 0;
    State.exam.userAnswers = [];
    State.exam.isFinished = false;

    renderExamView();

    // 自动读出第一题
    setTimeout(() => {
      const q = State.exam.questions[0];
      if (q) speakText(`Question. ${q.questionEn}`, 'en');
    }, 400);
  }

  function renderExamCurrentQuestion() {
    const q = State.exam.questions[State.exam.currentIndex];
    const total = State.exam.totalCount;
    const currentNum = State.exam.currentIndex + 1;

    // 状态统计
    const correctCount = State.exam.userAnswers.filter(a => a.isCorrect).length;
    const answeredCount = State.exam.userAnswers.length;

    const countEl = document.getElementById('exam-current-count');
    if (countEl) countEl.innerText = `第 ${currentNum} / ${total} 题`;

    const scoreEl = document.getElementById('exam-score-display');
    if (scoreEl) scoreEl.innerHTML = `已答: <strong>${answeredCount}</strong> | 答对: <strong style="color:var(--accent-green)">${correctCount}</strong> (及格需 ${State.exam.passThreshold} 题)`;

    const pBar = document.getElementById('exam-progress-bar');
    if (pBar) pBar.style.width = `${Math.round((currentNum / total) * 100)}%`;

    const qEnEl = document.getElementById('exam-q-en');
    if (qEnEl) qEnEl.innerText = q.questionEn;

    const qZhEl = document.getElementById('exam-q-zh');
    if (qZhEl) qZhEl.innerText = q.questionZh;

    const ansReveal = document.getElementById('exam-answer-reveal');
    if (ansReveal) {
      ansReveal.classList.remove('show');
      ansReveal.innerHTML = `
        <div style="font-size:0.75rem; color:var(--accent-gold); font-weight:700; margin-bottom:4px;">官方标准答法</div>
        <div style="font-size:1.2rem; font-weight:800; color:#38BDF8; margin-bottom:4px;">${q.answerEn}</div>
        <div style="font-size:0.95rem; color:#CBD5E1;">${q.answerZh}</div>
      `;
    }
  }

  function handleExamAnswer(isCorrect) {
    const q = State.exam.questions[State.exam.currentIndex];
    State.exam.userAnswers.push({
      question: q,
      isCorrect: isCorrect
    });

    if (!isCorrect) {
      State.mistakes.add(q.id);
      saveStorage();
    } else {
      State.mastered.add(q.id);
      saveStorage();
    }

    if (State.exam.currentIndex + 1 >= State.exam.totalCount) {
      State.exam.isFinished = true;
      renderExamView();
    } else {
      State.exam.currentIndex++;
      renderExamCurrentQuestion();
      // 读出下一题
      setTimeout(() => {
        const nextQ = State.exam.questions[State.exam.currentIndex];
        if (nextQ) speakText(`Question. ${nextQ.questionEn}`, 'en');
      }, 300);
    }
  }

  function renderExamResult() {
    const resultCard = document.getElementById('exam-result-card');
    if (!resultCard) return;

    const correctCount = State.exam.userAnswers.filter(a => a.isCorrect).length;
    const total = State.exam.totalCount;
    const passed = correctCount >= State.exam.passThreshold;

    resultCard.className = `exam-result-card ${passed ? 'passed' : 'failed'}`;
    resultCard.innerHTML = `
      <div class="result-badge">${passed ? '🎉' : '📖'}</div>
      <h2 class="result-title" style="color: ${passed ? 'var(--accent-green)' : 'var(--accent-red)'}">
        ${passed ? '恭喜您！顺利通过模拟考试' : '还需加把劲，未达及格标准'}
      </h2>
      <div style="font-size: 1.3rem; font-weight:800; margin-bottom: 8px;">
        最终得分：<span style="color:var(--accent-gold)">${correctCount}</span> / ${total} 题
      </div>
      <p class="result-desc">
        ${passed ? 
          `移民局官方标准为答对 ${State.exam.passThreshold} 题即算合格，您的掌握非常扎实！` : 
          `及格需至少答对 ${State.exam.passThreshold} 题。错题已自动为您收集到错题本，建议开启随身磨耳朵继续复习。`}
      </p>

      <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:24px;">
        <button class="btn-start-exam" id="btn-retest">🔄 重新开始全真模拟</button>
        <button class="btn-icon" id="btn-view-mistakes-from-exam">📕 查看错题本</button>
      </div>
    `;

    const btnRetest = document.getElementById('btn-retest');
    if (btnRetest) {
      btnRetest.addEventListener('click', () => {
        startExam(State.exam.type);
      });
    }

    const btnMis = document.getElementById('btn-view-mistakes-from-exam');
    if (btnMis) {
      btnMis.addEventListener('click', () => {
        switchTab('mistakes');
      });
    }
  }

  // 渲染错题本模式
  function renderMistakesView() {
    const container = document.getElementById('mistakes-list-container');
    if (!container) return;

    const misList = State.allQuestions.filter(q => State.mistakes.has(q.id));
    if (misList.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 48px 16px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
          <div style="font-size: 2.6rem; margin-bottom: 10px;">🌟</div>
          <div style="font-size: 1.2rem; font-weight: 700; color: #FFF;">太棒了！您的错题本是空的</div>
          <p style="font-size: 0.88rem; margin-top: 6px;">在抽认卡或模拟考试中答错的题目会自动收集到这里，方便针对性强化巩固。</p>
        </div>
      `;
      return;
    }

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <span style="font-size:0.9rem; color:var(--text-muted);">共收集 <strong>${misList.length}</strong> 道薄弱错题</span>
        <button class="btn-icon" id="btn-clear-mistakes" style="font-size:0.8rem; color:var(--accent-red);">清空错题本</button>
      </div>
      <div class="question-list">
    `;

    misList.forEach(q => {
      html += `
        <article class="question-card is-starred" data-id="${q.id}">
          <div class="card-top-row">
            <div class="card-tags">
              <span class="q-badge-num">第 ${q.id} 题</span>
              ${q.starred ? '<span class="q-badge-star">⭐ 长者必考</span>' : ''}
              <span class="q-badge-cat">${q.category}</span>
            </div>
            <button class="btn-card-action" data-action="remove-mistake" data-id="${q.id}" title="已学会，移出错题本" style="font-size:0.85rem; color:var(--accent-green);">
              ✓ 移出错题本
            </button>
          </div>

          <div class="card-question-box">
            <div class="q-text-en">
              <span>${q.questionEn}</span>
              <button class="btn-speech" data-action="speak-q" data-id="${q.id}">🔊 听考题</button>
            </div>
            <div class="q-text-zh">${q.questionZh}</div>
          </div>

          <div class="card-answer-box">
            <div class="ans-header">
              <span class="ans-label">正确官方答案</span>
              <button class="btn-speech" data-action="speak-a" data-id="${q.id}">🔊 听答案</button>
            </div>
            <div class="ans-text-en">${q.answerEn}</div>
            <div class="ans-text-zh">${q.answerZh}</div>
          </div>

          <div class="card-footer-tip">
            ${q.keywords ? `<div class="keywords-tag"><span>🎯 抓听词:</span><strong>${q.keywords}</strong></div>` : ''}
            ${q.tip ? `<div class="mnemonic-tip">💡 ${q.tip}</div>` : ''}
          </div>
        </article>
      `;
    });

    html += '</div>';
    container.innerHTML = html;

    const btnClear = document.getElementById('btn-clear-mistakes');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (confirm('确定清空错题本吗？')) {
          State.mistakes.clear();
          saveStorage();
          renderAll();
        }
      });
    }
  }

  // ==========================================
  // 6. 标签页切换逻辑
  // ==========================================
  function switchTab(tabName) {
    State.activeTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.style.display = (pane.id === `tab-pane-${tabName}`) ? 'block' : 'none';
    });

    if (tabName === 'flashcard') {
      State.fcFlipped = false;
    }

    renderAll();
  }

  // ==========================================
  // 7. 手机扫码与分享弹窗
  // ==========================================
  let qrCodeInstance = null;
  const PUBLIC_APP_URL = "https://guntersun.github.io/us-citizenship-128/";

  function setupQRCodeModal() {
    const modal = document.getElementById('share-modal');
    const openBtn = document.getElementById('btn-open-share');
    const closeBtn = document.getElementById('btn-close-share');
    const qrContainer = document.getElementById('qrcode-render-target');
    const publicUrlDisplay = document.getElementById('public-url-display');
    const lanUrlDisplay = document.getElementById('lan-url-display');
    const copyBtn = document.getElementById('btn-copy-public-link');

    if (!modal) return;

    function renderRealQRCode() {
      // 优先使用公网永久 HTTPS 网址，保证任何手机只要扫码就能直接打开
      const targetUrl = PUBLIC_APP_URL;
      if (publicUrlDisplay) publicUrlDisplay.innerText = targetUrl;
      if (lanUrlDisplay && window.location.hostname !== 'guntersun.github.io') {
        lanUrlDisplay.innerText = window.location.href;
      }

      if (qrContainer) {
        qrContainer.innerHTML = ''; // 清除旧图
        if (typeof QRCode !== 'undefined') {
          qrCodeInstance = new QRCode(qrContainer, {
            text: targetUrl,
            width: 200,
            height: 200,
            colorDark: "#0F172A",
            colorLight: "#FFFFFF",
            correctLevel: QRCode.CorrectLevel.M
          });
        } else {
          // Fallback image using quickchart API
          qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(targetUrl)}" alt="QR Code" width="200" height="200" style="display:block; border-radius:6px;">`;
        }
      }
    }

    if (openBtn) {
      openBtn.addEventListener('click', () => {
        renderRealQRCode();
        modal.classList.add('open');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('open');
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(PUBLIC_APP_URL).then(() => {
          const originalText = copyBtn.innerHTML;
          copyBtn.innerHTML = '✅ 网址已成功复制到剪贴板！';
          copyBtn.style.color = 'var(--accent-green)';
          setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.style.color = '';
          }, 2500);
        }).catch(() => {
          prompt('请手动长按复制下方公网网址：', PUBLIC_APP_URL);
        });
      });
    }
  }

  // ==========================================
  // 8. 州官员定制弹窗
  // ==========================================
  function setupStateModal() {
    const modal = document.getElementById('state-modal');
    const openBtn = document.getElementById('btn-open-state-settings');
    const closeBtn = document.getElementById('btn-close-state-modal');
    const form = document.getElementById('state-settings-form');
    const presetSelect = document.getElementById('state-preset-select');

    if (!modal) return;

    if (openBtn) {
      openBtn.addEventListener('click', () => {
        document.getElementById('input-state-name').value = State.stateCustom.stateName;
        document.getElementById('input-state-senator').value = State.stateCustom.senator;
        document.getElementById('input-state-rep').value = State.stateCustom.representative;
        document.getElementById('input-state-gov').value = State.stateCustom.governor;
        document.getElementById('input-state-cap').value = State.stateCustom.capital;
        modal.classList.add('open');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (STATE_PRESETS[val]) {
          const p = STATE_PRESETS[val];
          document.getElementById('input-state-name').value = p.stateName;
          document.getElementById('input-state-senator').value = p.senator;
          document.getElementById('input-state-rep').value = p.representative;
          document.getElementById('input-state-gov').value = p.governor;
          document.getElementById('input-state-cap').value = p.capital;
        }
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        State.stateCustom = {
          stateName: document.getElementById('input-state-name').value.trim() || '本州',
          senator: document.getElementById('input-state-senator').value.trim() || '参议员',
          representative: document.getElementById('input-state-rep').value.trim() || '国会众议员',
          governor: document.getElementById('input-state-gov').value.trim() || '州长',
          capital: document.getElementById('input-state-cap').value.trim() || '首府'
        };
        applyStateCustomToQuestions();
        saveStorage();
        modal.classList.remove('open');
        renderAll();
        alert('州官员定制已保存！考题第 23、29、61、62 题已自动更新为您的所在州答案。');
      });
    }
  }

  // ==========================================
  // 9. 事件绑定 (Event Listeners)
  // ==========================================
  function bindEvents() {
    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });

    // 顶部分类筛选按钮
    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active', 'active-star'));
        if (btn.dataset.filter === 'starred') {
          btn.classList.add('active-star');
        } else {
          btn.classList.add('active');
        }
        State.filterCategory = btn.dataset.filter;
        renderAll();
      });
    });

    // 搜索输入
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        State.searchQuery = e.target.value;
        if (searchClear) searchClear.classList.toggle('show', State.searchQuery.length > 0);
        renderAll();
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        State.searchQuery = '';
        searchClear.classList.remove('show');
        renderAll();
      });
    }

    // 隐藏中文翻译开关
    const hideZhChk = document.getElementById('toggle-hide-chinese');
    if (hideZhChk) {
      hideZhChk.addEventListener('change', (e) => {
        State.hideChinese = e.target.checked;
        document.body.classList.toggle('hide-chinese', State.hideChinese);
        saveStorage();
      });
    }

    // 长辈大字体关爱模式
    const seniorChk = document.getElementById('toggle-senior-mode');
    if (seniorChk) {
      seniorChk.addEventListener('change', (e) => {
        State.seniorMode = e.target.checked;
        document.body.classList.toggle('senior-mode', State.seniorMode);
        saveStorage();
      });
    }

    // 全局列表与卡片点击委托
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const id = parseInt(target.dataset.id, 10);
      const q = State.allQuestions.find(item => item.id === id);

      if (action === 'speak-q' && q) {
        speakText(q.questionEn, 'en');
      } else if (action === 'speak-a' && q) {
        speakText(q.answerEn, 'en');
      } else if (action === 'toggle-bookmark' && q) {
        if (State.bookmarks.has(q.id)) {
          State.bookmarks.delete(q.id);
        } else {
          State.bookmarks.add(q.id);
        }
        saveStorage();
        renderAll();
      } else if (action === 'toggle-mastered' && q) {
        if (State.mastered.has(q.id)) {
          State.mastered.delete(q.id);
        } else {
          State.mastered.add(q.id);
        }
        saveStorage();
        renderAll();
      } else if (action === 'remove-mistake' && q) {
        State.mistakes.delete(q.id);
        saveStorage();
        renderAll();
      }
    });

    // 抽认卡交互
    const fcInner = document.getElementById('flashcard-inner');
    if (fcInner) {
      fcInner.addEventListener('click', () => {
        State.fcFlipped = !State.fcFlipped;
        fcInner.classList.toggle('is-flipped', State.fcFlipped);
      });
    }

    const btnFcEasy = document.getElementById('btn-fc-easy');
    if (btnFcEasy) {
      btnFcEasy.addEventListener('click', () => {
        const list = getFilteredQuestions();
        if (list[State.fcIndex]) {
          State.mastered.add(list[State.fcIndex].id);
          saveStorage();
        }
        advanceFlashcard(1);
      });
    }

    const btnFcHard = document.getElementById('btn-fc-hard');
    if (btnFcHard) {
      btnFcHard.addEventListener('click', () => {
        const list = getFilteredQuestions();
        if (list[State.fcIndex]) {
          State.mistakes.add(list[State.fcIndex].id);
          saveStorage();
        }
        advanceFlashcard(1);
      });
    }

    const btnFcPrev = document.getElementById('btn-fc-prev');
    if (btnFcPrev) {
      btnFcPrev.addEventListener('click', () => advanceFlashcard(-1));
    }

    const btnFcNext = document.getElementById('btn-fc-next');
    if (btnFcNext) {
      btnFcNext.addEventListener('click', () => advanceFlashcard(1));
    }

    const btnFcShuffle = document.getElementById('btn-fc-shuffle');
    if (btnFcShuffle) {
      btnFcShuffle.addEventListener('click', () => {
        State.fcIndex = Math.floor(Math.random() * getFilteredQuestions().length);
        State.fcFlipped = false;
        renderFlashcardView();
      });
    }

    // 底部播放器交互
    const playerPlayBtn = document.getElementById('player-play-btn');
    if (playerPlayBtn) {
      playerPlayBtn.addEventListener('click', () => {
        if (State.isPlayingContinuous) {
          stopAllSpeech();
        } else {
          startContinuousPlay(State.currentAudioIndex);
        }
      });
    }

    const playerNextBtn = document.getElementById('player-next-btn');
    if (playerNextBtn) {
      playerNextBtn.addEventListener('click', () => {
        if (State.isPlayingContinuous) {
          synth.cancel();
          State.audioPhase = 0;
          State.currentAudioIndex = (State.currentAudioIndex + 1) % State.audioQueue.length;
          playNextContinuousSegment();
        } else {
          State.currentAudioIndex = (State.currentAudioIndex + 1) % State.allQuestions.length;
          updatePlayerUI();
        }
      });
    }

    const playerPrevBtn = document.getElementById('player-prev-btn');
    if (playerPrevBtn) {
      playerPrevBtn.addEventListener('click', () => {
        if (State.isPlayingContinuous) {
          synth.cancel();
          State.audioPhase = 0;
          State.currentAudioIndex = (State.currentAudioIndex - 1 + State.audioQueue.length) % State.audioQueue.length;
          playNextContinuousSegment();
        } else {
          State.currentAudioIndex = (State.currentAudioIndex - 1 + State.allQuestions.length) % State.allQuestions.length;
          updatePlayerUI();
        }
      });
    }

    const playerSpeedBtn = document.getElementById('player-speed-btn');
    if (playerSpeedBtn) {
      playerSpeedBtn.addEventListener('click', () => {
        if (State.audioRate === 0.9) State.audioRate = 1.0;
        else if (State.audioRate === 1.0) State.audioRate = 0.75; // 慢速
        else if (State.audioRate === 0.75) State.audioRate = 1.25; // 快速
        else State.audioRate = 0.9;
        playerSpeedBtn.innerText = `${State.audioRate}x`;
      });
    }

    // 全真模考按钮与交互
    const btnExamStandard = document.getElementById('btn-exam-mode-standard');
    const btnExamSenior = document.getElementById('btn-exam-mode-senior');
    const btnStartExam = document.getElementById('btn-start-exam-action');

    let selectedExamType = 'standard';
    if (btnExamStandard && btnExamSenior) {
      btnExamStandard.addEventListener('click', () => {
        selectedExamType = 'standard';
        btnExamStandard.classList.add('selected');
        btnExamSenior.classList.remove('selected');
      });
      btnExamSenior.addEventListener('click', () => {
        selectedExamType = 'senior';
        btnExamSenior.classList.add('selected');
        btnExamStandard.classList.remove('selected');
      });
    }

    if (btnStartExam) {
      btnStartExam.addEventListener('click', () => {
        startExam(selectedExamType);
      });
    }

    const btnExamSpeakQ = document.getElementById('btn-exam-repeat-q');
    if (btnExamSpeakQ) {
      btnExamSpeakQ.addEventListener('click', () => {
        const q = State.exam.questions[State.exam.currentIndex];
        if (q) speakText(`Question. ${q.questionEn}`, 'en');
      });
    }

    const btnExamReveal = document.getElementById('btn-exam-reveal-ans');
    if (btnExamReveal) {
      btnExamReveal.addEventListener('click', () => {
        const ansReveal = document.getElementById('exam-answer-reveal');
        if (ansReveal) {
          ansReveal.classList.toggle('show');
          const q = State.exam.questions[State.exam.currentIndex];
          if (q && ansReveal.classList.contains('show')) {
            speakText(`Answer: ${q.answerEn}`, 'en');
          }
        }
      });
    }

    const btnExamCorrect = document.getElementById('btn-exam-mark-correct');
    if (btnExamCorrect) {
      btnExamCorrect.addEventListener('click', () => handleExamAnswer(true));
    }

    const btnExamWrong = document.getElementById('btn-exam-mark-wrong');
    if (btnExamWrong) {
      btnExamWrong.addEventListener('click', () => handleExamAnswer(false));
    }

    setupStateModal();
  }

  function advanceFlashcard(delta) {
    const list = getFilteredQuestions();
    if (list.length === 0) return;
    State.fcIndex = (State.fcIndex + delta + list.length) % list.length;
    State.fcFlipped = false;
    renderFlashcardView();
  }

  // PWA Service Worker 注册
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('USCIS 128 PWA ServiceWorker registered with scope: ', reg.scope);
      }).catch(err => {
        console.log('USCIS 128 PWA ServiceWorker registration failed: ', err);
      });
    });
  }

  // 页面加载完成后启动
  document.addEventListener('DOMContentLoaded', init);

})();
