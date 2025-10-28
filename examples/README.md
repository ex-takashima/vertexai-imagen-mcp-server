# バッチ処理サンプル集

このディレクトリには、バッチ画像生成のサンプル設定ファイルが含まれています。

## サンプルファイル一覧

### 1. batch-simple.json

**用途**: 基本的なバッチ処理のデモ

シンプルな3つの画像生成ジョブを含む設定ファイルです。初めてバッチ処理を試す際に最適です。

```bash
# CLIで実行
vertexai-imagen-batch examples/batch-simple.json

# 開発環境で実行
npm run dev:batch examples/batch-simple.json
```

**生成される画像**:
- `sunset.png` - 海に沈む美しい夕日（16:9）
- `city.png` - 夜の未来的な都市のスカイライン（16:9）
- `mountain.png` - 穏やかな山の風景（4:3）

---

### 2. batch-advanced.json

**用途**: 詳細設定を使用した高品質画像生成

様々なパラメーターを使用した5つの画像生成ジョブを含む設定ファイルです。

```bash
# 出力ディレクトリを指定して実行
vertexai-imagen-batch examples/batch-advanced.json --output-dir ./my-images

# JSON形式で結果を取得
vertexai-imagen-batch examples/batch-advanced.json --format json > result.json
```

**特徴**:
- 最大3並列実行
- 15分タイムアウト
- 高解像度（2K）画像を含む
- 人物生成、抽象芸術、商品写真など多様なジャンル

**生成される画像**:
- `portrait_business.png` - ビジネススーツの女性の肖像（3:4, 2K）
- `abstract_geometric.png` - ブルーとゴールドの幾何学的抽象芸術（1:1）
- `coffee_shop.png` - 暖かい照明のコーヒーショップ（16:9）
- `fantasy_dragon.png` - 中世の城の上を飛ぶドラゴン（16:9, 2K）
- `product_smartphone.png` - 白背景のスマートフォン商品写真（1:1, 2K, Ultra品質）

---

### 3. batch-bulk.json

**用途**: 大量の画像を一括生成

10種類の色のスポーツカーを生成するバッチ設定ファイルです。同じテーマの複数バリエーションを生成する際の参考になります。

```bash
# 最大5並列で実行
vertexai-imagen-batch examples/batch-bulk.json

# タイムアウトを30分に設定
vertexai-imagen-batch examples/batch-bulk.json --timeout 1800000
```

**特徴**:
- 最大5並列実行（デフォルト2より多く設定）
- 30分タイムアウト
- 10個の画像を効率的に生成

**生成される画像**:
- `car_red.png` - 赤いスポーツカー
- `car_blue.png` - 青いスポーツカー
- `car_green.png` - 緑のスポーツカー
- ... (全10色)

---

## GitHub Actionsでの使用

これらのサンプルをGitHub Actions経由で実行するには、Issueコメントに以下のように投稿します：

### batch-simple.json の場合

````markdown
/batch

```json
{
  "jobs": [
    {
      "prompt": "A beautiful sunset over the ocean",
      "output_filename": "sunset.png",
      "aspect_ratio": "16:9"
    },
    {
      "prompt": "A futuristic city skyline at night",
      "output_filename": "city.png",
      "aspect_ratio": "16:9"
    },
    {
      "prompt": "A serene mountain landscape",
      "output_filename": "mountain.png",
      "aspect_ratio": "4:3"
    }
  ]
}
```
````

### 独自の設定をカスタマイズ

サンプルファイルをコピーして、プロンプトやパラメーターを変更できます：

```bash
# サンプルをコピー
cp examples/batch-simple.json my-batch.json

# エディタで編集
nano my-batch.json

# 実行
vertexai-imagen-batch my-batch.json
```

---

## トラブルシューティング

### エラー: "Invalid batch config"

- JSON構文が正しいことを確認してください
- `jobs` 配列が存在し、少なくとも1つのジョブが含まれていることを確認

### エラー: "prompt is required"

- 各ジョブに `prompt` フィールドが含まれていることを確認

### タイムアウトエラー

- `timeout` を増やすか、`max_concurrent` を増やして並列度を上げてください

---

## 詳細情報

バッチ処理の詳細については、以下のドキュメントを参照してください：

- [バッチ処理ガイド](../docs/BATCH_PROCESSING.md)
- [メインREADME](../README.md)

---

## サポート

質問や問題がある場合は、GitHubリポジトリでIssueを作成してください：
https://github.com/ex-takashima/vertexai-imagen-mcp-server/issues
