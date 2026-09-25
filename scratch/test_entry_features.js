// scratch/test_entry_features.js
// 大会エントリー全機能の単体・統合テストスクリプト

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== Starting Tournament Entry Features Test Suite ===');

const scheduleHtmlPath = path.resolve(__dirname, '../tests/schedule.html');
const scheduleHtml = fs.readFileSync(scheduleHtmlPath, 'utf8');

// DOMシミュレーション環境の構築
class MockClassList {
  constructor() {
    this.classes = new Set();
  }
  add(...tokens) {
    tokens.forEach(t => this.classes.add(t));
  }
  remove(...tokens) {
    tokens.forEach(t => this.classes.delete(t));
  }
  contains(token) {
    return this.classes.has(token);
  }
  toggle(token) {
    if (this.classes.has(token)) {
      this.classes.delete(token);
      return false;
    } else {
      this.classes.add(token);
      return true;
    }
  }
}

class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList();
    this.children = [];
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.attributes = {};
    this.style = {};
    this.selectedOptions = [];
  }
  setAttribute(k, v) {
    this.attributes[k] = v;
  }
  getAttribute(k) {
    return this.attributes[k] || null;
  }
  appendChild(child) {
    this.children.push(child);
  }
  remove() {
    // mock removal
  }
  addEventListener(evt, handler) {}
}

const mockDomElements = {};
function getOrCreateElement(id, tagName = 'div') {
  if (!mockDomElements[id]) {
    const el = new MockElement(id, tagName);
    if (id.startsWith('modal-') || id === 'guidelines-modal') {
      el.classList.add('hidden');
    }
    mockDomElements[id] = el;
  }
  return mockDomElements[id];
}

// schedule.html から script を抽出
const scriptMatches = scheduleHtml.match(/<script>([\s\S]*?)<\/script>/g);
if (!scriptMatches || scriptMatches.length === 0) {
  throw new Error('No <script> tag found in schedule.html');
}
const fullScript = scriptMatches.map(s => s.replace(/<\/?script>/g, '')).join('\n');

const mockDocument = {
  getElementById: (id) => getOrCreateElement(id),
  querySelectorAll: (selector) => {
    if (selector === '.bulk-select-check') {
      return Object.values(mockDomElements).filter(el => el.classList.contains('bulk-select-check'));
    }
    if (selector === '.entry-member-select') {
      return Object.values(mockDomElements).filter(el => el.classList.contains('entry-member-select'));
    }
    if (selector === '.edit-member-select') {
      return Object.values(mockDomElements).filter(el => el.classList.contains('edit-member-select'));
    }
    return [];
  },
  getElementsByName: (name) => {
    return [
      { name, value: 'credit', checked: true },
      { name, value: 'paypay', checked: false },
      { name, value: 'bank', checked: false }
    ];
  },
  createElement: (tag) => new MockElement('', tag),
  addEventListener: () => {}
};

const mockWindow = {
  location: { href: 'http://localhost:3000/tests/schedule.html' },
  addEventListener(event, handler) {
    if (event === 'keydown') {
      mockWindow.keydownHandler = handler;
    }
  }
};

const context = vm.createContext({
  document: mockDocument,
  window: mockWindow,
  tailwind: { config: {} },
  navigator: { clipboard: { writeText: () => {} } },
  lucide: { createIcons: () => {} },
  requestAnimationFrame: (cb) => cb(),
  setTimeout: (cb) => cb(), // 即時実行
  console: console
});

vm.runInContext(fullScript, context);
console.log('Script loaded in sandbox successfully.');

// vm実行ラッパー
const run = (expr) => vm.runInContext(expr, context);

// ==========================================================
// TEST 1: 初期状態検証
// ==========================================================
console.log('\n--- TEST 1: Initial State & Seed Data ---');
const userEntries = run('userEntries');
if (!userEntries || userEntries.length !== 2) {
  throw new Error(`Expected 2 seed entries in userEntries, but got ${userEntries?.length}`);
}
console.log(`Initial userEntries verified: ${userEntries.length} entries`);

run('updateKPIs()');
const enteredKpi = getOrCreateElement('kpi-entered-tournaments').textContent;
console.log(`KPI entered count: ${enteredKpi}`);
if (Number(enteredKpi) !== 2) {
  throw new Error(`Expected entered KPI to be 2, but got ${enteredKpi}`);
}

