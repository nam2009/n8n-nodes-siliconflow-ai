import type { INodeProperties } from 'n8n-workflow';

/**
 * SiliconFlow（硅基流动）常用模型清单。
 *
 * 说明：SiliconFlow 的模型清单会随时间上下架，这里只收录"常用且稳定"的模型 ID。
 * 任何未列入的模型（含新上线或即将下架的）都可通过节点里的 "By ID" 模式手动填写，
 * 因此本清单无需保持 100% 最新。
 *
 * 清单来源：用户按 https://cloud.siliconflow.cn/me/models 整理（2026-06）。
 */

// ----------------------------------------------------------------
// Chat（对话 / 文本生成）模型 —— 用于 SiliconFlow 节点 Chat 资源 + Chat Model 节点
// ----------------------------------------------------------------
export const CHAT_MODEL_IDS: string[] = [
	'zai-org/GLM-5.2',
	'Pro/zai-org/GLM-5.1',
	'moonshotai/Kimi-K2.7-Code',
	'Pro/moonshotai/Kimi-K2.6',
	'deepseek-ai/DeepSeek-V4-Pro',
	'deepseek-ai/DeepSeek-V4-Flash',
	'deepseek-ai/DeepSeek-V3.2',
	'Pro/deepseek-ai/DeepSeek-V3.2',
	'deepseek-ai/DeepSeek-R1',
	'nex-agi/Nex-N2-Pro',
	'MiniMaxAI/MiniMax-M2.5',
	'Pro/MiniMaxAI/MiniMax-M2.5',
	'Qwen/Qwen3.6-35B-A3B',
	'Qwen/Qwen3.6-27B',
	'Qwen/Qwen3.5-397B-A17B',
	'Qwen/Qwen3.5-122B-A10B',
	'PaddlePaddle/PaddleOCR-VL-1.5',
	'stepfun-ai/Step-3.5-Flash',
	'inclusionAI/Ling-mini-2.0',
	'tencent/Hunyuan-MT-7B',
	'ByteDance-Seed/Seed-OSS-36B-Instruct',
];

// ----------------------------------------------------------------
// Vision（视觉 / 多模态）模型 —— SiliconFlow 节点 Vision 资源
// ----------------------------------------------------------------
export const VISION_MODEL_IDS: string[] = [
	'Qwen/Qwen3-VL-32B-Instruct',
	'Qwen/Qwen3-VL-32B-Thinking',
	'Qwen/Qwen3-Omni-30B-A3B-Instruct',
	'Qwen/Qwen3-Omni-30B-A3B-Thinking',
	'Qwen/Qwen3-Omni-30B-A3B-Captioner',
	'zai-org/GLM-4.5V',
	'deepseek-ai/DeepSeek-OCR',
	'nex-agi/Nex-N2-Pro',
	'moonshotai/Kimi-K2.7-Code',
	'Pro/moonshotai/Kimi-K2.6',
	'Qwen/Qwen3.6-35B-A3B',
	'Qwen/Qwen3.6-27B',
	'Qwen/Qwen3.5-397B-A17B',
	'Qwen/Qwen3.5-122B-A10B',
];

// ----------------------------------------------------------------
// Embedding（向量）模型 —— SiliconFlow 节点 Embeddings 资源
// ----------------------------------------------------------------
export const EMBEDDING_MODEL_IDS: string[] = [
	'Qwen/Qwen3-VL-Embedding-8B',
	'Qwen/Qwen3-Embedding-8B',
	'Qwen/Qwen3-Embedding-4B',
	'Qwen/Qwen3-Embedding-0.6B',
	'BAAI/bge-m3',
	'Pro/BAAI/bge-m3',
	'BAAI/bge-large-zh-v1.5',
	'BAAI/bge-large-en-v1.5',
];

