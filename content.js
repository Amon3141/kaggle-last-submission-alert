// Kaggle Last Submission Warning Extension

console.log("Kaggle 残り提出回数警告拡張機能が読み込まれました");

let warningInserted = false;
let submitButtonHooked = false;

// 堅牢な要素検索ヘルパー関数

// 提出回数テキストを見つける
function findSubmissionCountElement() {
  // XPathでテキスト検索: "You have X submission(s) remaining today"
  // 大文字小文字を区別しないように translate を使用するか、単純に contains を使用
  const xpath = "//p[contains(text(), 'submissions remaining today') or contains(text(), 'submission remaining today')]";
  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue;
}

// Drag and dropエリアを見つける
function findDragDropArea() {
  // 方法1: placeholder属性から (input[type="file"])
  const fileInput = document.querySelector('input[type="file"][placeholder*="Drag and drop"]');
  if (fileInput) {
    // inputの親の親あたりにあるコンテナを探すのが一般的だが、
    // ここではinputの直近の視覚的なコンテナを探す
    // role="presentation" の親要素などが候補
    const container = fileInput.closest('[role="presentation"]');
    if (container) return container.parentElement;
    return fileInput.parentElement;
  }
  
  // 方法2: テキストコンテンツから "Drag and drop file to upload"
  const allElements = document.querySelectorAll('p');
  for (const el of allElements) {
    if (el.textContent.includes('Drag and drop file to upload')) {
      // テキストを含む要素の親要素を返す（レイアウトによるが、通常はこれでOK）
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
  // 提出サイドパネル内に限定するために、まずDrawerを探す
  const drawer = findSubmissionDrawer();
  if (!drawer) return null;
  
  // 方法1: role="button"かつテキストが"Submit"
  const buttons = drawer.querySelectorAll('button[role="button"]');
  for (const btn of buttons) {
    // テキストが完全一致、または "Submit" を含む
    if (btn.textContent.trim() === 'Submit') {
      return btn;
    }
  }
  
  // 方法2: aria-labelから
  const btnByLabel = drawer.querySelector('button[aria-label="Submit"]');
  if (btnByLabel) return btnByLabel;

  return null;
}

// 警告を表示する関数
function showWarning(dragDropArea, message) {
  // すでに警告があるかチェック
  const existingWarning = document.querySelector('.kaggle-last-sub-warning');
  if (existingWarning) {
    // メッセージが異なる場合は更新
    if (existingWarning.textContent !== message) {
      existingWarning.textContent = message;
    }
    return;
  }

  const warningDiv = document.createElement('div');
  warningDiv.className = 'kaggle-last-sub-warning';
  warningDiv.textContent = message;
  
  // Drag and Dropエリアの前に挿入
  if (dragDropArea && dragDropArea.parentNode) {
    dragDropArea.parentNode.insertBefore(warningDiv, dragDropArea);
    warningInserted = true;
    console.log("警告を挿入しました");
  }
}

// 提出回数をチェックして警告を出すメインロジック
function checkAndWarn() {
  const countElement = findSubmissionCountElement();
  if (!countElement) return;

  // テキストから数字を抽出: "You have 1 submission remaining today"
  const match = countElement.textContent.match(/You have (\d+) submissions? remaining today/i);
  if (match && match[1]) {
    const remainingCount = parseInt(match[1], 10);
    console.log(`残り提出回数: ${remainingCount}`);

    if (remainingCount === 1) {
      // 残り1回の場合
      const dragDropArea = findDragDropArea();
      if (dragDropArea) {
        showWarning(dragDropArea, '⚠️ 今日の提出は残り1回です！ ⚠️');
      } else {
        console.log("ドラッグ＆ドロップエリアが見つかりませんでした");
      }

      // Submitボタンをフック
      hookSubmitButton();
    } else if (remainingCount === 0) {
      // 残り0回の場合（煽り文）
      const dragDropArea = findDragDropArea();
      if (dragDropArea) {
        showWarning(dragDropArea, '🚫 提出回数終了！己の計画性の無さを呪え！ 🚫');
      } else {
        console.log("ドラッグ＆ドロップエリアが見つかりませんでした");
      }
      // 0回の場合はSubmitボタンは押せないはずなのでフック不要
    } else {
      // 残り1回でも0回でもない場合は警告を削除（もしあれば）
      const existingWarning = document.querySelector('.kaggle-last-sub-warning');
      if (existingWarning) {
        existingWarning.remove();
        warningInserted = false;
      }
    }
  }
}

// Submitボタンをフックする関数
function hookSubmitButton() {
  if (submitButtonHooked) return;

  const submitBtn = findSubmitButton();
  if (submitBtn) {
    // captureフェーズでイベントを捕捉して、stopPropagationできるようにする
    submitBtn.addEventListener('click', function(e) {
      const countElement = findSubmissionCountElement();
      if (countElement) {
        const match = countElement.textContent.match(/You have (\d+) submissions? remaining today/i);
        if (match && match[1] && parseInt(match[1], 10) === 1) {
          if (!confirm("今日の提出は残り一回です。\n本当に提出して良いですか？")) {
            e.preventDefault();
            e.stopPropagation();
            console.log("ユーザーにより提出がキャンセルされました");
            return false;
          }
        }
      }
    }, true); // useCapture = true

    submitButtonHooked = true;
    console.log("Submitボタンをフックしました");
  }
}

// MutationObserverの設定
// ページ全体の変更を監視するのは重いかもしれないが、KaggleはSPAなので必要
// パフォーマンスを考慮して、特定のコンテナが見つかったらそこを重点的に監視するなどの最適化も可能だが、
// 今回はシンプルに body を監視する
const observer = new MutationObserver((mutations) => {
  // 変更があったらチェックを実行
  // 頻繁に実行されすぎないようにthrottle/debounceを入れるのがベストだが、
  // ここではシンプルに毎回チェック（処理自体は軽量なので）
  
  // サイドパネルが開いているかチェック（効率化のため）
  const drawer = findSubmissionDrawer();
  if (drawer) {
    checkAndWarn();
  } else {
    // ドロワーが閉じたらフラグをリセット
    warningInserted = false;
    submitButtonHooked = false;
  }
});

// 監視開始
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 初回実行（すでに開いている場合のため）
checkAndWarn();
