# Bug Report: Database Directory Race Condition

**Date**: 2025-10-18
**Severity**: Critical
**Status**: Fixed
**Version**: 0.7.0

---

## Summary

新規インストール時やデータベースディレクトリが存在しない環境で、MCPサーバーの起動時に `TypeError: Cannot open database because the directory does not exist` エラーが発生し、サーバーが起動できない問題。

---

## Problem Description

### Symptoms

MCPサーバー起動時に以下のエラーが発生：

```
TypeError: Cannot open database because the directory does not exist
    at new Database (C:\Users\Administrator\AppData\Roaming\npm\node_modules\@dondonudonjp\vertexai-imagen-mcp-server\node_modules\better-sqlite3\lib\database.js:65:9)
    at new JobDatabase (file:///C:/Users/Administrator/AppData/Roaming/npm/node_modules/@dondonudonjp/vertexai-imagen-mcp-server/build/utils/database.js:15:19)
    at new GoogleImagenMCPServer (file:///C:/Users/Administrator/AppData/Roaming/npm/node_modules/@dondonudonjp/vertexai-imagen-mcp-server/build/index.js:97:28)
```

### Affected Environments

- 新規インストール時
- データベースディレクトリが削除された環境
- Windows環境（特に影響を受けやすい）

### Impact

- サーバーが全く起動できない
- ユーザーは手動でディレクトリを作成する必要がある
- Claude Desktop等のMCPクライアントから利用不可

---

## Root Cause Analysis

### Original Code (src/utils/database.ts:29-39)

```typescript
constructor(dbPath: string) {
  // データベースディレクトリの作成
  const dbDir = dirname(dbPath);
  mkdir(dbDir, { recursive: true }).catch(() => {
    // ディレクトリが既に存在する場合は無視
  });

  this.db = new Database(dbPath);
  this.initialize();
  this.prepareStatements();
}
```

### Problem

1. **非同期処理の待機なし**: `mkdir()` は非同期（Promise）だが、完了を待たずに次の処理を実行
2. **Race Condition**: ディレクトリ作成が完了する前に `new Database(dbPath)` が実行される
3. **エラーハンドリング不足**: `catch()` で全てのエラーを無視してしまう

### Why It Failed

```
タイムライン:
1. mkdir() が非同期で実行開始（Promise返却）
2. すぐに new Database(dbPath) が実行
3. ディレクトリがまだ存在しないため、better-sqlite3がエラーをthrow
4. mkdir()の完了はその後
```

---

## Solution

### Fixed Code (src/utils/database.ts:29-44)

```typescript
constructor(dbPath: string) {
  // データベースディレクトリの作成（同期的に実行）
  const dbDir = dirname(dbPath);
  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (error: any) {
    // ディレクトリが既に存在する場合は無視
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  this.db = new Database(dbPath);
  this.initialize();
  this.prepareStatements();
}
```

### Changes Made

1. **同期処理に変更**: `mkdir()` → `mkdirSync()`
2. **import修正**: `import { mkdir } from 'fs/promises'` → `import { mkdirSync } from 'fs'`
3. **適切なエラーハンドリング**: EEXIST（既に存在）以外のエラーは再throw

### Why This Works

- `mkdirSync()` は同期的に実行されるため、完了を確実に待つ
- ディレクトリ作成が完全に終了してから `new Database()` が実行される
- Race conditionが完全に解消

---

## Testing

### Before Fix

```bash
# データベースディレクトリを削除
rm -rf ~/.local/share/vertexai-imagen-mcp-server/

# サーバー起動を試みる
npm run start
# → エラー: Cannot open database because the directory does not exist
```

### After Fix

```bash
# データベースディレクトリを削除
rm -rf ~/.local/share/vertexai-imagen-mcp-server/

# サーバー起動
npm run build
npm run start
# → 成功: ディレクトリが自動作成され、サーバーが正常起動
```

### Test Cases