// ----------------------------------------------------------------
// Image（文生图）模型 —— SiliconFlow 节点 Image 资源
// ----------------------------------------------------------------
export const IMAGE_MODEL_IDS: string[] = [
	'Tongyi-MAI/Z-Image-Turbo',
	'Tongyi-MAI/Z-Image',
	'baidu/ERNIE-Image-Turbo',
	'Qwen/Qwen-Image',
	'Qwen/Qwen-Image-Edit',
	'Qwen/Qwen-Image-Edit-2509',
	'Kwai-Kolors/Kolors',
];

// ----------------------------------------------------------------
// Rerank（重排）模型 —— SiliconFlow 节点 Rerank 资源
// ----------------------------------------------------------------
export const RERANK_MODEL_IDS: string[] = [
	'Qwen/Qwen3-VL-Reranker-8B',
	'Qwen/Qwen3-Reranker-8B',
	'Qwen/Qwen3-Reranker-4B',
	'Qwen/Qwen3-Reranker-0.6B',
	'BAAI/bge-reranker-v2-m3',
	'Pro/BAAI/bge-reranker-v2-m3',
];

/** 把 ID 数组转成 n8n options（显示名 = ID，值 = ID，所见即所发）。 */
function toOptions(ids: string[]) {
	return ids.map((id) => ({ name: id, value: id }));
}

/**
 * 生成一组"模型选择"参数：模式切换(From List / By ID) + 列表选择 + 自定义 ID 输入。
 *
 * 返回 3 个 INodeProperties：
 *   - {modeName}: options  ['list' | 'id']
 *   - {listName}: options  （仅 mode=list 时显示）
 *   - {idName}:   string   （仅 mode=id 时显示，支持表达式）
 *
 * @param show 资源/操作门控条件（displayOptions.show），会与 mode 条件合并
 */
export function buildModelSelectionFields(params: {
	modeName: string;
	listName: string;
	idName: string;
	displayName?: string;
	ids: string[];
	show: Record<string, string[]>;
	defaultList?: string;
}): INodeProperties[] {
	const { modeName, listName, idName, ids, show, defaultList } = params;
	const displayName = params.displayName ?? 'Model';

	return [
		{
			displayName: 'Model Selection',
			name: modeName,
			type: 'options',
			noDataExpression: true,
			displayOptions: { show },
			options: [
				{ name: 'From List', value: 'list', description: '从常用模型列表中选择' },
				{ name: 'By ID', value: 'id', description: '手动输入任意模型 ID（用于列表中未收录的模型）' },
			],
			default: 'list',
		},
		{
			displayName: displayName,
			name: listName,
			type: 'options',
			noDataExpression: true,
			displayOptions: { show: { ...show, [modeName]: ['list'] } },
			options: toOptions(ids),
			default: defaultList ?? ids[0],
			description: '从常用模型列表中选择。若所需模型不在列表，请将上方 "Model Selection" 切换为 By ID。',
		},
		{
			displayName: displayName,
			name: idName,
			type: 'string',
			displayOptions: { show: { ...show, [modeName]: ['id'] } },
			default: '',
			placeholder: '例如 deepseek-ai/DeepSeek-V3.2',
			description: '手动输入模型 ID（支持表达式，如 {{$json.model}}）。',
		},
	];
}

/**
 * 根据模式解析出实际要使用的模型 ID。
 * mode=list 时取列表选择值；mode=id 时取自定义输入值。
 */
export function resolveModelId(
	ctx: { getNodeParameter: (name: string, itemIndex: number, fallback?: unknown) => unknown },
	itemIndex: number,
	modeName: string,
	listName: string,
	idName: string,
): string {
	const mode = ctx.getNodeParameter(modeName, itemIndex, 'list') as string;
	if (mode === 'id') {
		const id = ctx.getNodeParameter(idName, itemIndex, '') as string;
		if (!id || !id.trim()) {
			throw new Error('Model ID is required when using "By ID" mode');
		}
		return id.trim();
	}
	return ctx.getNodeParameter(listName, itemIndex, '') as string;
}
