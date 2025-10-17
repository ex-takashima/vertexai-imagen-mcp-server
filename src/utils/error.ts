/**
 * エラーハンドリングユーティリティ
 * スタックトレースを保持しながらエラーを適切に処理するヘルパー関数
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ZodError, type ZodSchema } from 'zod';

/**
 * エラーからメッセージを安全に抽出
 * @param error エラーオブジェクト
 * @returns エラーメッセージ
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * エラーをデバッグモードでコンソールにログ出力（スタックトレース付き）
 * @param context エラーコンテキスト（ログメッセージプレフィックス）
 * @param error エラーオブジェクト
 */
export function logErrorWithStack(context: string, error: unknown): void {
  const message = getErrorMessage(error);
  console.error(`[ERROR] ${context}: ${message}`);

  if (process.env.DEBUG && error instanceof Error && error.stack) {
    console.error(`[DEBUG] Stack trace:\n${error.stack}`);
  }
}

/**
 * エラーを新しいエラーでラップし、元のエラーをcauseとして保持
 * Node.js 16.9+のError causeオプションを使用
 *
 * @param message 新しいエラーメッセージ
 * @param cause 元のエラー
 * @returns ラップされたエラー
 */
export function wrapError(message: string, cause: unknown): Error {
  if (cause instanceof Error) {
    return new Error(message, { cause });
  }
  return new Error(`${message}: ${String(cause)}`);
}

/**
 * エラーをMcpErrorでラップし、元のエラーをcauseとして保持
 *
 * @param code MCPエラーコード
 * @param message 新しいエラーメッセージ
 * @param cause 元のエラー（オプション）
 * @returns ラップされたMcpError
 */
export function wrapMcpError(
  code: ErrorCode,
  message: string,
  cause?: unknown
): McpError {
  if (cause instanceof Error) {
    // McpErrorはcauseオプションをサポートしていないため、メッセージにスタックを含める
    if (process.env.DEBUG && cause.stack) {
      return new McpError(code, `${message}\n\nCaused by: ${cause.message}\nStack: ${cause.stack}`);
    }
    return new McpError(code, `${message} (Caused by: ${cause.message})`);
  }
  return new McpError(code, message);
}

/**
 * 非同期関数をtry-catchでラップし、エラーを適切にハンドリング
 *
 * @param fn 実行する非同期関数
 * @param context エラーコンテキスト
 * @param options オプション設定
 * @returns 関数の実行結果、またはエラーの場合はthrow
 */
export async function handleAsync<T>(
  fn: () => Promise<T>,
  context: string,
  options?: {
    /** エラーをログ出力するか（デフォルト: true） */
    logError?: boolean;
    /** エラーをラップするか（デフォルト: false） */
    wrapError?: boolean;
  }
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (options?.logError !== false) {
      logErrorWithStack(context, error);
    }

    if (options?.wrapError) {
      throw wrapError(context, error);
    }

    throw error;
  }
}

/**
 * 完全なエラースタックトレースチェーンを取得（causeを含む）
 *
 * @param error エラーオブジェクト
 * @returns スタックトレースチェーン
 */
export function getFullErrorStack(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  let stack = error.stack || error.message;
  let currentError: Error | undefined = error;

  // Error causeチェーンをたどる
  while (currentError && 'cause' in currentError && currentError.cause instanceof Error) {
    currentError = currentError.cause;
    stack += `\n\nCaused by: ${currentError.stack || currentError.message}`;
  }

  return stack;
}

/**
 * エラーがENOENT（ファイル・ディレクトリが存在しない）エラーかチェック
 *
 * @param error エラーオブジェクト
 * @returns ENOENTエラーの場合true
 */
export function isENOENTError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}

/**
 * Axiosエラーかチェックし、APIエラーメッセージを抽出
 *
 * @param error エラーオブジェクト
 * @returns APIエラーメッセージ、またはnull（Axiosエラーでない場合）
 */
export function extractAxiosErrorMessage(error: unknown): string | null {
  // axios.isAxiosError()を使用せず、型チェックで判定
  if (
    error &&
    typeof error === 'object' &&
    'isAxiosError' in error &&
    error.isAxiosError === true &&
    'response' in error
  ) {
    const axiosError = error as {
      response?: {
        data?: {
          error?: {
            message?: string;
          };
        };
        status?: number;
      };
      message?: string;
    };

    return axiosError.response?.data?.error?.message || axiosError.message || null;
  }

  return null;
}

