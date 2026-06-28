import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

import type { IHttpRequestOptions, JsonObject } from 'n8n-workflow';

/**
 * SiliconFlow（硅基流动）AI 节点 v0.1.0
 *
 * 本节点使用 n8n 内置的 helpers.httpRequestWithAuthentication 直接调用 SiliconFlow
 * 的 OpenAI 兼容 REST API，不引入任何 langchain 或 axios 等三方依赖，从而彻底规避
 * 宿主 n8n 环境的 peer dependency 冲突。
 *
 * 当前版本（v0.1.0）支持：
 *   - Chat Completion  （POST /chat/completions）
 *   - Embedding        （POST /embeddings）
 *
 * 后续版本计划新增：
 *   - Image Generation（POST /images/generations）
 *   - Rerank          （POST /rerank）
 */
export class SiliconFlow implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiliconFlow',
		name: 'siliconFlow',
		icon: 'file:siliconflow.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: '调用 SiliconFlow（硅基流动）AI 能力：Chat Completion / Embedding / Image / Rerank',
		defaults: {
			name: 'SiliconFlow',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'siliconFlowApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}',
			headers: {
				'Content-Type': 'application/json',
			},
		},
		properties: [
			// ============================================================
			// Resource
			// ============================================================
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Chat Completion',
						value: 'chat',
						description: '与大语言模型对话（OpenAI 兼容）',
					},
					{
						name: 'Embedding',
						value: 'embedding',
						description: '将文本转换为向量',
					},
				],
				default: 'chat',
			},

			// ============================================================
			// Chat 相关字段
			// ============================================================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['chat'],
					},
				},
				options: [
					{
						name: 'Send Message',
						value: 'send',
						action: 'Send a chat completion request',
					},
				],
				default: 'send',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'Qwen/Qwen2.5-7B-Instruct',
				required: true,
				description:
					'模型 ID。完整列表：https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions',
				displayOptions: {
					show: {
						resource: ['chat'],
					},
				},
			},
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'json',
				default: '=[{"role":"user","content":"Hello"}]',
				required: true,
				description:
					'OpenAI 格式的 messages 数组。支持 JSON 表达式，可引用上游数据，例如：[{"role":"user","content":"{{$json.text}}"}]',
				displayOptions: {
					show: {
						resource: ['chat'],
					},
				},
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['chat'],
					},
				},
				options: [
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						default: 0.7,
						typeOptions: {
							minValue: 0,
							maxValue: 2,
						},
						description: '采样温度，0 表示更确定，2 表示更发散',
					},
					{
						displayName: 'Max Tokens',
						name: 'max_tokens',
						type: 'number',
						default: 512,
						description: '生成的最大 token 数',
					},
					{
						displayName: 'Top P',
						name: 'top_p',
						type: 'number',
						default: 0.9,
						typeOptions: {
							minValue: 0,
							maxValue: 1,
						},
					},
					{
						displayName: 'Stream',
						name: 'stream',
						type: 'boolean',
						default: false,
						description: '是否启用流式响应（启用时本节点仍按非流式处理，因为 n8n 不支持边收边发）',
					},
				],
			},

			// ============================================================
			// Embedding 相关字段
			// ============================================================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['embedding'],
					},
				},
				options: [
					{
						name: 'Create Embeddings',
						value: 'create',
						action: 'Create embeddings',
					},
				],
				default: 'create',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'BAAI/bge-m3',
				required: true,
				description: 'Embedding 模型 ID，例如 BAAI/bge-m3、Pro/BAAI/bge-m3',
				displayOptions: {
					show: {
						resource: ['embedding'],
					},
				},
			},
			{
				displayName: 'Input',
				name: 'input',
				type: 'json',
				default: '="hello"',
				required: true,
				description:
					'要编码的文本。可为单个字符串（如 "hello"）或字符串数组（如 ["text1","text2"]）。支持 JSON 表达式，可引用上游 {{$json.texts}}。',
				displayOptions: {
					show: {
						resource: ['embedding'],
					},
				},
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['embedding'],
					},
				},
				options: [
					{
						displayName: 'Encoding Format',
						name: 'encoding_format',
						type: 'options',
						default: 'float',
						options: [
							{ name: 'Float', value: 'float' },
							{ name: 'Base64', value: 'base64' },
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData: IDataObject;

				if (resource === 'chat') {
					responseData = await handleChat(this, i);
				} else if (resource === 'embedding') {
					responseData = await handleEmbedding(this, i);
				} else {
					throw new NodeOperationError(this.getNode(), `未知的 Resource: ${resource}`, {
						itemIndex: i,
					});
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData as JsonObject),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

// ----------------------------------------------------------------
// Helper functions（独立于类外，正确接收 IExecuteFunctions 上下文）
// ----------------------------------------------------------------

/**
 * Chat Completion 处理函数
 */
async function handleChat(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const model = ctx.getNodeParameter('model', itemIndex) as string;
	const messages = ctx.getNodeParameter('messages', itemIndex) as IDataObject[];
	const additionalOptions = ctx.getNodeParameter(
		'additionalOptions',
		itemIndex,
		{},
	) as IDataObject;

	const body: IDataObject = {
		model,
		messages,
		stream: false,
	};

	if (typeof additionalOptions.temperature === 'number') {
		body.temperature = additionalOptions.temperature;
	}
	if (typeof additionalOptions.max_tokens === 'number') {
		body.max_tokens = additionalOptions.max_tokens;
	}
	if (typeof additionalOptions.top_p === 'number') {
		body.top_p = additionalOptions.top_p;
	}

	const requestOptions: IHttpRequestOptions = {
		method: 'POST',
		url: '/chat/completions',
		body,
		json: true,
	};

	return (await ctx.helpers.httpRequestWithAuthentication.call(
		ctx,
		'siliconFlowApi',
		requestOptions,
	)) as IDataObject;
}

/**
 * Embedding 处理函数
 */
async function handleEmbedding(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const model = ctx.getNodeParameter('model', itemIndex) as string;
	const inputRaw = ctx.getNodeParameter('input', itemIndex) as unknown;
	const additionalOptions = ctx.getNodeParameter(
		'additionalOptions',
		itemIndex,
		{},
	) as IDataObject;

	// input 可能是字符串或字符串数组；优先按 JSON 解析
	let input: string | string[];
	if (typeof inputRaw === 'string') {
		const trimmed = inputRaw.trim();
		if (trimmed.startsWith('[')) {
			try {
				const parsed = JSON.parse(trimmed);
				if (Array.isArray(parsed)) {
					input = parsed as string[];
				} else {
					input = trimmed;
				}
			} catch {
				input = trimmed;
			}
		} else {
			input = trimmed;
		}
	} else if (Array.isArray(inputRaw)) {
		input = inputRaw as string[];
	} else {
		input = String(inputRaw);
	}

	const body: IDataObject = { model, input };
	if (additionalOptions.encoding_format) {
		body.encoding_format = additionalOptions.encoding_format;
	}

	const requestOptions: IHttpRequestOptions = {
		method: 'POST',
		url: '/embeddings',
		body,
		json: true,
	};

	return (await ctx.helpers.httpRequestWithAuthentication.call(
		ctx,
		'siliconFlowApi',
		requestOptions,
	)) as IDataObject;
}
