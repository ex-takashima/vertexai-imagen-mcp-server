import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  SEMANTIC_CLASSES,
  CATEGORIES,
  COMMON_CLASS_IDS,
  filterByCategory,
  searchByKeyword,
  getClassesByIds,
} from '../data/semantic-classes.js';
import type { ListSemanticClassesArgs } from '../types/tools.js';
import type { ToolContext } from './types.js';

export async function listSemanticClasses(
  _context: ToolContext,
  args: ListSemanticClassesArgs,
) {
  const { category, search, ids } = args;

  try {
    let results = SEMANTIC_CLASSES;
    let filterDescription = '';

    if (ids && ids.length > 0) {
      const classes = getClassesByIds(ids);
      if (classes.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No semantic classes found for IDs: ${ids.join(', ')}\n\nValid IDs range from 0 to 193.`,
            },
          ],
        };
      }

      const classesText = classes
        .map((cls) => `${cls.id}: ${cls.name} (${cls.nameEn}) - カテゴリ: ${cls.category}`)
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `セマンティッククラス詳細 (${classes.length}件):\n\n${classesText}\n\n💡 これらのIDを edit_image の mask_classes パラメータに指定して使用できます。`,
          },
        ],
      };
    }

    if (category) {
      results = filterByCategory(category);
      filterDescription = `カテゴリ「${category}」`;

      if (results.length === 0) {
        const availableCategories = CATEGORIES.join(', ');
        return {
          content: [
            {
              type: 'text',
              text: `カテゴリ「${category}」に該当するクラスが見つかりません。\n\n利用可能なカテゴリ:\n${availableCategories}`,
            },
          ],
        };
      }
    }

    if (search) {
      results = searchByKeyword(search);
      filterDescription = filterDescription
        ? `${filterDescription}、キーワード「${search}」`
        : `キーワード「${search}」`;

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `「${search}」に一致するクラスが見つかりません。\n\n💡 ヒント: 日本語または英語で検索できます（例: 「車」「car」「人物」「person」）`,
            },
          ],
        };
      }
    }

    if (filterDescription) {
      const classesText = results
        .map((cls) => `  ${cls.id}: ${cls.name} (${cls.nameEn})`)
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `セマンティッククラス検索結果 (${filterDescription}):\n\n${classesText}\n\n検索結果: ${results.length}件\n\n💡 これらのIDを edit_image の mask_classes パラメータに指定して使用できます。`,
          },
        ],
      };
    }

    const commonClassesText = COMMON_CLASS_IDS
      .map((id) => {
        const cls = SEMANTIC_CLASSES.find((c) => c.id === id);
        return cls ? `  ${cls.id}: ${cls.name} (${cls.nameEn})` : '';
      })
      .filter(Boolean)
      .join('\n');

    const groupedByCategory = CATEGORIES.map((cat) => {
      const classes = filterByCategory(cat);
      const classesText = classes
        .map((cls) => `  ${cls.id}: ${cls.name} (${cls.nameEn})`)
        .join('\n');
      return `【${cat}】\n${classesText}`;
    }).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `セマンティッククラスID一覧 (全${SEMANTIC_CLASSES.length}クラス)\n\n━━━━━━━━━━━━━━━━━━━━\n⭐ よく使われるクラスID\n━━━━━━━━━━━━━━━━━━━━\n${commonClassesText}\n\n━━━━━━━━━━━━━━━━━━━━\n📋 全クラス一覧（カテゴリ別）\n━━━━━━━━━━━━━━━━━━━━\n\n${groupedByCategory}\n\n💡 使い方:\n• カテゴリで絞り込み: category パラメータを指定\n• キーワード検索: search パラメータで日本語/英語検索\n• 特定IDの詳細: ids パラメータで配列指定 (例: [125, 175, 176])\n• edit_image ツールの mask_classes パラメータで使用可能`,
        },
      ],
    };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to list semantic classes: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
