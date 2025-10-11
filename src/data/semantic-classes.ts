/**
 * Semantic Segmentation Class Definitions
 * Vertex AI Imagen API で使用可能なセマンティッククラスID一覧
 *
 * Reference: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/imagen-api-edit
 */

export interface SemanticClass {
  id: number;
  name: string;
  nameEn: string;
  category: string;
}

export const SEMANTIC_CLASSES: SemanticClass[] = [
  { id: 0, name: "リュックサック", nameEn: "backpack", category: "アクセサリー" },
  { id: 1, name: "傘", nameEn: "umbrella", category: "アクセサリー" },
  { id: 2, name: "バッグ", nameEn: "bag", category: "アクセサリー" },
  { id: 3, name: "ネクタイ", nameEn: "tie", category: "アクセサリー" },
  { id: 4, name: "スーツケース", nameEn: "suitcase", category: "アクセサリー" },
  { id: 5, name: "ケース", nameEn: "case", category: "アクセサリー" },
  { id: 6, name: "鳥", nameEn: "bird", category: "動物" },
  { id: 7, name: "猫", nameEn: "cat", category: "動物" },
  { id: 8, name: "犬", nameEn: "dog", category: "動物" },
  { id: 9, name: "馬", nameEn: "horse", category: "動物" },
  { id: 10, name: "ヒツジ", nameEn: "sheep", category: "動物" },
  { id: 11, name: "牛", nameEn: "cow", category: "動物" },
  { id: 12, name: "ゾウ", nameEn: "elephant", category: "動物" },
  { id: 13, name: "クマ", nameEn: "bear", category: "動物" },
  { id: 14, name: "シマウマ", nameEn: "zebra", category: "動物" },
  { id: 15, name: "キリン", nameEn: "giraffe", category: "動物" },
  { id: 16, name: "動物（その他）", nameEn: "animal (other)", category: "動物" },
  { id: 17, name: "電子レンジ", nameEn: "microwave", category: "電化製品" },
  { id: 18, name: "ラジエーター", nameEn: "radiator", category: "電化製品" },
  { id: 19, name: "オーブン", nameEn: "oven", category: "電化製品" },
  { id: 20, name: "トースター", nameEn: "toaster", category: "電化製品" },
  { id: 21, name: "貯蔵タンク", nameEn: "storage tank", category: "電化製品" },
  { id: 22, name: "コンベヤー ベルト", nameEn: "conveyor belt", category: "電化製品" },
  { id: 23, name: "シンク", nameEn: "sink", category: "電化製品" },
  { id: 24, name: "冷蔵庫", nameEn: "refrigerator", category: "電化製品" },
  { id: 25, name: "洗濯乾燥機", nameEn: "washer/dryer", category: "電化製品" },
  { id: 26, name: "扇風機", nameEn: "fan", category: "電化製品" },
  { id: 27, name: "食洗機", nameEn: "dishwasher", category: "電化製品" },
  { id: 28, name: "トイレ", nameEn: "toilet", category: "電化製品" },
  { id: 29, name: "バスタブ", nameEn: "bathtub", category: "電化製品" },
  { id: 30, name: "シャワー", nameEn: "shower", category: "電化製品" },
  { id: 31, name: "トンネル", nameEn: "tunnel", category: "建物・構造" },
  { id: 32, name: "ブリッジ", nameEn: "bridge", category: "建物・構造" },
  { id: 33, name: "桟橋", nameEn: "pier", category: "建物・構造" },
  { id: 34, name: "テント", nameEn: "tent", category: "建物・構造" },
  { id: 35, name: "ビルディング", nameEn: "building", category: "建物・構造" },
  { id: 36, name: "天井", nameEn: "ceiling", category: "建物・構造" },
  { id: 37, name: "ノートパソコン", nameEn: "laptop", category: "電化製品" },
  { id: 38, name: "キーボード", nameEn: "keyboard", category: "電化製品" },
  { id: 39, name: "ネズミ", nameEn: "mouse", category: "電化製品" },
  { id: 40, name: "リモート", nameEn: "remote", category: "電化製品" },
  { id: 41, name: "携帯電話", nameEn: "cell phone", category: "電化製品" },
  { id: 42, name: "テレビ", nameEn: "TV", category: "電化製品" },
  { id: 43, name: "フロア", nameEn: "floor", category: "建物・構造" },
  { id: 44, name: "ステージ", nameEn: "stage", category: "建物・構造" },
  { id: 45, name: "バナナ", nameEn: "banana", category: "食品" },
  { id: 46, name: "リンゴ", nameEn: "apple", category: "食品" },
  { id: 47, name: "サンドイッチ", nameEn: "sandwich", category: "食品" },
  { id: 48, name: "オレンジ", nameEn: "orange", category: "食品" },
  { id: 49, name: "ブロッコリー", nameEn: "broccoli", category: "食品" },
  { id: 50, name: "ニンジン", nameEn: "carrot", category: "食品" },
  { id: 51, name: "ホットドッグ", nameEn: "hot dog", category: "食品" },
  { id: 52, name: "ピザ", nameEn: "pizza", category: "食品" },
  { id: 53, name: "ドーナツ", nameEn: "donut", category: "食品" },
  { id: 54, name: "ケーキ", nameEn: "cake", category: "食品" },
  { id: 55, name: "果物（その他）", nameEn: "fruit (other)", category: "食品" },
  { id: 56, name: "食品（その他）", nameEn: "food (other)", category: "食品" },
  { id: 57, name: "椅子（その他）", nameEn: "chair (other)", category: "家具" },
  { id: 58, name: "アームチェア", nameEn: "armchair", category: "家具" },
  { id: 59, name: "回転椅子", nameEn: "swivel chair", category: "家具" },
  { id: 60, name: "スツール", nameEn: "stool", category: "家具" },
  { id: 61, name: "シート", nameEn: "seat", category: "家具" },
  { id: 62, name: "ソファ", nameEn: "sofa", category: "家具" },
  { id: 63, name: "ゴミ箱", nameEn: "trash can", category: "家具" },
  { id: 64, name: "鉢植えの植物", nameEn: "potted plant", category: "自然" },
  { id: 65, name: "ナイトスタンド", nameEn: "nightstand", category: "家具" },
  { id: 66, name: "ベッド", nameEn: "bed", category: "家具" },
  { id: 67, name: "テーブル", nameEn: "table", category: "家具" },
  { id: 68, name: "ビリヤード", nameEn: "pool table", category: "家具" },
  { id: 69, name: "樽", nameEn: "barrel", category: "家具" },
  { id: 70, name: "デスク", nameEn: "desk", category: "家具" },
  { id: 71, name: "オットマン", nameEn: "ottoman", category: "家具" },
  { id: 72, name: "洋服だんす", nameEn: "wardrobe", category: "家具" },
  { id: 73, name: "ベビーベッド", nameEn: "crib", category: "家具" },
  { id: 74, name: "かご", nameEn: "basket", category: "家具" },
  { id: 75, name: "整理ダンス", nameEn: "chest of drawers", category: "家具" },
  { id: 76, name: "本棚", nameEn: "bookshelf", category: "家具" },
  { id: 77, name: "カウンタ（その他）", nameEn: "counter (other)", category: "家具" },
  { id: 78, name: "バスルーム カウンタ", nameEn: "bathroom counter", category: "家具" },
  { id: 79, name: "キッチン アイランド", nameEn: "kitchen island", category: "家具" },
  { id: 80, name: "ドア", nameEn: "door", category: "建物・構造" },
  { id: 81, name: "ライト（その他）", nameEn: "light (other)", category: "電化製品" },
  { id: 82, name: "ランプ", nameEn: "lamp", category: "電化製品" },
  { id: 83, name: "壁掛け照明", nameEn: "wall light", category: "電化製品" },
  { id: 84, name: "シャンデリア", nameEn: "chandelier", category: "電化製品" },
  { id: 85, name: "ミラー", nameEn: "mirror", category: "家具" },
  { id: 86, name: "ホワイトボード", nameEn: "whiteboard", category: "その他" },
  { id: 87, name: "棚", nameEn: "shelf", category: "家具" },
  { id: 88, name: "階段", nameEn: "stairs", category: "建物・構造" },
  { id: 89, name: "エスカレーター", nameEn: "escalator", category: "建物・構造" },
  { id: 90, name: "キャビネット", nameEn: "cabinet", category: "家具" },
  { id: 91, name: "暖炉", nameEn: "fireplace", category: "家具" },
  { id: 92, name: "ガスコンロ", nameEn: "stove", category: "電化製品" },
  { id: 93, name: "アーケード マシン", nameEn: "arcade machine", category: "電化製品" },
  { id: 94, name: "砂利", nameEn: "gravel", category: "自然" },
  { id: 95, name: "プラットフォーム", nameEn: "platform", category: "建物・構造" },
  { id: 96, name: "プレイフィールド", nameEn: "playfield", category: "建物・構造" },
  { id: 97, name: "レール", nameEn: "rail track", category: "建物・構造" },
  { id: 98, name: "道路", nameEn: "road", category: "建物・構造" },
  { id: 99, name: "雪", nameEn: "snow", category: "自然" },
  { id: 100, name: "歩道", nameEn: "sidewalk", category: "建物・構造" },
  { id: 101, name: "ランウェイ", nameEn: "runway", category: "建物・構造" },
  { id: 102, name: "地形", nameEn: "terrain", category: "自然" },
  { id: 103, name: "書籍", nameEn: "book", category: "その他" },
  { id: 104, name: "ボックス", nameEn: "box", category: "その他" },
  { id: 105, name: "時計", nameEn: "clock", category: "その他" },
  { id: 106, name: "花瓶", nameEn: "vase", category: "その他" },
  { id: 107, name: "はさみ", nameEn: "scissors", category: "その他" },
  { id: 108, name: "玩具（その他）", nameEn: "toy (other)", category: "その他" },
  { id: 109, name: "テディベア", nameEn: "teddy bear", category: "その他" },
  { id: 110, name: "ヘアドライヤー", nameEn: "hair dryer", category: "電化製品" },
  { id: 111, name: "歯ブラシ", nameEn: "toothbrush", category: "その他" },
  { id: 112, name: "絵画", nameEn: "painting", category: "その他" },
  { id: 113, name: "ポスター", nameEn: "poster", category: "その他" },
  { id: 114, name: "掲示板", nameEn: "bulletin board", category: "その他" },
  { id: 115, name: "ボトル", nameEn: "bottle", category: "その他" },
  { id: 116, name: "コップ", nameEn: "cup", category: "その他" },
  { id: 117, name: "ワイングラス", nameEn: "wine glass", category: "その他" },
  { id: 118, name: "ナイフ", nameEn: "knife", category: "その他" },
  { id: 119, name: "フォーク", nameEn: "fork", category: "その他" },
  { id: 120, name: "スプーン", nameEn: "spoon", category: "その他" },
  { id: 121, name: "ボウル", nameEn: "bowl", category: "その他" },
  { id: 122, name: "トレイ", nameEn: "tray", category: "その他" },
  { id: 123, name: "レンジフード", nameEn: "range hood", category: "電化製品" },
  { id: 124, name: "皿", nameEn: "plate", category: "その他" },
  { id: 125, name: "人物", nameEn: "person", category: "人物" },
  { id: 126, name: "ライダー（その他）", nameEn: "rider (other)", category: "人物" },
  { id: 127, name: "サイクリスト", nameEn: "bicyclist", category: "人物" },
  { id: 128, name: "ライダー", nameEn: "motorcyclist", category: "人物" },
  { id: 129, name: "ホワイトペーパー", nameEn: "paper", category: "その他" },
  { id: 130, name: "街灯", nameEn: "street light", category: "屋外設備" },
  { id: 131, name: "道路の障害物", nameEn: "road barrier", category: "屋外設備" },
  { id: 132, name: "郵便受け", nameEn: "mailbox", category: "屋外設備" },
  { id: 133, name: "CCTV カメラ", nameEn: "CCTV camera", category: "屋外設備" },
  { id: 134, name: "ジャンクション ボックス", nameEn: "junction box", category: "屋外設備" },
  { id: 135, name: "交通標識", nameEn: "traffic sign", category: "屋外設備" },
  { id: 136, name: "信号", nameEn: "traffic light", category: "屋外設備" },
  { id: 137, name: "消火栓", nameEn: "fire hydrant", category: "屋外設備" },
  { id: 138, name: "パーキング メーター", nameEn: "parking meter", category: "屋外設備" },
  { id: 139, name: "ベンチ", nameEn: "bench", category: "屋外設備" },
  { id: 140, name: "自転車置き場", nameEn: "bike rack", category: "屋外設備" },
  { id: 141, name: "広告板", nameEn: "billboard", category: "屋外設備" },
  { id: 142, name: "空", nameEn: "sky", category: "自然" },
  { id: 143, name: "ポール", nameEn: "pole", category: "屋外設備" },
  { id: 144, name: "フェンス", nameEn: "fence", category: "屋外設備" },
  { id: 145, name: "手すり", nameEn: "railing", category: "屋外設備" },
  { id: 146, name: "ガードレール", nameEn: "guard rail", category: "屋外設備" },
  { id: 147, name: "山", nameEn: "mountain", category: "自然" },
  { id: 148, name: "岩", nameEn: "rock", category: "自然" },
  { id: 149, name: "フリスビー", nameEn: "frisbee", category: "スポーツ用品" },
  { id: 150, name: "スキー", nameEn: "skis", category: "スポーツ用品" },
  { id: 151, name: "スノーボード", nameEn: "snowboard", category: "スポーツ用品" },
  { id: 152, name: "ボール", nameEn: "sports ball", category: "スポーツ用品" },
  { id: 153, name: "凧", nameEn: "kite", category: "スポーツ用品" },
  { id: 154, name: "野球のバット", nameEn: "baseball bat", category: "スポーツ用品" },
  { id: 155, name: "野球のグローブ", nameEn: "baseball glove", category: "スポーツ用品" },
  { id: 156, name: "スケートボード", nameEn: "skateboard", category: "スポーツ用品" },
  { id: 157, name: "サーフボード", nameEn: "surfboard", category: "スポーツ用品" },
  { id: 158, name: "テニスラケット", nameEn: "tennis racket", category: "スポーツ用品" },
  { id: 159, name: "ネット", nameEn: "net", category: "スポーツ用品" },
  { id: 160, name: "ベース", nameEn: "base", category: "スポーツ用品" },
  { id: 161, name: "彫刻", nameEn: "sculpture", category: "その他" },
  { id: 162, name: "列", nameEn: "column", category: "建物・構造" },
  { id: 163, name: "噴水", nameEn: "fountain", category: "屋外設備" },
  { id: 164, name: "日よけ", nameEn: "awning", category: "建物・構造" },
  { id: 165, name: "アパレル", nameEn: "apparel", category: "その他" },
  { id: 166, name: "バナー", nameEn: "banner", category: "その他" },
  { id: 167, name: "旗", nameEn: "flag", category: "その他" },
  { id: 168, name: "ブランケット", nameEn: "blanket", category: "その他" },
  { id: 169, name: "カーテン（その他）", nameEn: "curtain (other)", category: "その他" },
  { id: 170, name: "シャワーカーテン", nameEn: "shower curtain", category: "その他" },
  { id: 171, name: "枕", nameEn: "pillow", category: "その他" },
  { id: 172, name: "タオル", nameEn: "towel", category: "その他" },
  { id: 173, name: "ラグマット", nameEn: "rug", category: "その他" },
  { id: 174, name: "樹木", nameEn: "tree", category: "自然" },
  { id: 175, name: "自転車", nameEn: "bicycle", category: "乗り物" },
  { id: 176, name: "車", nameEn: "car", category: "乗り物" },
  { id: 177, name: "自動三輪タクシー", nameEn: "autorickshaw", category: "乗り物" },
  { id: 178, name: "オートバイ", nameEn: "motorcycle", category: "乗り物" },
  { id: 179, name: "飛行機", nameEn: "airplane", category: "乗り物" },
  { id: 180, name: "バス", nameEn: "bus", category: "乗り物" },
  { id: 181, name: "電車", nameEn: "train", category: "乗り物" },
  { id: 182, name: "トラック", nameEn: "truck", category: "乗り物" },
  { id: 183, name: "トレーラー", nameEn: "trailer", category: "乗り物" },
  { id: 184, name: "ボート、船", nameEn: "boat", category: "乗り物" },
  { id: 185, name: "ゆっくりと動く車輪付きの物体", nameEn: "slow wheeled object", category: "乗り物" },
  { id: 186, name: "川湖", nameEn: "river/lake", category: "自然" },
  { id: 187, name: "海", nameEn: "sea", category: "自然" },
  { id: 188, name: "水（その他）", nameEn: "water (other)", category: "自然" },
  { id: 189, name: "プール", nameEn: "swimming pool", category: "自然" },
  { id: 190, name: "ウォーターフォール", nameEn: "waterfall", category: "自然" },
  { id: 191, name: "壁", nameEn: "wall", category: "建物・構造" },
  { id: 192, name: "窓", nameEn: "window", category: "建物・構造" },
  { id: 193, name: "ブラインド", nameEn: "window blind", category: "建物・構造" },
];