- ✅ 新規インストール時の初回起動
- ✅ データベースディレクトリが存在しない状態での起動
- ✅ データベースディレクトリが既に存在する状態での起動
- ✅ Windows環境での動作
- ✅ Linux/macOS環境での動作

---

## Alternative Solutions Considered

### Option 1: async/await パターン（不採用）

```typescript
async initialize(dbPath: string): Promise<void> {
  const dbDir = dirname(dbPath);
  await mkdir(dbDir, { recursive: true });
  this.db = new Database(dbPath);
  // ...
}
```

**不採用理由:**
- コンストラクタをasyncにできない（TypeScript/JavaScriptの制約）
- 初期化メソッドを分離する必要があり、API設計が複雑化
- 呼び出し側すべてでawaitが必要

### Option 2: existsSync + mkdirSync（不採用）

```typescript
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}
```

**不採用理由:**
- 不要なチェック（`mkdirSync` with `recursive: true` は既存ディレクトリでもエラーにならない）
- TOCTOU (Time-of-check to time-of-use) 問題の可能性

### Selected Option: mkdirSync with try-catch（採用）

**採用理由:**
- シンプルで明確
- Race conditionなし
- 既存コードへの影響が最小
- エラーハンドリングが適切

---

## Prevention

### Code Review Checklist

今後、同様の問題を防ぐためのチェックリスト：

- [ ] ファイルシステム操作の前に必要なディレクトリが存在するか確認
- [ ] 非同期処理の完了を待つ必要がある箇所で適切に await を使用
- [ ] コンストラクタ内で非同期処理を避ける
- [ ] Race condition の可能性がないか確認
- [ ] 新規インストール時のテストを実施

### Testing Requirements

- 新規インストール時のテストケースを常に含める
- データベースディレクトリが存在しない状態でのテストを追加
- Windows/Linux/macOS すべてでテスト実施

---

## Related Issues

### Similar Potential Issues

以下の箇所でも同様の問題が発生する可能性があるため、確認が必要：

- ✅ `src/utils/database.ts` - 修正済み
- 他のファイル作成・ディレクトリ作成処理

### Future Improvements

1. **データベースパスの検証**: 起動時にデータベースパスの妥当性を検証
2. **より詳細なエラーメッセージ**: ユーザーが問題を理解しやすいエラーメッセージ
3. **初期化ログの追加**: デバッグ用にディレクトリ作成のログを追加

---

## Files Changed

- `src/utils/database.ts`: 29-44行目を修正

### Diff

```diff
- import { mkdir } from 'fs/promises';
+ import { mkdirSync } from 'fs';

  constructor(dbPath: string) {
-   // データベースディレクトリの作成
+   // データベースディレクトリの作成（同期的に実行）
    const dbDir = dirname(dbPath);
-   mkdir(dbDir, { recursive: true }).catch(() => {
-     // ディレクトリが既に存在する場合は無視
-   });
+   try {
+     mkdirSync(dbDir, { recursive: true });
+   } catch (error: any) {
+     // ディレクトリが既に存在する場合は無視
+     if (error.code !== 'EEXIST') {
+       throw error;
+     }
+   }

    this.db = new Database(dbPath);
    this.initialize();
    this.prepareStatements();
  }
```

---

## References

- [Node.js fs.mkdirSync documentation](https://nodejs.org/api/fs.html#fsmkdirsyncpath-options)
- [better-sqlite3 documentation](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- Race condition pattern in asynchronous programming

---

## Lessons Learned

1. **コンストラクタ内での非同期処理は避ける**: 同期処理で完結させるか、初期化メソッドを分離
2. **ファイルシステム操作には同期版を検討**: 初期化処理では同期版の方が安全な場合が多い
3. **新規インストールケースのテストは必須**: 開発環境では見逃しがちな重要なテストケース
4. **エラーは適切に再throw**: すべてのエラーを無視するのは危険

---

**Fixed by**: Claude Code
**Date**: 2025-10-18
**Build**: Successfully compiled with npm run build