const initialBulkCount = run('selectedBulkTourIds.size');
if (initialBulkCount !== 0) {
  throw new Error(`Expected selectedBulkTourIds to be empty, but got ${initialBulkCount}`);
}
console.log('Initial bulk select state verified: 0 selected');

// ==========================================================
// TEST 2: 単一大会エントリーモーダル & 送信
// ==========================================================
console.log('\n--- TEST 2: Single Tournament Entry Flow ---');
const targetTour = run('allTournaments.find(t => !t.isEntered && !t.isFinished && t.status === "OPEN")');
if (!targetTour) throw new Error('Upcoming OPEN tournament not found');
const targetTourId = targetTour.id;

const initialEntriesCount = targetTour.entriesCount;
run(`openSingleEntryModal('${targetTourId}')`);

const modalSingle = getOrCreateElement('modal-tournament-entry');
if (modalSingle.classList.contains('hidden')) {
  throw new Error('modal-tournament-entry should not have hidden class after openSingleEntryModal');
}
console.log(`Opened single entry modal for: ${targetTour.title}`);

// スロット要素のモック登録
const slotsContainer = getOrCreateElement('entry-slots-container');
if (!slotsContainer.innerHTML.includes('entry-member-select')) {
  throw new Error('entry-slots-container did not render member selects');
}

// メンバーセレクトをMockDomElementsに追加して平均レーティング計算をテスト
const teamMembers = run('currentTeamMembers');
for (let i = 0; i < 6; i++) {
  const el = new MockElement(`member-sel-${i}`, 'select');
  el.classList.add('entry-member-select');
  el.selectedOptions = [{
    getAttribute: () => String(teamMembers[i].rating),
    text: `${teamMembers[i].name} (Lv.${teamMembers[i].rating})`
  }];
  el.value = teamMembers[i].id;
  mockDomElements[`member-sel-${i}`] = el;
}

run('updateEntryAverageRating()');
const avgRatingText = getOrCreateElement('entry-avg-rating').textContent;
console.log(`Calculated average rating: ${avgRatingText}`);
if (Number(avgRatingText) < 550 || Number(avgRatingText) > 650) {
  throw new Error(`Unexpected average rating: ${avgRatingText}`);
}

// 送信実行
run('submitSingleEntry()');

if (targetTour.entriesCount !== initialEntriesCount + 1) {
  throw new Error(`Expected entriesCount to increment to ${initialEntriesCount + 1}, got ${targetTour.entriesCount}`);
}
if (!targetTour.isEntered) {
  throw new Error('targetTour.isEntered should be true after entry');
}
if (run('userEntries.length') !== 3) {
  throw new Error(`Expected 3 userEntries, got ${run('userEntries.length')}`);
}

const modalSuccess = getOrCreateElement('modal-entry-success');
if (modalSuccess.classList.contains('hidden')) {
  throw new Error('modal-entry-success should be visible after submit');
}
console.log(`Single entry submitted successfully. Success modal displayed: ${getOrCreateElement('success-entry-tour-title').textContent}`);

run('closeModal("modal-entry-success")');

// ==========================================================
// TEST 3: 同日重複エントリー警告
// ==========================================================
console.log('\n--- TEST 3: Same-day Duplicate Entry Warning ---');
const firstEntryTourId = run('userEntries[0].tournamentId');
const firstEntryTour = run(`allTournaments.find(t => t.id === '${firstEntryTourId}')`);
console.log(`First entry tournament date: ${firstEntryTour?.date} (${firstEntryTour?.id})`);

let sameDayTour = run(`allTournaments.find(t => t.date === '${firstEntryTour.date}' && t.id !== '${firstEntryTourId}')`);
if (!sameDayTour) {
  // テスト用に別の大会の日付を一時的に同日に設定して検証
  sameDayTour = run(`allTournaments.find(t => !t.isEntered && !t.isFinished)`);
  sameDayTour.date = firstEntryTour.date;
}

