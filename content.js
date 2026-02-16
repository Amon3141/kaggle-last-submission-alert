console.log("Kaggle 残り提出回数警告拡張機能が読み込まれました");

// ========================
// Constants
// ========================
const WARNING_MESSAGES = new Map([
  [0, '🚫 提出回数終了！己の計画性の無さを呪え！ 🚫'],
  [1, '⚠️ 今日の提出は残り1回です！ ⚠️'],
]);

const CONFIRMATION_POPUP_TRIGGER_COUNT = 1;
const CONFIRMATION_POPUP_MESSAGE = "今日の提出は残り一回です。\n本当に提出して良いですか？";

// ========================
// State
// ========================
let warningInserted = false;
let submitButtonHooked = false;
let cachedRemainingCount = null;

// ========================
// Helpers
// ========================

// 提出回数テキスト要素を見つける
function findSubmissionCountElement() {
  const xpath = "//p[contains(text(), 'submissions remaining today') or contains(text(), 'submission remaining today')]";
  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue;
}

// Drag and dropエリアを見つける
function findDragDropArea() {
  // 方法1: file inputから探す
  const fileInput = document.querySelector('input[type="file"][placeholder*="Drag and drop"]');
  if (fileInput) {
    const container = fileInput.closest('[role="presentation"]');
    if (container) return container.parentElement;
    return fileInput.parentElement;
  }
  
  // 方法2: テキストから探す
  const allElements = document.querySelectorAll('p');
  for (const el of allElements) {
    if (el.textContent.includes('Drag and drop file to upload')) {
      return el.parentElement;
    }
  }
  return null;
}

// 提出サイドパネルを見つける
function findSubmissionDrawer() {
  const drawers = document.querySelectorAll('[class*="MuiDrawer-paper"]');
  for (const drawer of drawers) {
    if (drawer.textContent.includes("Submit to Competition")) {
      return drawer;
    }
  }
  return null;
}

// Submitボタンを見つける
function findSubmitButton() {
  const drawer = findSubmissionDrawer();
  if (!drawer) return null;
  
  // 方法1: テキストから探す
  const buttons = drawer.querySelectorAll('button[role="button"]');
  for (const btn of buttons) {
    if (btn.textContent.trim() === 'Submit') {
      return btn;
    }
  }
  
  // 方法2: aria-labelから探す
  const btnByLabel = drawer.querySelector('button[aria-label="Submit"]');
  if (btnByLabel) return btnByLabel;

  return null;
}

// ========================
// Core Logic
// ========================

// 提出回数テキストから残り回数を抽出する
function parseRemainingCount() {
  const countElement = findSubmissionCountElement();
  if (!countElement) return null;

  const match = countElement.textContent.match(/You have (\d+) submissions? remaining today/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

// 残り回数を取得（キャッシュ付き）
function getRemainingCount(forceRefresh = false) {
  if (!forceRefresh && cachedRemainingCount !== null) {
    return cachedRemainingCount;
  }
  cachedRemainingCount = parseRemainingCount();
  return cachedRemainingCount;
}

// 警告を表示する
function showWarning(dragDropArea, message) {
  const existingWarning = document.querySelector('.kaggle-last-sub-warning');
  
  // 既存の警告があればメッセージを更新
  if (existingWarning) {
    if (existingWarning.textContent !== message) {
      existingWarning.textContent = message;
    }
    return;
  }

  // 新しい警告を作成して挿入
  const warningDiv = document.createElement('div');
  warningDiv.className = 'kaggle-last-sub-warning';
  warningDiv.textContent = message;
  
  if (dragDropArea && dragDropArea.parentNode) {
    dragDropArea.parentNode.insertBefore(warningDiv, dragDropArea);
    warningInserted = true;
    console.log("警告を挿入しました");
  }
}

// 警告を削除する
function removeWarning() {
  const existingWarning = document.querySelector('.kaggle-last-sub-warning');
  if (existingWarning) {
    existingWarning.remove();
    warningInserted = false;
  }
}

// 提出回数をチェックして警告を出すメインロジック
function checkAndWarn() {
  const remainingCount = getRemainingCount(true);
  if (remainingCount === null) return;

  console.log(`残り提出回数: ${remainingCount}`);

  // 警告表示の処理
  if (WARNING_MESSAGES.has(remainingCount)) {
    const dragDropArea = findDragDropArea();
    if (!dragDropArea) {
      console.log("ドラッグ＆ドロップエリアが見つかりませんでした");
    } else {
      const message = WARNING_MESSAGES.get(remainingCount);
      showWarning(dragDropArea, message);
    }
  } else {
    removeWarning();
  }

  // 確認ポップアップの処理（警告表示とは独立）
  if (remainingCount === CONFIRMATION_POPUP_TRIGGER_COUNT) {
    hookSubmitButton();
  }
}

// Submitボタンに確認ポップアップを追加する
function hookSubmitButton() {
  if (submitButtonHooked) return;

  const submitBtn = findSubmitButton();
  if (!submitBtn) return;

  // captureフェーズでイベントを捕捉
  submitBtn.addEventListener('click', function(e) {
    if (!confirm(CONFIRMATION_POPUP_MESSAGE)) {
      e.preventDefault();
      e.stopPropagation();
      console.log("ユーザーにより提出がキャンセルされました");
      return false;
    }
  }, true);

  submitButtonHooked = true;
  console.log("Submitボタンをフックしました");
}

// 状態をリセットする
function resetState() {
  warningInserted = false;
  submitButtonHooked = false;
  cachedRemainingCount = null;
}

// ========================
// Initialization
// ========================

// DOM変更を監視して警告を更新
const observer = new MutationObserver(() => {
  const drawer = findSubmissionDrawer();
  
  if (drawer) {
    checkAndWarn();
  } else {
    // ドロワーが閉じたら状態をリセット
    resetState();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 初回実行
checkAndWarn();