/**
 * FTS5クエリ文字列をサニタイズ
 * SQLite FTS5の特殊文字を適切にエスケープし、構文エラーを防ぐ
 *
 * FTS5で特別な意味を持つ文字:
 * - " (phrase search)
 * - * (prefix search)
 * - - (NOT operator)
 * - ( ) (grouping)
 * - : (column filter)
 * - ^ (boost)
 *
 * @param query 検索クエリ文字列
 * @param options サニタイズオプション
 * @returns サニタイズされたクエリ文字列
 */
/**
 * Zodバリデーションエラーを人間が読みやすい形式に変換
 *
 * @param error ZodError オブジェクト
 * @returns フォーマットされたエラーメッセージ
 */
export function formatZodError(error: ZodError<any>): string {
  const issues = error.issues.map((issue: any) => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });

  return `Validation error:\n  - ${issues.join('\n  - ')}`;
}

/**
 * Zodスキーマで引数を検証し、検証エラーをMcpErrorに変換
 *
 * @param schema Zodスキーマ
 * @param args 検証する引数
 * @returns 検証済みの引数
 * @throws {McpError} 検証失敗時
 */
export function validateWithZod<T>(schema: ZodSchema<T>, args: unknown): T {
  try {
    return schema.parse(args);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        formatZodError(error)
      );
    }
    throw error;
  }
}

export function sanitizeFTS5Query(
  query: string,
  options?: {
    /** 空クエリの場合のフォールバック（デフォルト: '*'） */
    fallback?: string;
    /** フレーズ検索として扱うか（デフォルト: false） */
    phraseSearch?: boolean;
  }
): string {
  if (!query || typeof query !== 'string') {
    return options?.fallback || '*';
  }

  let sanitized = query.trim();

  if (!sanitized) {
    return options?.fallback || '*';
  }

  // フレーズ検索モード: ダブルクォートで囲む（内部のダブルクォートをエスケープ）
  if (options?.phraseSearch) {
    // 内部のダブルクォートを2つにエスケープ
    sanitized = sanitized.replace(/"/g, '""');
    return `"${sanitized}"`;
  }

  // 通常モード: FTS5特殊文字を削除またはエスケープ
  // 基本的なアプローチ: 特殊文字をスペースに置換（検索性を保持）
  sanitized = sanitized
    .replace(/[":*\-()^]/g, ' ')  // 特殊文字をスペースに置換
    .replace(/\s+/g, ' ')         // 連続するスペースを1つに
    .trim();

  if (!sanitized) {
    return options?.fallback || '*';
  }

  // 各単語をORで結合（より寛容な検索）
  const words = sanitized.split(' ').filter(w => w.length > 0);

  if (words.length === 0) {
    return options?.fallback || '*';
  }

  // 単語間をOR演算子で結合
  return words.join(' OR ');
}

/**
 * FTS5クエリの安全な実行をサポート
 * クエリをサニタイズし、エラーが発生した場合はフォールバック検索を試行
 *
 * @param query 元のクエリ文字列
 * @param executeQuery クエリ実行関数
 * @param options オプション設定
 * @returns クエリ実行結果
 */
export async function safeFTS5Query<T>(
  query: string,
  executeQuery: (sanitizedQuery: string) => T | Promise<T>,
  options?: {
    /** 初回失敗時にフォールバック検索を試みるか（デフォルト: true） */
    useFallback?: boolean;
    /** フレーズ検索として扱うか（デフォルト: false） */
    phraseSearch?: boolean;
  }
): Promise<T> {
  // 最初の試行: サニタイズされたクエリで検索
  const sanitized = sanitizeFTS5Query(query, {
    phraseSearch: options?.phraseSearch,
  });

  try {
    return await Promise.resolve(executeQuery(sanitized));
  } catch (error) {
    // フォールバック無効の場合はエラーをそのままthrow
    if (options?.useFallback === false) {
      throw error;
    }

    // フォールバック: ワイルドカード検索
    if (process.env.DEBUG) {
      console.error(`[DEBUG] FTS5 query failed, trying fallback: ${getErrorMessage(error)}`);
    }

    try {
      return await Promise.resolve(executeQuery('*'));
    } catch (fallbackError) {
      // フォールバックも失敗した場合は元のエラーをthrow
      throw error;
    }
  }
}