export const CATEGORIES = [
  "人物",
  "動物",
  "乗り物",
  "家具",
  "電化製品",
  "食品",
  "建物・構造",
  "自然",
  "屋外設備",
  "スポーツ用品",
  "アクセサリー",
  "その他"
] as const;

/**
 * よく使われるクラスID
 */
export const COMMON_CLASS_IDS = [125, 175, 176, 7, 8, 35, 174, 191, 192];

/**
 * カテゴリでフィルタリング
 */
export function filterByCategory(category: string): SemanticClass[] {
  return SEMANTIC_CLASSES.filter(cls => cls.category === category);
}

/**
 * キーワードで検索
 */
export function searchByKeyword(keyword: string): SemanticClass[] {
  const lowerKeyword = keyword.toLowerCase();
  return SEMANTIC_CLASSES.filter(
    cls =>
      cls.name.toLowerCase().includes(lowerKeyword) ||
      cls.nameEn.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * 特定のIDを取得
 */
export function getClassById(id: number): SemanticClass | undefined {
  return SEMANTIC_CLASSES.find(cls => cls.id === id);
}

/**
 * 複数のIDを取得
 */
export function getClassesByIds(ids: number[]): SemanticClass[] {
  return ids.map(id => getClassById(id)).filter((cls): cls is SemanticClass => cls !== undefined);
}
