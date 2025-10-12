/**
 * プロンプトテンプレート管理ユーティリティ
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { PromptTemplate } from '../types/template.js';
import { getDefaultOutputDirectory } from './path.js';

/**
 * テンプレート保存ディレクトリを取得
 * 優先順位:
 * 1. 環境変数 VERTEXAI_IMAGEN_TEMPLATES_DIR
 * 2. 画像出力先フォルダ配下 [VERTEXAI_IMAGEN_OUTPUT_DIR]/templates (デフォルト)
 * 3. プロジェクトレベル ./templates
 * 4. ユーザーレベル ~/.vertexai-imagen/templates
 */
export function getTemplateDirectory(): string {
  // 1. 環境変数
  if (process.env.VERTEXAI_IMAGEN_TEMPLATES_DIR) {
    return process.env.VERTEXAI_IMAGEN_TEMPLATES_DIR;
  }

  // 2. 画像出力先フォルダ配下（デフォルト）
  const outputDir = getDefaultOutputDirectory();
  const defaultTemplateDir = path.join(outputDir, 'templates');

  return defaultTemplateDir;
}

/**
 * テンプレートファイル名のサニタイゼーション
 * パストラバーサル攻撃を防ぐため、英数字・ハイフン・アンダースコアのみ許可
 */
export function sanitizeTemplateName(name: string): string {
  // 許可文字のみ抽出
  const sanitized = name.replace(/[^a-zA-Z0-9\-_]/g, '_');

  if (sanitized !== name) {
    throw new Error(
      `Invalid template name: "${name}". Only alphanumeric characters, hyphens, and underscores are allowed.`
    );
  }

  return sanitized;
}

/**
 * テンプレートファイルのパスを取得
 * 複数のディレクトリを検索
 * 優先順位:
 * 1. 環境変数 VERTEXAI_IMAGEN_TEMPLATES_DIR
 * 2. 画像出力先フォルダ配下 [VERTEXAI_IMAGEN_OUTPUT_DIR]/templates
 * 3. プロジェクトレベル ./templates
 * 4. ユーザーレベル ~/.vertexai-imagen/templates
 */
export async function getTemplateFilePath(templateName: string): Promise<string | null> {
  const sanitized = sanitizeTemplateName(templateName);
  const fileName = `${sanitized}.json`;

  // 検索順序
  const searchPaths: string[] = [];

  // 1. 環境変数
  if (process.env.VERTEXAI_IMAGEN_TEMPLATES_DIR) {
    searchPaths.push(path.join(process.env.VERTEXAI_IMAGEN_TEMPLATES_DIR, fileName));
  }

  // 2. 画像出力先フォルダ配下
  const outputDir = getDefaultOutputDirectory();
  searchPaths.push(path.join(outputDir, 'templates', fileName));

  // 3. プロジェクトレベル
  searchPaths.push(path.join(process.cwd(), 'templates', fileName));

  // 4. ユーザーレベル
  searchPaths.push(path.join(os.homedir(), '.vertexai-imagen', 'templates', fileName));

  // 存在するファイルを探す
  for (const filePath of searchPaths) {
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      // ファイルが存在しない場合は次へ
      continue;
    }
  }

  return null;
}

/**
 * テンプレート文字列から変数を抽出
 * パターン: {variable_name}
 */
export function extractVariables(template: string): string[] {
  const regex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const variables: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    const varName = match[1];
    if (!variables.includes(varName)) {
      variables.push(varName);
    }
  }

  return variables;
}

/**
 * テンプレート文字列に変数を置換
 */
export function substituteVariables(
  template: string,
  values: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{${key}}`;
    result = result.replaceAll(placeholder, value);
  }

  return result;
}

/**
 * 必須変数がすべて提供されているかチェック
 */
export function validateVariables(
  template: string,
  providedValues: Record<string, string>
): { valid: boolean; missing: string[] } {
  const required = extractVariables(template);
  const missing = required.filter(varName => !(varName in providedValues));

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * テンプレートを保存
 */
export async function saveTemplate(template: PromptTemplate): Promise<void> {
  const sanitized = sanitizeTemplateName(template.name);
  const fileName = `${sanitized}.json`;

  // 保存先ディレクトリ（デフォルトまたは環境変数）
  const baseDir = getTemplateDirectory();

  // ディレクトリが存在しない場合は作成
  await fs.mkdir(baseDir, { recursive: true });

  const filePath = path.join(baseDir, fileName);

  // テンプレートを保存
  const data = JSON.stringify(template, null, 2);
  await fs.writeFile(filePath, data, 'utf8');
}

/**
 * テンプレートを読み込み
 */
export async function loadTemplate(templateName: string): Promise<PromptTemplate | null> {
  const filePath = await getTemplateFilePath(templateName);

  if (!filePath) {
    return null;
  }

  try {
    const data = await fs.readFile(filePath, 'utf8');
    const template = JSON.parse(data) as PromptTemplate;
    return template;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load template "${templateName}": ${errorMessage}`);
  }
}

