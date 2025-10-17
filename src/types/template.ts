/**
 * プロンプトテンプレート管理システムの型定義
 */

/**
 * プロンプトテンプレート
 */
export interface PromptTemplate {
  name: string;
  description: string;
  template: string;  // プロンプトテンプレート文字列（例: "A portrait of {subject}, {style}"）
  variables: string[];  // テンプレート内の変数リスト（例: ["subject", "style"]）
  default_params?: {
    aspect_ratio?: string;
    person_generation?: string;
    model?: string;
    safety_level?: string;
    language?: string;
    sample_count?: number;
    sample_image_size?: string;
    [key: string]: any;
  };
  tags?: string[];
  created_at?: string;  // ISO 8601形式
  updated_at?: string;  // ISO 8601形式
}

/**
 * save_prompt_template ツールの引数
 */
export interface SavePromptTemplateArgs {
  name: string;
  description: string;
  template: string;
  variables?: string[];  // 省略時は自動抽出
  default_params?: Record<string, any>;
  tags?: string[];
}

/**
 * list_prompt_templates ツールの引数
 */
export interface ListPromptTemplatesArgs {
  tags?: string[];  // タグフィルタ（いずれかに一致）
  search?: string;  // キーワード検索（name, description, templateを検索）
}

/**
 * get_template_detail ツールの引数
 */
export interface GetTemplateDetailArgs {
  template_name: string;
}

/**
 * generate_from_template ツールの引数
 */
export interface GenerateFromTemplateArgs {
  template_name: string;
  variable_values: Record<string, any>;  // 変数名と値のマッピング（文字列化される）
  override_params?: Record<string, any>;  // default_paramsを上書き
}

/**
 * delete_template ツールの引数
 */
export interface DeleteTemplateArgs {
  template_name: string;
}

/**
 * update_template ツールの引数
 */
export interface UpdateTemplateArgs {
  template_name: string;
  description?: string;
  template?: string;
  variables?: string[];
  default_params?: Record<string, any>;
  tags?: string[];
}
