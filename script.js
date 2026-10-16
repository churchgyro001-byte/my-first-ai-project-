'use strict';

(() => {
  const STORAGE_KEY = 'wealthquest.progress.v1';
  const LEVELS = [
    { level: 1, title: 'Financial Novice', minimum: 0, next: 300, description: 'Every great journey starts with a small saving.' },
    { level: 2, title: 'Budget Warrior', minimum: 300, next: 700, description: 'Good habits are becoming your superpower.' },
    { level: 3, title: 'Wealth Tycoon', minimum: 700, next: null, description: 'A master of money moves. Keep building your legacy.' }
  ];
  const QUESTS = {
    lunch: { title: 'Pack Your Lunch Challenge', xp: 100, money: 15 },
    weekend: { title: 'The 3-Day No-Spend Weekend Quest', xp: 500, money: 100 },
    subscription: { title: 'Unsubscribe from a Dead Streaming Service', xp: 250, money: 0 }
  };
  const $ = id => document.getElementById(id);
  const emptyActivity = $('activity-list').firstElementChild.cloneNode(true);
  const money = amount => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  const number = value => new Intl.NumberFormat('en-US').format(value);
  const initialState = () => ({ xp: 0, balance: 1000, streak: 0, shield: false, completedQuests: [], highestLevel: 1, history: [], sound: false });
  let storageAvailable = true;
  let audioContext;

  // Accept only the data shape this version understands; never trust saved markup.
  function loadState() {
    const fallback = initialState();
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!stored || typeof stored !== 'object') return fallback;
      for (const key of ['xp', 'balance', 'streak']) {
        if (Number.isSafeInteger(stored[key]) && stored[key] >= 0) fallback[key] = stored[key];
      }
      fallback.shield = stored.shield === true;
      fallback.sound = stored.sound === true;
      fallback.completedQuests = [...new Set(Array.isArray(stored.completedQuests) ? stored.completedQuests.filter(id => Object.hasOwn(QUESTS, id)) : [])];
      fallback.highestLevel = Math.max(getLevel(fallback.xp).level, [1, 2, 3].includes(stored.highestLevel) ? stored.highestLevel : 1);
      fallback.history = Array.isArray(stored.history) ? stored.history.filter(item =>
        item && typeof item.title === 'string' && item.title.length <= 150 &&
        Number.isSafeInteger(item.xp) && Number.isSafeInteger(item.money) &&
        Number.isFinite(item.timestamp) && item.timestamp >= 0 && item.timestamp <= Date.now() &&
        ['saving', 'buy', 'invest', 'quest'].includes(item.type)
      ).slice(0, 5) : [];
      return fallback;
    } catch {
      return fallback;
    }
  }

  function getLevel(xp) {
    return [...LEVELS].reverse().find(level => xp >= level.minimum);
  }

  let state = loadState();

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
    const label = document.querySelector('.local-save');
    label.lastChild.textContent = storageAvailable ? 'Progress saved locally' : 'Progress saved for this visit';
  }

  function animateCounter(id) {
    const element = $(id);
    element.classList.remove('counter-bump');
    void element.offsetWidth;
    element.classList.add('counter-bump');
  }

  function updateBadge(id, unlocked, statusId, lockedText) {
    const badge = $(id);
    if (badge.classList.contains('locked') === unlocked) badge.classList.toggle('locked', !unlocked);
    $(statusId).textContent = unlocked ? 'Unlocked · yours forever' : lockedText;
  }

  function render() {
    const rank = getLevel(state.xp);
    $('level-chip').textContent = `LEVEL 0${rank.level}`;
    $('avatar-level').textContent = rank.level;
    $('hero-title').textContent = rank.title;
    $('rank-description').textContent = rank.description;
    $('xp-current').textContent = number(state.xp);
    $('xp-threshold').textContent = rank.next ? ` / ${rank.next} XP` : ' XP · MAX LEVEL';
    const progress = rank.next ? ((state.xp - rank.minimum) / (rank.next - rank.minimum)) * 100 : 100;
    $('xp-fill').style.width = `${progress}%`;
    $('xp-progress').setAttribute('aria-valuemax', rank.next ? rank.next - rank.minimum : 700);
    $('xp-progress').setAttribute('aria-valuenow', rank.next ? state.xp - rank.minimum : 700);
    $('xp-progress').setAttribute('aria-valuetext', rank.next ? `${state.xp} total XP. ${rank.next - state.xp} XP until ${LEVELS[rank.level].title}.` : `${state.xp} total XP. Maximum rank achieved.`);
    $('next-level-message').textContent = rank.next ? `${rank.next - state.xp} XP to ${LEVELS[rank.level].title}` : 'Maximum rank. Limitless potential.';
    $('xp-footer-level').firstChild.textContent = rank.next ? `LVL 0${rank.level + 1} ` : 'MAX RANK ';
    $('hero-shield').hidden = !state.shield;

    $('vault-balance').replaceChildren(document.createTextNode(money(state.balance)));
    const cents = document.createElement('span');
    cents.textContent = '.00';
    $('vault-balance').append(cents);
    $('streak-count').textContent = number(state.streak);
    $('streak-unit').textContent = state.streak === 1 ? 'Day' : 'Days';
    $('streak-message').textContent = state.streak ? 'Keep showing up. Your future is worth it.' : 'One good decision starts a streak.';
    [...$('streak-dots').children].forEach((dot, index) => dot.classList.toggle('filled', index < state.streak));

    const investButton = $('invest-button');
    investButton.disabled = state.shield || state.balance < 200;
    investButton.querySelector('span').textContent = state.shield ? 'Shield Protection Unlocked' : state.balance < 200 ? 'Requires $200 in Vault' : 'Invest in Emergency Fund';
    $('invest-description').textContent = state.shield ? 'Your $200 safety net is secured. Nicely done.' : state.balance < 200 ? 'Save a little more to build your safety net.' : 'Invest $200. Unlock your protection badge.';
    $('buy-button').disabled = state.balance < 50;
    $('buy-button').querySelector('span').textContent = state.balance < 50 ? 'Requires $50 in Vault' : 'Log an Impulse Buy';

    for (const id of Object.keys(QUESTS)) {
      const complete = state.completedQuests.includes(id);
      const checkbox = $(`quest-${id}`);
      checkbox.checked = complete;
      checkbox.disabled = complete;
      checkbox.closest('.quest-row').classList.toggle('completed', complete);
    }
    $('quest-completed').textContent = `${state.completedQuests.length} of 3`;
    $('nav-quest-count').textContent = 3 - state.completedQuests.length;
    [...$('quest-mini-progress').children].forEach((part, index) => part.classList.toggle('filled', index < state.completedQuests.length));
    updateBadge('badge-shield', state.shield, 'shield-status', 'Invest in your safety net');
    updateBadge('badge-warrior', state.highestLevel >= 2, 'warrior-status', 'Reach Level 2');
    updateBadge('badge-tycoon', state.highestLevel >= 3, 'tycoon-status', 'Reach Level 3');
    const badges = Number(state.shield) + Number(state.highestLevel >= 2) + Number(state.highestLevel >= 3);
    $('badge-count').textContent = badges ? `${badges} of 3 badges earned. Every one tells your story.` : 'Your first badge is just one good move away.';
    $('sound-toggle').setAttribute('aria-pressed', String(state.sound));
    $('sound-toggle').setAttribute('aria-label', state.sound ? 'Disable sound effects' : 'Enable sound effects');
    $('sound-toggle').title = state.sound ? 'Disable sound effects' : 'Enable sound effects';
    renderHistory();
  }

  function createIcon(symbol) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${symbol}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.append(use);
    return svg;
  }

  function renderHistory() {
    if (!state.history.length) {
      $('activity-list').replaceChildren(emptyActivity.cloneNode(true));
      return;
    }
    $('activity-list').replaceChildren();
    const icons = { saving: 'plus', buy: 'bag', invest: 'shield', quest: 'check' };
    for (const event of state.history) {
      const row = document.createElement('li');
      row.className = event.type === 'buy' ? 'negative' : 'positive';
      const icon = document.createElement('span');
      icon.className = 'activity-symbol';
      icon.append(createIcon(icons[event.type]));
      const description = document.createElement('span');
      description.textContent = event.title;
      const subtitle = document.createElement('small');
      subtitle.textContent = { saving: 'A little closer to your goals.', buy: 'A fresh start is always one move away.', invest: 'Your emergency fund is protected.', quest: 'Quest complete. Good habit unlocked.' }[event.type];
      description.append(subtitle);
      const reward = document.createElement('span');
      reward.className = 'activity-reward';
      reward.textContent = `${event.xp >= 0 ? '+' : '−'}${number(Math.abs(event.xp))} XP${event.money ? ` · ${event.money > 0 ? '+' : '−'}${money(Math.abs(event.money))}` : ''}`;
      const time = document.createElement('small');
      time.textContent = new Date(event.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      reward.append(time);
      row.append(icon, description, reward);
      $('activity-list').append(row);
    }
  }

  function toast(title, detail, type = 'success') {
    const element = document.createElement('div');
    element.className = `toast ${type}`;
    element.append(createIcon(type === 'error' ? 'bag' : type === 'level' ? 'trophy' : 'check'));
    const content = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const message = document.createElement('p');
    message.textContent = detail;
    content.append(heading, message);
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Dismiss notification');
    element.append(content, close);
    const dismiss = () => {
      clearTimeout(timer);
      element.classList.add('leaving');
      setTimeout(() => element.remove(), 250);
    };
    close.addEventListener('click', dismiss);
    $('toast-region').append(element);
    // Keep rapid clicks from covering the entire screen.
    while ($('toast-region').children.length > 3) $('toast-region').firstElementChild.remove();
    const timer = setTimeout(dismiss, 5200);
  }

  function playSound(kind = 'success') {
    if (!state.sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audioContext ||= new Audio();
      audioContext.resume().catch(() => {});
      const notes = kind === 'error' ? [220, 164.81] : kind === 'level' ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 783.99];
      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const start = audioContext.currentTime + index * .1;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(.055, start + .015);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .22);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(start);
        oscillator.stop(start + .23);
      });
    } catch { /* Audio support never blocks a money move. */ }
  }

  // A single transaction keeps XP, balances, achievements, history, and storage in sync.
  function commit({ title, xp, amount, type, mutate, notification, detail }) {
    const previousRank = getLevel(state.xp).level;
    const actualXP = Math.max(0, state.xp + xp) - state.xp;
    state.xp += actualXP;
    state.balance += amount;
    mutate?.();
    const rank = getLevel(state.xp);
    state.highestLevel = Math.max(state.highestLevel, rank.level);
    state.history.unshift({ title, xp: actualXP, money: amount, type, timestamp: Date.now() });
    state.history = state.history.slice(0, 5);
    persist();
    render();
    animateCounter('vault-balance');
    animateCounter('xp-current');
    toast(notification, detail, type === 'buy' ? 'error' : 'success');
    playSound(type === 'buy' ? 'error' : 'success');
    if (rank.level > previousRank) {
      toast(`Level ${rank.level} unlocked: ${rank.title}!`, 'New rank. New possibilities. Keep the momentum going.', 'level');
      playSound('level');
    } else if (rank.level < previousRank) {
      toast(`You're now a ${rank.title}`, 'Your earned badges stay with you. Save to climb back up.', 'level');
    }
  }

  function logSaving() {
    commit({ title: 'Daily saving logged', xp: 50, amount: 20, type: 'saving', mutate: () => state.streak++, notification: '+50 XP, +$20!', detail: 'A small saving. A stronger future. Streak +1!' });
  }

  function logImpulseBuy() {
    if (state.balance < 50) return toast('Your vault needs a little breathing room.', 'You need at least $50 to log this purchase.', 'error');
    commit({ title: 'Impulse purchase logged', xp: -100, amount: -50, type: 'buy', mutate: () => { state.streak = 0; }, notification: 'Impulse buying drains your power!', detail: '−$50 Vault · Up to −100 XP · Streak reset. You can bounce back.' });
    const flash = $('screen-flash');
    const shell = document.querySelector('.app-shell');
    flash.classList.remove('flash');
    shell.classList.remove('shake');
    void flash.offsetWidth;
    flash.classList.add('flash');
    shell.classList.add('shake');
    setTimeout(() => { flash.classList.remove('flash'); shell.classList.remove('shake'); }, 700);
  }

  function investEmergencyFund() {
    if (state.shield) return;
    if (state.balance < 200) return toast('A little more saving first.', 'You need $200 in your vault to invest.', 'error');
    commit({ title: 'Emergency fund secured', xp: 300, amount: -200, type: 'invest', mutate: () => { state.shield = true; }, notification: '+300 XP · Shield Protection unlocked!', detail: '$200 invested. Your protection badge is yours forever.' });
  }

  function completeQuest(id) {
    if (!Object.hasOwn(QUESTS, id) || state.completedQuests.includes(id)) return;
    const quest = QUESTS[id];
    commit({ title: quest.title, xp: quest.xp, amount: quest.money, type: 'quest', mutate: () => state.completedQuests.push(id), notification: `Quest complete! +${quest.xp} XP${quest.money ? `, +${money(quest.money)}` : ''}`, detail: quest.title });
  }

  $('save-button').addEventListener('click', logSaving);
  $('buy-button').addEventListener('click', logImpulseBuy);
  $('invest-button').addEventListener('click', investEmergencyFund);
  for (const id of Object.keys(QUESTS)) $(`quest-${id}`).addEventListener('change', event => { if (event.target.checked) completeQuest(id); });
  $('sound-toggle').addEventListener('click', () => {
    state.sound = !state.sound;
    persist();
    render();
    if (state.sound) playSound();
    toast(state.sound ? 'Sound effects on' : 'Sound effects off', state.sound ? 'A little celebration for your everyday wins.' : 'Quiet mode. Same great money moves.');
  });

  document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(item => { item.classList.remove('active'); item.removeAttribute('aria-current'); });
    link.classList.add('active');
    link.setAttribute('aria-current', 'location');
  }));
  document.querySelector('.nav-link.active').setAttribute('aria-current', 'location');
  // Keep other open WealthQuest tabs consistent without re-awarding rewards.
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) { state = loadState(); render(); }
  });

  persist();
  render();
})();
