# Customize Image YAML Templates

このディレクトリには、`customize_image_from_yaml` ツールで使用できるYAML設定ファイルのサンプルテンプレートが含まれています。

## テンプレート一覧

### 1. `01_subject-only.yaml` - 被写体のみ（最小構成）
- **用途**: 被写体の一貫性を保った画像生成
- **特徴**:
  - 1つの被写体を複数の参照画像から学習
  - 最もシンプルな構成
- **使用例**: ポートレート、商品写真、ペット写真

### 2. `02_multi-subject.yaml` - 複数被写体
- **用途**: 複数の異なる被写体を1つの画像に配置
- **特徴**:
  - 各被写体に異なる reference_id を割り当て
  - プロンプト内で [1], [2] のように参照
- **使用例**: グループ写真、複数キャラクターのシーン
- **注意**: 現在の実装では最初の被写体グループのみが使用されます

### 3. `03_with-control.yaml` - 制御画像
- **用途**: 画像の構造やポーズを制御
- **特徴**:
  - face_mesh: 顔の構造を保持
  - canny: エッジ検出による構造制御
  - scribble: スケッチによる構造制御
- **使用例**: 特定のポーズ、構図、建物の構造を保持

### 4. `04_with-style.yaml` - スタイル画像
- **用途**: アートスタイルの転写
- **特徴**:
  - 参照画像のスタイル（色調、描画スタイル、雰囲気）を適用
  - style の description は必須
- **使用例**: 絵画風、写真スタイル、イラスト風の変換

### 5. `05_full-featured.yaml` - 全機能統合
- **用途**: すべての機能を組み合わせた高度なカスタマイズ
- **特徴**:
  - 被写体 + 制御画像 + スタイル画像
  - 複数バリエーションの生成
- **使用例**: 最も複雑な要求に対応

## 基本的な使い方

### 1. テンプレートをコピー
```bash
cp templates/customize/01_subject-only.yaml my_config.yaml
```

### 2. YAML設定を編集
```yaml
# 必須フィールドを編集
model: "imagen-3.0-capability-001"
output_path: "./my_output.png"
prompt: "Your custom prompt with [1] reference"

# 参照画像のパスを指定
subjects:
  - reference_id: 1
    images:
      - "/path/to/your/image1.jpg"
      - "/path/to/your/image2.jpg"
    config:
      type: "person"
```

### 3. MCPクライアント（Claude Desktop等）から実行
```
customize_image_from_yaml ツールを使用して、my_config.yaml から画像を生成してください
```

## YAML構造の詳細

### 必須フィールド

```yaml
model: "imagen-3.0-capability-001"  # 使用するモデル
output_path: "./output.png"         # 出力ファイルパス
prompt: "Your prompt here"          # 生成プロンプト
```

### 参照画像タイプ

#### SUBJECT（被写体）
```yaml
subjects:
  - reference_id: 1                 # 参照ID（プロンプトで [1] として使用）
    images:                         # 複数画像指定可能
      - "./image1.jpg"
      - "./image2.jpg"
    config:
      type: "person"                # person, animal, product, default
      description: "説明文"          # 必須
```

#### CONTROL（制御画像）
```yaml
control:
  reference_id: 2
  image_path: "./control.jpg"
  type: "canny"                     # face_mesh, canny, scribble
  enable_computation: true          # エッジ検出を自動実行
```

#### STYLE（スタイル画像）
```yaml
style:
  reference_id: 3
  image_path: "./style.jpg"
  description: "スタイルの詳細な説明"  # 省略可能
```

### reference_id のルール

1. **異なるタイプ間では重複不可**
   - SUBJECT, CONTROL, STYLE それぞれで異なる ID を使用
   ```yaml
   subjects:
     - reference_id: 1    # OK
   control:
     reference_id: 2      # OK（1と重複しない）
   style:
     reference_id: 3      # OK（1, 2と重複しない）
   ```

2. **同じ SUBJECT 内では同じ ID を使用可能**
   ```yaml
   subjects:
     - reference_id: 1
       images: ["person1.jpg", "person2.jpg"]
   ```

3. **プロンプト内での参照**
   ```yaml
   prompt: "[1] is wearing a hat, in the pose from [2], with the style of [3]"
   ```

## オプションパラメータ

### 画像サイズ・品質
```yaml
aspect_ratio: "16:9"           # 1:1, 3:4, 4:3, 9:16, 16:9
sample_image_size: "2K"        # 1K, 2K
sample_count: 4                # 1-4（生成する画像数）
```

### 安全性設定
```yaml
safety_level: "BLOCK_MEDIUM_AND_ABOVE"
person_generation: "ALLOW_ADULT"    # DONT_ALLOW, ALLOW_ADULT, ALLOW_ALL
language: "auto"                    # auto, en, ja, zh, ko, etc.
```

### その他
```yaml
negative_prompt: "blurry, low quality"
region: "us-central1"
return_base64: false
include_thumbnail: false
```

## パス指定について

画像パスは以下の形式で指定できます：

- **絶対パス**: `/home/user/images/photo.jpg`
- **相対パス**: `./images/photo.jpg`（YAMLファイルからの相対パス）
- **ホームディレクトリ**: `~/images/photo.jpg`

## トラブルシューティング

### YAML構文エラー
```
YAML syntax error: unexpected token
```
- インデント（スペース）を確認
- コロン `:` の後にスペースがあるか確認
- 文字列に特殊文字がある場合はクォートで囲む

### バリデーションエラー
```
YAML validation errors:
  - model is required
  - output_path is required
```
- 必須フィールド（model, output_path, prompt）を確認
- 参照画像が少なくとも1つ指定されているか確認

### 画像ファイルが見つからない
```
YAML file not found: ./images/photo.jpg
```
- 画像パスが正しいか確認
- ファイルが実際に存在するか確認

## 関連ドキュメント

- [メインREADME](../../README.md) - MCPサーバーの全体的な使用方法
- [Google Imagen API ドキュメント](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)