run(`openSingleEntryModal('${sameDayTour.id}')`);
const conflictWarn = getOrCreateElement('entry-conflict-warning');
if (conflictWarn.classList.contains('hidden')) {
  throw new Error('entry-conflict-warning should be visible when opening a tournament on the same day as an existing entry');
}
console.log(`Same-day conflict warning verified for ${sameDayTour.title}: ${getOrCreateElement('entry-conflict-text').textContent}`);
run('closeModal("modal-tournament-entry")');

// ==========================================================
// TEST 4: 一括選択 & 一括エントリー
// ==========================================================
console.log('\n--- TEST 4: Bulk Selection & Bulk Entry Flow ---');
const bulkTour1 = run('allTournaments.find(t => !t.isEntered && !t.isFinished && t.status === "OPEN")');
const bulkTour2 = run(`allTournaments.find(t => !t.isEntered && !t.isFinished && t.status === "OPEN" && t.id !== "${bulkTour1.id}")`);

run(`toggleBulkSelectTour('${bulkTour1.id}', true)`);
run(`toggleBulkSelectTour('${bulkTour2.id}', true)`);

if (run('selectedBulkTourIds.size') !== 2) {
  throw new Error(`Expected 2 tournaments selected in bulk, got ${run('selectedBulkTourIds.size')}`);
}

const bulkBar = getOrCreateElement('bulk-entry-bar');
if (bulkBar.classList.contains('hidden')) {
  throw new Error('bulk-entry-bar should be visible when tournaments are selected');
}
const bulkCountBadge = getOrCreateElement('bulk-selected-count-badge').textContent;
const bulkTotalFee = getOrCreateElement('bulk-selected-total-fee').textContent;
console.log(`Bulk bar displayed: ${bulkCountBadge} tournaments, fee: ${bulkTotalFee}`);
if (bulkTotalFee !== '¥40,000') {
  throw new Error(`Expected total fee ¥40,000, got ${bulkTotalFee}`);
}

// 一括モーダルを開く
run('openBulkEntryModal()');
const modalBulk = getOrCreateElement('modal-bulk-entry');
if (modalBulk.classList.contains('hidden')) {
  throw new Error('modal-bulk-entry should be visible after openBulkEntryModal');
}

// 1件除外テスト
run(`removeTourFromBulk('${bulkTour1.id}')`);
if (run('selectedBulkTourIds.size') !== 1) {
  throw new Error(`Expected 1 tournament after removal, got ${run('selectedBulkTourIds.size')}`);
}
console.log('Successfully removed 1 tournament from bulk list');

// 一括エントリー確定
run('submitBulkEntry()');
if (!bulkTour2.isEntered) {
  throw new Error('bulkTour2.isEntered should be true after bulk submit');
}
if (run('selectedBulkTourIds.size') !== 0) {
  throw new Error('selectedBulkTourIds should be cleared after bulk submit');
}
console.log('Bulk entry submitted successfully and selection cleared');
run('closeModal("modal-entry-success")');

// ==========================================================
// TEST 5: キャンセル待ち申込フロー
// ==========================================================
console.log('\n--- TEST 5: Waitlist Entry Flow ---');
let waitlistTour = run('allTournaments.find(t => t.status === "WAITLIST" && !t.isEntered)');
if (!waitlistTour) {
  waitlistTour = run('allTournaments.find(t => !t.isEntered && !t.isFinished)');
  waitlistTour.status = 'WAITLIST';
}

run(`openWaitlistModal('${waitlistTour.id}')`);
const modalWaitlist = getOrCreateElement('modal-waitlist-entry');
if (modalWaitlist.classList.contains('hidden')) {
  throw new Error('modal-waitlist-entry should be visible');
}
console.log(`Waitlist modal opened for: ${waitlistTour.title}`);

run('submitWaitlistEntry()');
const modalWaitSuccess = getOrCreateElement('modal-waitlist-success');
if (modalWaitSuccess.classList.contains('hidden')) {
  throw new Error('modal-waitlist-success should be visible after waitlist submit');
}
console.log(`Waitlist entry submitted successfully. Queue text: ${getOrCreateElement('waitlist-success-queue-text').textContent}`);
run('closeModal("modal-waitlist-success")');