/**
 * テンプレートを削除
 */
export async function deleteTemplate(templateName: string): Promise<boolean> {
  const filePath = await getTemplateFilePath(templateName);

  if (!filePath) {
    return false;
  }

  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to delete template "${templateName}": ${errorMessage}`);
  }
}

/**
 * テンプレート一覧を取得
 * 複数のディレクトリを検索
 * 優先順位:
 * 1. 環境変数 VERTEXAI_IMAGEN_TEMPLATES_DIR
 * 2. 画像出力先フォルダ配下 [VERTEXAI_IMAGEN_OUTPUT_DIR]/templates
 * 3. プロジェクトレベル ./templates
 * 4. ユーザーレベル ~/.vertexai-imagen/templates
 */
export async function listTemplates(
  options?: {
    tags?: string[];
    search?: string;
  }
): Promise<PromptTemplate[]> {
  const templates: PromptTemplate[] = [];

  // 検索するディレクトリ
  const searchDirs: string[] = [];

  // 1. 環境変数
  if (process.env.VERTEXAI_IMAGEN_TEMPLATES_DIR) {
    searchDirs.push(process.env.VERTEXAI_IMAGEN_TEMPLATES_DIR);
  }

  // 2. 画像出力先フォルダ配下
  const outputDir = getDefaultOutputDirectory();
  searchDirs.push(path.join(outputDir, 'templates'));

  // 3. プロジェクトレベル
  searchDirs.push(path.join(process.cwd(), 'templates'));

  // 4. ユーザーレベル
  searchDirs.push(path.join(os.homedir(), '.vertexai-imagen', 'templates'));

  // 各ディレクトリを検索
  for (const dir of searchDirs) {
    try {
      const files = await fs.readdir(dir);

      for (const file of files) {
        if (!file.endsWith('.json')) {
          continue;
        }

        const filePath = path.join(dir, file);

        try {
          const data = await fs.readFile(filePath, 'utf8');
          const template = JSON.parse(data) as PromptTemplate;

          // 重複チェック（名前でユニーク化）
          const exists = templates.some(t => t.name === template.name);
          if (!exists) {
            templates.push(template);
          }
        } catch (error) {
          // JSON パースエラーは無視
          if (process.env.DEBUG) {
            console.error(`[DEBUG] Failed to parse template ${filePath}:`, error);
          }
        }
      }
    } catch (error) {
      // ディレクトリが存在しない場合は無視
      continue;
    }
  }

  // フィルタリング
  let filtered = templates;

  // タグフィルタ
  if (options?.tags && options.tags.length > 0) {
    filtered = filtered.filter(template => {
      if (!template.tags) return false;
      return options.tags!.some(tag => template.tags!.includes(tag));
    });
  }

  // キーワード検索
  if (options?.search) {
    const searchLower = options.search.toLowerCase();
    filtered = filtered.filter(template => {
      return (
        template.name.toLowerCase().includes(searchLower) ||
        template.description.toLowerCase().includes(searchLower) ||
        template.template.toLowerCase().includes(searchLower)
      );
    });
  }

  return filtered;
}

/**
 * テンプレートを更新
 */
export async function updateTemplate(
  templateName: string,
  updates: Partial<PromptTemplate>
): Promise<PromptTemplate> {
  // 既存のテンプレートを読み込み
  const existing = await loadTemplate(templateName);

  if (!existing) {
    throw new Error(`Template "${templateName}" not found`);
  }

  // 更新されたテンプレートを作成
  const updated: PromptTemplate = {
    ...existing,
    ...updates,
    name: existing.name,  // 名前は変更不可
    updated_at: new Date().toISOString(),
  };

  // 変数が更新されていない場合は自動抽出
  if (updates.template && !updates.variables) {
    updated.variables = extractVariables(updates.template);
  }

  // 保存
  await saveTemplate(updated);

  return updated;
}
