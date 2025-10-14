/**
 * YAML設定ファイルの解析ユーティリティ
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { CustomizeImageYamlConfig } from '../types/yamlConfig.js';
import type { CustomizeImageArgs } from '../types/tools.js';
import { normalizeAndValidatePath, validatePathWithinBase } from './path.js';
import { getTemplateDirectory } from './templateManager.js';

/**
 * YAML文字列をパースする
 */
export function parseYamlString(yamlContent: string): CustomizeImageYamlConfig {
  try {
    // YAMLパース
    const config = yaml.load(yamlContent) as CustomizeImageYamlConfig;

    if (!config || typeof config !== 'object') {
      throw new Error('Invalid YAML structure: root must be an object');
    }

    return config;
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `YAML syntax error: ${error.message}`
      );
    }

    throw new McpError(
      ErrorCode.InvalidParams,
      `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * YAMLファイルを読み込んでパースする
 * デフォルトの読込フォルダはJSONテンプレートフォルダ
 * パストラバーサル攻撃を防ぐため、設定されているフォルダ階層より上へはアクセスできない
 */
export async function loadYamlConfig(yamlPath: string): Promise<CustomizeImageYamlConfig> {
  try {
    // YAMLファイルのベースディレクトリをテンプレートフォルダとする
    const yamlBaseDir = getTemplateDirectory();

    // パス解決: 絶対パスまたは相対パス
    const absoluteYamlPath = path.isAbsolute(yamlPath)
      ? yamlPath
      : path.join(yamlBaseDir, yamlPath);

    // Security: Validate path is within base directory (prevent path traversal)
    validatePathWithinBase(absoluteYamlPath, yamlBaseDir);

    // YAMLファイル読み込み
    const yamlContent = await fs.readFile(absoluteYamlPath, 'utf8');

    // YAMLパース（共通関数を使用）
    return parseYamlString(yamlContent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new McpError(
        ErrorCode.InvalidParams,
        `YAML file not found: ${yamlPath}\n` +
        `Default YAML directory: ${getTemplateDirectory()}`
      );
    }

    // McpError はそのまま throw
    if (error instanceof McpError) {
      throw error;
    }

    throw error;
  }
}

/**
 * YAML設定の必須フィールドを検証
 */
export function validateYamlConfig(config: CustomizeImageYamlConfig): void {
  const errors: string[] = [];

  // 必須フィールドのチェック
  if (!config.model) {
    errors.push('model is required');
  }

  if (!config.output_path) {
    errors.push('output_path is required');
  }

  if (!config.prompt) {
    errors.push('prompt is required');
  }

  // 参照画像が少なくとも1つ必要
  const hasSubjects = config.subjects && config.subjects.length > 0;
  const hasControl = config.control !== undefined;
  const hasStyle = config.style !== undefined;

  if (!hasSubjects && !hasControl && !hasStyle) {
    errors.push('At least one reference image type must be provided (subjects, control, or style)');
  }

  // Subjects の検証
  if (config.subjects) {
    config.subjects.forEach((subject, index) => {
      if (subject.reference_id === undefined || subject.reference_id === null) {
        errors.push(`subjects[${index}].reference_id is required`);
      }

      if (!subject.images || subject.images.length === 0) {
        errors.push(`subjects[${index}].images is required and must not be empty`);
      }

      if (!subject.config) {
        errors.push(`subjects[${index}].config is required`);
      } else {
        if (!subject.config.type) {
          errors.push(`subjects[${index}].config.type is required`);
        }
        if (!subject.config.description) {
          errors.push(`subjects[${index}].config.description is required`);
        }
      }
    });
  }

  // Control の検証
  if (config.control) {
    if (config.control.reference_id === undefined || config.control.reference_id === null) {
      errors.push('control.reference_id is required');
    }

    if (!config.control.image_path) {
      errors.push('control.image_path is required');
    }

    if (!config.control.type) {
      errors.push('control.type is required');
    }
  }

  // Style の検証
  if (config.style) {
    if (config.style.reference_id === undefined || config.style.reference_id === null) {
      errors.push('style.reference_id is required');
    }

    if (!config.style.image_path) {
      errors.push('style.image_path is required');
    }

    // style.description は省略可能
  }

  // reference_id の重複チェック（異なるタイプ間）
  const referenceIds: { id: number; type: string }[] = [];

  if (config.subjects) {
    config.subjects.forEach(subject => {
      referenceIds.push({ id: subject.reference_id, type: 'SUBJECT' });
    });
  }

  if (config.control) {
    referenceIds.push({ id: config.control.reference_id, type: 'CONTROL' });
  }

  if (config.style) {
    referenceIds.push({ id: config.style.reference_id, type: 'STYLE' });
  }

  // 重複チェック
  const idMap = new Map<number, string[]>();
  referenceIds.forEach(({ id, type }) => {
    if (!idMap.has(id)) {
      idMap.set(id, []);
    }
    idMap.get(id)!.push(type);
  });

  idMap.forEach((types, id) => {
    if (types.length > 1) {
      // 同じSUBJECT同士は許可
      const uniqueTypes = Array.from(new Set(types));
      if (uniqueTypes.length > 1 || uniqueTypes[0] !== 'SUBJECT') {
        errors.push(
          `reference_id ${id} is used by multiple types: ${types.join(', ')}. ` +
          `Each reference_id must be unique across different types.`
        );
      }
    }
  });

  if (errors.length > 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `YAML validation errors:\n${errors.map(e => `  - ${e}`).join('\n')}`
    );
  }
}

/**
 * subject_type の正規化（省略形 → API形式）
 */
function normalizeSubjectType(type: string): string {
  const typeMap: Record<string, string> = {
    'person': 'person',
    'animal': 'animal',
    'product': 'product',
    'default': 'default',
    'SUBJECT_TYPE_PERSON': 'person',
    'SUBJECT_TYPE_ANIMAL': 'animal',
    'SUBJECT_TYPE_PRODUCT': 'product',
    'SUBJECT_TYPE_DEFAULT': 'default',
  };

  return typeMap[type] || type;
}

/**
 * control_type の正規化
 */
function normalizeControlType(type: string): string {
  const typeMap: Record<string, string> = {
    'face_mesh': 'face_mesh',
    'canny': 'canny',
    'scribble': 'scribble',
    'CONTROL_TYPE_FACE_MESH': 'face_mesh',
    'CONTROL_TYPE_CANNY': 'canny',
    'CONTROL_TYPE_SCRIBBLE': 'scribble',
  };

  return typeMap[type] || type;
}

/**
 * YAML設定を CustomizeImageArgs に変換
 */
export async function convertYamlToArgs(
  config: CustomizeImageYamlConfig
): Promise<CustomizeImageArgs> {
  const args: CustomizeImageArgs = {
    prompt: config.prompt,
    output_path: config.output_path,
    model: config.model as "imagen-3.0-capability-001" | undefined,
  };

  // Optional basic parameters
  if (config.aspect_ratio) args.aspect_ratio = config.aspect_ratio;
  if (config.sample_image_size) args.sample_image_size = config.sample_image_size;
  if (config.sample_count !== undefined) args.sample_count = config.sample_count;
  if (config.safety_level) args.safety_level = config.safety_level;
  if (config.person_generation) args.person_generation = config.person_generation;
  if (config.language) args.language = config.language;
  if (config.negative_prompt) args.negative_prompt = config.negative_prompt;
  if (config.region) args.region = config.region;
  if (config.return_base64 !== undefined) args.return_base64 = config.return_base64;
  if (config.include_thumbnail !== undefined) args.include_thumbnail = config.include_thumbnail;

  // Subject images の変換
  if (config.subjects && config.subjects.length > 0) {
    // すべての subject 画像を統合（reference_id ごとにグループ化）
    const subjectGroups = new Map<number, typeof config.subjects[0]>();

    config.subjects.forEach(subject => {
      if (!subjectGroups.has(subject.reference_id)) {
        subjectGroups.set(subject.reference_id, subject);
      } else {
        // 同じ reference_id の場合、画像を追加
        const existing = subjectGroups.get(subject.reference_id)!;
        existing.images.push(...subject.images);
      }
    });

    // 最初の subject グループを使用（現在の customizeImage API は1グループのみサポート）
    const firstSubject = Array.from(subjectGroups.values())[0];

    // 画像パスの解決と配列構築
    args.subject_images = await Promise.all(
      firstSubject.images.map(async (imagePath) => {
        // 相対パスの場合は正規化（入力パスなので autoNumbering: false）
        const normalizedPath = await normalizeAndValidatePath(imagePath, false);
        return { image_path: normalizedPath };
      })
    );

    // description は必須
    args.subject_description = firstSubject.config.description;

    args.subject_type = normalizeSubjectType(firstSubject.config.type) as any;

    // 警告: 複数の subject グループがある場合
    if (subjectGroups.size > 1 && process.env.DEBUG) {
      console.error(
        `[WARNING] Multiple subject groups detected (${subjectGroups.size}). ` +
        `Only the first group (reference_id: ${firstSubject.reference_id}) will be used.`
      );
    }
  }

  // Control image の変換
  if (config.control) {
    // 入力パスなので autoNumbering: false
    const normalizedPath = await normalizeAndValidatePath(config.control.image_path, false);
    args.control_image_path = normalizedPath;
    args.control_type = normalizeControlType(config.control.type) as any;

    if (config.control.enable_computation !== undefined) {
      args.enable_control_computation = config.control.enable_computation;
    }
  }

  // Style image の変換
  if (config.style) {
    // 入力パスなので autoNumbering: false
    const normalizedPath = await normalizeAndValidatePath(config.style.image_path, false);
    args.style_image_path = normalizedPath;

    // description は省略可能
    if (config.style.description) {
      args.style_description = config.style.description;
    }
  }

  return args;
}

/**
 * YAML文字列から CustomizeImageArgs を生成
 */
export async function parseYamlStringToCustomizeArgs(
  yamlContent: string
): Promise<CustomizeImageArgs> {
  // 1. YAML文字列をパース
  const config = parseYamlString(yamlContent);

  // 2. バリデーション
  validateYamlConfig(config);

  // 3. CustomizeImageArgs に変換
  const args = await convertYamlToArgs(config);

  if (process.env.DEBUG) {
    console.error('[DEBUG] YAML string parsed successfully');
    console.error('[DEBUG] Subjects:', args.subject_images?.length || 0);
    console.error('[DEBUG] Control:', !!args.control_image_path);
    console.error('[DEBUG] Style:', !!args.style_image_path);
  }

  return args;
}

/**
 * YAMLファイルから CustomizeImageArgs を生成（メイン関数）
 */
export async function parseYamlToCustomizeArgs(
  yamlPath: string
): Promise<CustomizeImageArgs> {
  // 1. YAMLファイル読み込み
  const config = await loadYamlConfig(yamlPath);

  // 2. バリデーション
  validateYamlConfig(config);

  // 3. CustomizeImageArgs に変換
  const args = await convertYamlToArgs(config);

  if (process.env.DEBUG) {
    console.error('[DEBUG] YAML parsed successfully');
    console.error('[DEBUG] Subjects:', args.subject_images?.length || 0);
    console.error('[DEBUG] Control:', !!args.control_image_path);
    console.error('[DEBUG] Style:', !!args.style_image_path);
  }

  return args;
}