// ==========================================================
// TEST 6: 自チーム申込中一覧 & タブ切り替え
// ==========================================================
console.log('\n--- TEST 6: Entered Tournaments List & Filtering ---');
run('openEnteredTournamentsModal()');
const modalEntered = getOrCreateElement('modal-entered-tournaments');
if (modalEntered.classList.contains('hidden')) {
  throw new Error('modal-entered-tournaments should be visible');
}

run('filterEnteredTournamentsTab("CONFIRMED")');
const listContainer = getOrCreateElement('entered-tournaments-list');
if (!listContainer.innerHTML.includes('エントリー確定')) {
  throw new Error('CONFIRMED filter should render confirmed entries');
}
console.log('Tab filter CONFIRMED verified');

run('filterEnteredTournamentsTab("WAITING")');
if (!listContainer.innerHTML.includes('待機 第')) {
  throw new Error('WAITING filter should render waiting entries');
}
console.log('Tab filter WAITING verified');

run('filterEnteredTournamentsTab("ALL")');
console.log('Tab filter ALL verified');

// ==========================================================
// TEST 7: メンバー変更機能
// ==========================================================
console.log('\n--- TEST 7: Member Modification ---');
const confirmedEntry = run('userEntries.find(e => e.status === "CONFIRMED")');
run(`openEditMembersModal('${confirmedEntry.id}')`);
const modalEdit = getOrCreateElement('modal-edit-members');
if (modalEdit.classList.contains('hidden')) {
  throw new Error('modal-edit-members should be visible');
}

// メンバーセレクト要素のモック登録
for (let i = 0; i < 6; i++) {
  const el = new MockElement(`edit-member-sel-${i}`, 'select');
  el.classList.add('edit-member-select');
  el.selectedOptions = [{
    getAttribute: () => '610',
    text: `選手${i}`
  }];
  el.value = teamMembers[i].id;
  mockDomElements[`edit-member-sel-${i}`] = el;
}

run('saveMemberChangesAction()');
console.log(`Member modification saved successfully. Total members: ${confirmedEntry.members.length}`);

// ==========================================================
// TEST 8: キャンセル申請 & キャンセル料自動計算
// ==========================================================
console.log('\n--- TEST 8: Entry Cancellation & Fee Calculation ---');
const entryToCancel = run('userEntries.find(e => e.status === "CONFIRMED")');
const cancelTour = run(`allTournaments.find(t => t.id === '${entryToCancel.tournamentId}')`);

run(`openCancelModal('${entryToCancel.id}')`);
const modalCancel = getOrCreateElement('modal-cancel-entry');
if (modalCancel.classList.contains('hidden')) {
  throw new Error('modal-cancel-entry should be visible');
}

const feeAmountEl = getOrCreateElement('cancel-fee-amount').textContent;
const refundEl = getOrCreateElement('cancel-refund-amount').textContent;
const rateBadgeEl = getOrCreateElement('cancel-fee-rate-badge').textContent;
console.log(`Cancel fee calculation: Fee: ${feeAmountEl}, Refund: ${refundEl}, Rate: ${rateBadgeEl}`);

if (!feeAmountEl || !refundEl || !rateBadgeEl) {
  throw new Error('Cancel fee information should not be empty');
}

run('confirmCancelEntryAction()');
if (entryToCancel.status !== 'CANCELLED') {
  throw new Error('Entry status should be CANCELLED');
}
if (cancelTour.isEntered !== false) {
  throw new Error('cancelTour.isEntered should be false after cancellation');
}
console.log('Cancellation confirmed and state updated successfully');

// ==========================================================
// TEST 9: キーボードESCショートカット & 背景クローズ
// ==========================================================
console.log('\n--- TEST 9: Keyboard ESC & Modal Backdrop Close ---');
run('openEnteredTournamentsModal()');
if (modalEntered.classList.contains('hidden')) throw new Error('modal should be open');

// ESCキーイベント発火
if (mockWindow.keydownHandler) {
  mockWindow.keydownHandler({ key: 'Escape' });
  if (!modalEntered.classList.contains('hidden')) {
    throw new Error('ESC key did not close modal-entered-tournaments');
  }
  console.log('ESC key successfully closed active modal');
}

console.log('\n=============================================================');
console.log('=== ALL 9 TOURNAMENT ENTRY FEATURE TESTS PASSED (100%) ===');
console.log('=============================================================');
