/**
 * APIレート制限ユーティリティ
 * Vertex AI APIコールの頻度を制限し、クォータ枯渇を防ぐ
 */

/**
 * シンプルなレート制限器
 * スライディングウィンドウアルゴリズムを使用して一定期間内のリクエスト数を制限
 */
export class RateLimiter {
  private callTimes: number[] = [];
  private readonly maxCallsPerWindow: number;
  private readonly windowMs: number;

  /**
   * @param maxCallsPerWindow ウィンドウ期間内の最大コール数（デフォルト: 60）
   * @param windowMs ウィンドウ期間（ミリ秒）（デフォルト: 60000 = 1分）
   */
  constructor(
    maxCallsPerWindow: number = 60,
    windowMs: number = 60000
  ) {
    this.maxCallsPerWindow = maxCallsPerWindow;
    this.windowMs = windowMs;
  }

  /**
   * レート制限付きで関数を実行
   * 制限に達している場合は待機してから実行
   *
   * @param fn 実行する関数
   * @returns 関数の実行結果
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitIfNeeded();
    this.recordCall();
    return fn();
  }

  /**
   * 必要に応じて待機
   * レート制限に達している場合、次のコールが可能になるまで待つ
   */
  private async waitIfNeeded(): Promise<void> {
    this.cleanupOldCalls();

    if (this.callTimes.length >= this.maxCallsPerWindow) {
      // 最も古いコールの時刻を取得
      const oldestCallTime = this.callTimes[0];
      const now = Date.now();
      const waitTime = this.windowMs - (now - oldestCallTime);

      if (waitTime > 0) {
        if (process.env.DEBUG) {
          console.error(
            `[DEBUG] Rate limit reached (${this.callTimes.length}/${this.maxCallsPerWindow} calls). ` +
            `Waiting ${waitTime}ms...`
          );
        }
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // 待機後、再度古いコールをクリーンアップ
        this.cleanupOldCalls();
      }
    }
  }

  /**
   * コールを記録
   */
  private recordCall(): void {
    this.callTimes.push(Date.now());
  }

  /**
   * ウィンドウ外の古いコールを削除
   */
  private cleanupOldCalls(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.callTimes = this.callTimes.filter(time => time > cutoff);
  }

  /**
   * 現在のレート制限状態を取得（デバッグ用）
   */
  getStatus(): { callsInWindow: number; maxCalls: number; windowMs: number } {
    this.cleanupOldCalls();
    return {
      callsInWindow: this.callTimes.length,
      maxCalls: this.maxCallsPerWindow,
      windowMs: this.windowMs,
    };
  }

  /**
   * レート制限をリセット
   */
  reset(): void {
    this.callTimes = [];
  }
}

/**
 * グローバルなVertex AI APIレート制限器
 * 環境変数で設定可能:
 * - VERTEXAI_RATE_LIMIT_MAX_CALLS: 1分あたりの最大コール数（デフォルト: 60）
 * - VERTEXAI_RATE_LIMIT_WINDOW_MS: ウィンドウ期間（ミリ秒）（デフォルト: 60000）
 */
export const vertexAIRateLimiter = new RateLimiter(
  parseInt(process.env.VERTEXAI_RATE_LIMIT_MAX_CALLS || '60', 10),
  parseInt(process.env.VERTEXAI_RATE_LIMIT_WINDOW_MS || '60000', 10)
);

if (process.env.DEBUG) {
  const status = vertexAIRateLimiter.getStatus();
  console.error(
    `[DEBUG] Rate limiter initialized: ${status.maxCalls} calls per ${status.windowMs}ms`
  );
}
