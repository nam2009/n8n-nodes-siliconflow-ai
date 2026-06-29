import {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import FormData from 'form-data';
import {
	buildModelSelectionFields,
	ASR_MODEL_IDS,
	CHAT_MODEL_IDS,
	EMBEDDING_MODEL_IDS,
	IMAGE_MODEL_IDS,
	resolveModelId,
	RERANK_MODEL_IDS,
	TTS_MODEL_IDS,
	VISION_MODEL_IDS,
} from '../shared/models';

/**
 * SiliconFlow（硅基流动）AI 节点
 *
 * 本节点使用 n8n 内置的 helpers.httpRequestWithAuthentication 直接调用 SiliconFlow
 * 的 OpenAI 兼容 REST API，不引入任何 langchain / axios 等三方运行时依赖，从而彻底
 * 规避宿主 n8n 环境的 peer dependency（ERESOLVE）冲突。
 *
 * 支持的资源：
 *   - Chat Completion  （POST /chat/completions）
 *   - Vision           （POST /chat/completions，多模态图片理解）
 *   - Embeddings       （POST /embeddings）
 *   - Image Generation （POST /images/generations）
 *   - Rerank           （POST /rerank）
 *   - Audio            （POST /audio/speech 文生语音 · POST /audio/transcriptions 语音转写）
 */
export class SiliconFlow implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SiliconFlow',
		name: 'siliconFlow',
		icon: 'file:siliconflow.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with SiliconFlow AI models (Chat / Vision / Embeddings / Image / Rerank / Audio)',
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
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Chat', value: 'chat' },
					{
						name: 'Vision',
						value: 'vision',
						description: 'Vision language model with image understanding',
					},
					{ name: 'Embeddings', value: 'embeddings' },
					{ name: 'Image', value: 'image' },
					{ name: 'Rerank', value: 'rerank' },
					{ name: 'Audio', value: 'audio' },
				],
				default: 'chat',
			},

			// ---------------- Chat ----------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['chat'] } },
				options: [
					{
						name: 'Complete',
						value: 'complete',
						description: 'Create a chat completion',
						action: 'Create a chat completion',
					},
				],
				default: 'complete',
			},
			...buildModelSelectionFields({
				modeName: 'modelMode',
				listName: 'model',
				idName: 'modelId',
				ids: CHAT_MODEL_IDS,
				show: { resource: ['chat'], operation: ['complete'] },
				defaultList: 'deepseek-ai/DeepSeek-V3.2',
			}),
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'fixedCollection',
				displayOptions: { show: { resource: ['chat'], operation: ['complete'] } },
				default: {},
				typeOptions: { multipleValues: true },
				options: [
					{
						name: 'messageValues',
						displayName: 'Message',
						values: [
							{
								displayName: 'Role',
								name: 'role',
								type: 'options',
								options: [
									{ name: 'System', value: 'system' },
									{ name: 'User', value: 'user' },
									{ name: 'Assistant', value: 'assistant' },
								],
								default: 'user',
							},
							{
								displayName: 'Content',
								name: 'content',
								type: 'string',
								default: '',
								typeOptions: { rows: 3 },
							},
						],
					},
				],
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				displayOptions: { show: { resource: ['chat'], operation: ['complete'] } },
				default: '',
				description: 'Simple prompt text (alternative to messages)',
				typeOptions: { rows: 3 },
			},
			{
				displayName: 'Output Mode',
				name: 'outputMode',
				type: 'options',
				displayOptions: { show: { resource: ['chat'], operation: ['complete'] } },
				options: [
					{
						name: 'Simple (Message Only)',
						value: 'simple',
						description: 'Return only the message content as a string',
					},
					{
						name: 'Detailed (With Metadata)',
						value: 'detailed',
						description: 'Return structured object with message, usage, and metadata',
					},
				],
				default: 'simple',
				description: 'Choose the output format',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['chat'], operation: ['complete'] } },
				options: [
					{
						displayName: 'Max Tokens',
						name: 'max_tokens',
						type: 'number',
						default: 512,
						typeOptions: { minValue: 1, maxValue: 32768 },
						description: 'The maximum number of tokens to generate (1-32768)',
					},
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						default: 0.7,
						typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 2 },
					},
					{
						displayName: 'Top P',
						name: 'top_p',
						type: 'number',
						default: 0.7,
						typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
					},
					{
						displayName: 'Top K',
						name: 'top_k',
						type: 'number',
						default: 50,
					},
					{
						displayName: 'Min P',
						name: 'min_p',
						type: 'number',
						default: 0.05,
						typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 3 },
						description: 'Dynamic filtering threshold for Qwen3 models (0-1)',
					},
					{
						displayName: 'Frequency Penalty',
						name: 'frequency_penalty',
						type: 'number',
						default: 0.5,
						typeOptions: { numberPrecision: 2 },
					},
					{
						displayName: 'Presence Penalty',
						name: 'presence_penalty',
						type: 'number',
						default: 0,
						typeOptions: { numberPrecision: 1, maxValue: 2, minValue: -2 },
					},
					{
						displayName: 'Number of Generations',
						name: 'n',
						type: 'number',
						default: 1,
					},
					{
						displayName: 'Enable Thinking',
						name: 'enable_thinking',
						type: 'boolean',
						default: true,
						description:
							'Switches between thinking and non-thinking modes (applies to Qwen3 and Hunyuan models)',
					},
					{
						displayName: 'Thinking Budget',
						name: 'thinking_budget',
						type: 'number',
						default: 4096,
						typeOptions: { minValue: 128, maxValue: 32768 },
						description: 'Maximum tokens for chain-of-thought output (128-32768, reasoning models)',
					},
					{
						displayName: 'Stop Sequences',
						name: 'stop',
						type: 'string',
						default: '',
						description: 'Up to 4 sequences where the API will stop generating (comma-separated)',
					},
					{
						displayName: 'Stream',
						name: 'stream',
						type: 'boolean',
						default: false,
						description: 'Whether to stream back partial progress as Server-Sent Events',
					},
					{
						displayName: 'Response Format',
						name: 'response_format',
						type: 'fixedCollection',
						default: {},
						description: 'Format specification for the model output',
						options: [
							{
								name: 'formatValues',
								displayName: 'Format',
								values: [
									{
										displayName: 'Type',
										name: 'type',
										type: 'options',
										options: [
											{ name: 'Text', value: 'text' },
											{ name: 'JSON Object', value: 'json_object' },
										],
										default: 'text',
									},
								],
							},
						],
					},
				],
			},

			// ---------------- Vision ----------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['vision'] } },
				options: [
					{
						name: 'Analyze',
						value: 'analyze',
						description: 'Analyze images with vision language model',
						action: 'Analyze images with vision language model',
					},
				],
				default: 'analyze',
			},
			...buildModelSelectionFields({
				modeName: 'visionModelMode',
				listName: 'visionModel',
				idName: 'visionModelId',
				ids: VISION_MODEL_IDS,
				show: { resource: ['vision'], operation: ['analyze'] },
				defaultList: 'Qwen/Qwen3-VL-32B-Instruct',
			}),
			{
				displayName: 'Images',
				name: 'images',
				type: 'fixedCollection',
				displayOptions: { show: { resource: ['vision'], operation: ['analyze'] } },
				default: {},
				description: 'Images to analyze (supports binary data, URLs, or base64)',
				typeOptions: { multipleValues: true, maxValue: 9 },
				options: [
					{
						name: 'imageValues',
						displayName: 'Image',
						values: [
							{
								displayName: 'Image Source',
								name: 'imageSource',
								type: 'options',
								options: [
									{ name: 'Binary Data', value: 'binary', description: 'Use binary data from previous node' },
									{ name: 'URL', value: 'url', description: 'Use image URL' },
									{ name: 'Base64', value: 'base64', description: 'Use base64 encoded image' },
								],
								default: 'binary',
							},
							{
								displayName: 'Binary Property',
								name: 'binaryProperty',
								type: 'string',
								displayOptions: { show: { imageSource: ['binary'] } },
								default: 'data',
								description: 'Name of the binary property containing the image',
							},
							{
								displayName: 'Image URL',
								name: 'imageUrl',
								type: 'string',
								displayOptions: { show: { imageSource: ['url'] } },
								default: '',
								placeholder: 'https://example.com/image.jpg',
							},
							{
								displayName: 'Base64 Data',
								name: 'base64Data',
								type: 'string',
								displayOptions: { show: { imageSource: ['base64'] } },
								default: '',
								description: 'Base64 encoded image data (without data:image prefix)',
								typeOptions: { rows: 4 },
							},
							{
								displayName: 'Image Format',
								name: 'imageFormat',
								type: 'options',
								displayOptions: { show: { imageSource: ['binary', 'base64'] } },
								options: [
									{ name: 'Auto Detect', value: 'auto' },
									{ name: 'JPEG', value: 'jpeg' },
									{ name: 'PNG', value: 'png' },
									{ name: 'WebP', value: 'webp' },
									{ name: 'GIF', value: 'gif' },
								],
								default: 'auto',
							},
							{
								displayName: 'Detail Level',
								name: 'detail',
								type: 'options',
								options: [
									{ name: 'Auto', value: 'auto' },
									{ name: 'Low', value: 'low', description: 'Low resolution (faster, cheaper)' },
									{ name: 'High', value: 'high', description: 'High resolution (slower, more detailed)' },
								],
								default: 'auto',
							},
						],
					},
				],
			},
			{
				displayName: 'Prompt',
				name: 'visionPrompt',
				type: 'string',
				displayOptions: { show: { resource: ['vision'], operation: ['analyze'] } },
				default: 'Describe what you see in this image.',
				required: true,
				description: 'Text prompt describing what you want to know about the image(s)',
				typeOptions: { rows: 3 },
			},
			{
				displayName: 'Additional Fields',
				name: 'visionAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['vision'], operation: ['analyze'] } },
				options: [
					{
						displayName: 'Max Tokens',
						name: 'max_tokens',
						type: 'number',
						default: 1024,
						typeOptions: { minValue: 1, maxValue: 8192 },
					},
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						default: 0.7,
						typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 2 },
					},
					{
						displayName: 'Top P',
						name: 'top_p',
						type: 'number',
						default: 1,
						typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
					},
					{
						displayName: 'Stream',
						name: 'stream',
						type: 'boolean',
						default: false,
					},
				],
			},

			// ---------------- Embeddings ----------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['embeddings'] } },
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create embeddings',
						action: 'Create embeddings',
					},
				],
				default: 'create',
			},
			...buildModelSelectionFields({
				modeName: 'embeddingModelMode',
				listName: 'embeddingModel',
				idName: 'embeddingModelId',
				ids: EMBEDDING_MODEL_IDS,
				show: { resource: ['embeddings'], operation: ['create'] },
				defaultList: 'BAAI/bge-m3',
			}),
			{
				displayName: 'Input',
				name: 'input',
				type: 'string',
				displayOptions: { show: { resource: ['embeddings'], operation: ['create'] } },
				default: '',
				required: true,
				description: 'Input text to embed (string, or JSON array of strings)',
				typeOptions: { rows: 3 },
			},
			{
				displayName: 'Additional Fields',
				name: 'embeddingAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['embeddings'], operation: ['create'] } },
				options: [
					{
						displayName: 'Encoding Format',
						name: 'encoding_format',
						type: 'options',
						options: [
							{ name: 'Float', value: 'float' },
							{ name: 'Base64', value: 'base64' },
						],
						default: 'float',
					},
				],
			},

			// ---------------- Image Generation ----------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['image'] } },
				options: [
					{
						name: 'Generate',
						value: 'generate',
						description: 'Generate an image from a prompt',
						action: 'Generate an image from a prompt',
					},
				],
				default: 'generate',
			},
			...buildModelSelectionFields({
				modeName: 'imageModelMode',
				listName: 'imageModel',
				idName: 'imageModelId',
				ids: IMAGE_MODEL_IDS,
				show: { resource: ['image'], operation: ['generate'] },
				defaultList: 'Tongyi-MAI/Z-Image-Turbo',
			}),
			{
				displayName: 'Prompt',
				name: 'imagePrompt',
				type: 'string',
				displayOptions: { show: { resource: ['image'], operation: ['generate'] } },
				default: '',
				required: true,
				description: 'Text prompt used to generate the image',
				typeOptions: { rows: 3 },
			},
			{
				displayName: 'Additional Fields',
				name: 'imageAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['image'], operation: ['generate'] } },
				options: [
					{
						displayName: 'Negative Prompt',
						name: 'negative_prompt',
						type: 'string',
						typeOptions: { rows: 2 },
						default: '',
					},
					{
						displayName: 'Image Size',
						name: 'image_size',
						type: 'options',
						default: '1024x1024',
						options: [
							{ name: '512x512', value: '512x512' },
							{ name: '768x768', value: '768x768' },
							{ name: '1024x1024', value: '1024x1024' },
							{ name: '1024x576 (16:9)', value: '1024x576' },
							{ name: '576x1024 (9:16)', value: '576x1024' },
						],
					},
					{
						displayName: 'Num Images',
						name: 'batch_size',
						type: 'number',
						default: 1,
						typeOptions: { minValue: 1, maxValue: 4 },
					},
					{
						displayName: 'Seed',
						name: 'seed',
						type: 'number',
						default: 0,
						description: 'Random seed; 0 means random',
					},
					{
						displayName: 'Guidance Scale',
						name: 'guidance_scale',
						type: 'number',
						default: 7.5,
						typeOptions: { minValue: 1, maxValue: 20 },
					},
					{
						displayName: 'Num Inference Steps',
						name: 'num_inference_steps',
						type: 'number',
						default: 20,
						typeOptions: { minValue: 1, maxValue: 100 },
					},
				],
			},

			// ---------------- Rerank ----------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['rerank'] } },
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create rerank request',
						action: 'Create rerank request',
					},
				],
				default: 'create',
			},
			...buildModelSelectionFields({
				modeName: 'rerankModelMode',
				listName: 'rerankModel',
				idName: 'rerankModelId',
				ids: RERANK_MODEL_IDS,
				show: { resource: ['rerank'], operation: ['create'] },
				defaultList: 'BAAI/bge-reranker-v2-m3',
			}),
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				displayOptions: { show: { resource: ['rerank'], operation: ['create'] } },
				default: '',
				required: true,
				description: 'The search query',
				typeOptions: { rows: 2 },
			},
			{
				displayName: 'Documents',
				name: 'documents',
				type: 'string',
				displayOptions: { show: { resource: ['rerank'], operation: ['create'] } },
				default: '',
				required: true,
				description: 'Documents to rerank (one per line or comma-separated)',
				typeOptions: { rows: 5 },
			},
			{
				displayName: 'Additional Fields',
				name: 'rerankAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['rerank'], operation: ['create'] } },
				options: [
					{
						displayName: 'Top N',
						name: 'top_n',
						type: 'number',
						default: 4,
						typeOptions: { minValue: 1 },
					},
					{
						displayName: 'Return Documents',
						name: 'return_documents',
						type: 'boolean',
						default: false,
					},
					{
						displayName: 'Max Chunks Per Doc',
						name: 'max_chunks_per_doc',
						type: 'number',
						default: 10,
						description: 'Maximum chunks for long documents (BGE/Youdao models only)',
					},
					{
						displayName: 'Overlap Tokens',
						name: 'overlap_tokens',
						type: 'number',
						default: 20,
						typeOptions: { maxValue: 80 },
						description: 'Token overlaps between chunks (BGE/Youdao models only, max 80)',
					},
				],
			},

			// ---------------- Audio ----------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['audio'] } },
				options: [
					{
						name: 'Generate Speech',
						value: 'generate',
						description: 'Synthesize speech from text (Text-to-Speech)',
						action: 'Generate speech from text',
					},
					{
						name: 'Transcribe',
						value: 'transcribe',
						description: 'Transcribe audio into text (Speech-to-Text)',
						action: 'Transcribe audio to text',
					},
				],
				default: 'generate',
			},

			// ---- Audio > Generate Speech (TTS, POST /audio/speech) ----
			...buildModelSelectionFields({
				modeName: 'ttsModelMode',
				listName: 'ttsModel',
				idName: 'ttsModelId',
				ids: TTS_MODEL_IDS,
				show: { resource: ['audio'], operation: ['generate'] },
				defaultList: 'FunAudioLLM/CosyVoice2-0.5B',
			}),
			{
				displayName: 'Text',
				name: 'ttsInput',
				type: 'string',
				displayOptions: { show: { resource: ['audio'], operation: ['generate'] } },
				default: '',
				required: true,
				description:
					'Text to synthesize. For MOSS-TTSD use [S1]/[S2] speaker tags for bilingual dialogue; for CosyVoice2 you may use markers like [laughter] and [breath].',
				typeOptions: { rows: 4 },
			},
			{
				displayName: 'Voice',
				name: 'ttsVoiceMode',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['audio'], operation: ['generate'] } },
				options: [
					{
						name: 'Select From List',
						value: 'list',
						description: '从 SiliconFlow 预置音色中选择，自动按所选模型拼接为 {model}:{voice}',
					},
					{
						name: 'Custom',
						value: 'custom',
						description: '手动输入完整音色 ID（如 FunAudioLLM/CosyVoice2-0.5B:alex），支持表达式',
					},
					{
						name: 'None',
						value: 'none',
						description: '不指定音色，使用模型默认',
					},
				],
				default: 'list',
			},
			{
				displayName: 'Preset Voice',
				name: 'ttsVoiceList',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['audio'], operation: ['generate'], ttsVoiceMode: ['list'] },
				},
				options: [
					{ name: 'alex', value: 'alex' },
					{ name: 'anna', value: 'anna' },
					{ name: 'bella', value: 'bella' },
					{ name: 'benjamin', value: 'benjamin' },
					{ name: 'charles', value: 'charles' },
					{ name: 'david', value: 'david' },
					{ name: 'diana', value: 'diana' },
					{ name: 'claire', value: 'claire' },
				],
				default: 'alex',
				description:
					'SiliconFlow 预置音色。实际发送值为 {所选模型}:{音色}，例如选择模型 FunAudioLLM/CosyVoice2-0.5B + 音色 alex → FunAudioLLM/CosyVoice2-0.5B:alex。',
			},
			{
				displayName: 'Custom Voice',
				name: 'ttsVoiceCustom',
				type: 'string',
				displayOptions: {
					show: { resource: ['audio'], operation: ['generate'], ttsVoiceMode: ['custom'] },
				},
				default: '',
				placeholder: 'FunAudioLLM/CosyVoice2-0.5B:alex',
				description:
					'完整音色 ID，格式 {model}:{voice}。音色前缀不必与所选模型一致，均可使用。',
			},
			{
				displayName: 'Additional Fields',
				name: 'ttsAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['audio'], operation: ['generate'] } },
				options: [
					{
						displayName: 'Output Format',
						name: 'response_format',
						type: 'options',
						options: [
							{ name: 'MP3', value: 'mp3' },
							{ name: 'WAV', value: 'wav' },
							{ name: 'Opus', value: 'opus' },
							{ name: 'PCM', value: 'pcm' },
						],
						default: 'mp3',
						description: 'Audio format of the synthesized output',
					},
					{
						displayName: 'Sample Rate',
						name: 'sample_rate',
						type: 'number',
						default: 32000,
						description:
							'Output sample rate (Hz). mp3: 32000 or 44100; wav/pcm: 8000-44100; opus: 48000 only.',
					},
					{
						displayName: 'Speed',
						name: 'speed',
						type: 'number',
						default: 1,
						typeOptions: { minValue: 0.25, maxValue: 4, numberPrecision: 2 },
						description: 'Speech rate (0.25 - 4.0)',
					},
					{
						displayName: 'Gain',
						name: 'gain',
						type: 'number',
						default: 0,
						typeOptions: { minValue: -10, maxValue: 10, numberPrecision: 1 },
						description: 'Audio gain / volume adjustment (-10.0 - 10.0)',
					},
					{
						displayName: 'Stream',
						name: 'stream',
						type: 'boolean',
						default: false,
						description: 'Whether the API should stream the audio back',
					},
				],
			},

			// ---- Audio > Transcribe (ASR, POST /audio/transcriptions) ----
			...buildModelSelectionFields({
				modeName: 'asrModelMode',
				listName: 'asrModel',
				idName: 'asrModelId',
				ids: ASR_MODEL_IDS,
				show: { resource: ['audio'], operation: ['transcribe'] },
				defaultList: 'FunAudioLLM/SenseVoiceSmall',
			}),
			{
				displayName: 'Audio Source',
				name: 'asrAudioSource',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['audio'], operation: ['transcribe'] } },
				options: [
					{ name: 'Binary Data', value: 'binary', description: 'Use audio binary data from a previous node' },
					{ name: 'URL', value: 'url', description: 'Download audio from a URL' },
					{ name: 'Base64', value: 'base64', description: 'Use base64 encoded audio' },
				],
				default: 'binary',
			},
			{
				displayName: 'Binary Property',
				name: 'asrBinaryProperty',
				type: 'string',
				displayOptions: { show: { resource: ['audio'], operation: ['transcribe'], asrAudioSource: ['binary'] } },
				default: 'data',
				description: 'Name of the binary property containing the audio file',
			},
			{
				displayName: 'Audio URL',
				name: 'asrAudioUrl',
				type: 'string',
				displayOptions: { show: { resource: ['audio'], operation: ['transcribe'], asrAudioSource: ['url'] } },
				default: '',
				placeholder: 'https://example.com/audio.mp3',
			},
			{
				displayName: 'Base64 Data',
				name: 'asrBase64Data',
				type: 'string',
				displayOptions: { show: { resource: ['audio'], operation: ['transcribe'], asrAudioSource: ['base64'] } },
				default: '',
				description: 'Base64 encoded audio data (with or without data:audio/...;base64, prefix)',
				typeOptions: { rows: 4 },
			},
			{
				displayName: 'File Name',
				name: 'asrFileName',
				type: 'string',
				displayOptions: { show: { resource: ['audio'], operation: ['transcribe'] } },
				default: '',
				placeholder: 'audio.mp3',
				description:
					'File name passed to the API (used for format detection). Optional for binary source; recommended for URL/base64 sources.',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let outputData: IDataObject;
				let outputBinary: IBinaryData | undefined;

				if (resource === 'chat') {
					outputData = await handleChat.call(this, i);
				} else if (resource === 'vision') {
					outputData = await handleVision.call(this, i);
				} else if (resource === 'embeddings') {
					outputData = await handleEmbeddings.call(this, i);
				} else if (resource === 'image') {
					outputData = await handleImage.call(this, i);
				} else if (resource === 'rerank') {
					outputData = await handleRerank.call(this, i);
				} else if (resource === 'audio') {
					const audioResult = await handleAudio.call(this, i);
					outputData = audioResult.json;
					outputBinary = audioResult.binary;
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`);
				}

				const item: INodeExecutionData = { json: outputData, pairedItem: { item: i } };
				if (outputBinary) {
					item.binary = { data: outputBinary };
				}
				returnData.push(item);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error instanceof Error ? error.message : 'Unknown error occurred' },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

// ----------------------------------------------------------------
// Shared request helper — uses n8n's built-in HTTP client with the
// SiliconFlow credential (Bearer token injected automatically).
// ----------------------------------------------------------------
async function siliconflowRequest(
	this: IExecuteFunctions,
	path: string,
	body: IDataObject,
): Promise<IDataObject> {
	// httpRequestWithAuthentication does NOT apply the node-level requestDefaults.baseURL,
	// so we must build a fully-qualified URL from the credential's baseUrl ourselves.
	// (The Authorization header IS injected automatically from the credential.)
	const credentials = (await this.getCredentials('siliconFlowApi')) as { baseUrl?: string };
	const baseUrl = (credentials.baseUrl || '').replace(/\/+$/, '');
	const options: IHttpRequestOptions = {
		method: 'POST',
		url: `${baseUrl}${path}`,
		body,
		json: true,
		headers: { 'Content-Type': 'application/json' },
	};
	return (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'siliconFlowApi',
		options,
	)) as IDataObject;
}

// ----------------------------------------------------------------
// Chat Completion
// ----------------------------------------------------------------
async function handleChat(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const model = resolveModelId(this, itemIndex, 'modelMode', 'model', 'modelId');
	const prompt = this.getNodeParameter('prompt', itemIndex, '') as string;
	const messagesParam = this.getNodeParameter('messages', itemIndex, {}) as {
		messageValues?: Array<{ role: string; content: string }>;
	};
	const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
	const outputMode = this.getNodeParameter('outputMode', itemIndex, 'simple') as string;

	let messages: Array<{ role: string; content: string }>;
	if (messagesParam?.messageValues && messagesParam.messageValues.length > 0) {
		messages = messagesParam.messageValues;
	} else if (prompt) {
		messages = [{ role: 'user', content: prompt }];
	} else {
		throw new NodeOperationError(this.getNode(), 'Either messages or prompt must be provided');
	}

	const requestBody: IDataObject = { model, messages };

	if (additionalFields.max_tokens !== undefined) requestBody.max_tokens = additionalFields.max_tokens;
	if (additionalFields.temperature !== undefined) requestBody.temperature = additionalFields.temperature;
	if (additionalFields.top_p !== undefined) requestBody.top_p = additionalFields.top_p;
	if (additionalFields.top_k !== undefined) requestBody.top_k = additionalFields.top_k;
	if (additionalFields.min_p !== undefined) requestBody.min_p = additionalFields.min_p;
	if (additionalFields.frequency_penalty !== undefined)
		requestBody.frequency_penalty = additionalFields.frequency_penalty;
	if (additionalFields.presence_penalty !== undefined)
		requestBody.presence_penalty = additionalFields.presence_penalty;
	if (additionalFields.n !== undefined) requestBody.n = additionalFields.n;
	if (additionalFields.enable_thinking !== undefined)
		requestBody.enable_thinking = additionalFields.enable_thinking;
	if (additionalFields.thinking_budget !== undefined)
		requestBody.thinking_budget = additionalFields.thinking_budget;
	if (additionalFields.stream !== undefined) requestBody.stream = additionalFields.stream;

	if (additionalFields.stop && (additionalFields.stop as string).trim()) {
		requestBody.stop = (additionalFields.stop as string)
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s);
	}

	const responseFormat = additionalFields.response_format as
		| { formatValues?: { type?: string } }
		| undefined;
	if (responseFormat?.formatValues) {
		requestBody.response_format = { type: responseFormat.formatValues.type };
	}

	const responseData = await siliconflowRequest.call(this, '/chat/completions', requestBody);
	const choice = (responseData as any).choices?.[0];
	if (!choice) {
		throw new NodeOperationError(this.getNode(), 'No response received from the model');
	}

	if (outputMode === 'simple') {
		return { content: choice.message?.content || '' };
	}

	return {
		message: choice.message?.content || '',
		model: (responseData as any).model,
		finishReason: choice.finish_reason,
		usage: (responseData as any).usage,
		...(choice.message?.reasoning_content && { reasoning: choice.message.reasoning_content }),
		...(choice.message?.tool_calls && { toolCalls: choice.message.tool_calls }),
		_rawResponse: responseData,
	} as IDataObject;
}

// ----------------------------------------------------------------
// Vision (multimodal image analysis)
// ----------------------------------------------------------------
async function handleVision(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const items = this.getInputData();
	const model = resolveModelId(this, itemIndex, 'visionModelMode', 'visionModel', 'visionModelId');
	const prompt = this.getNodeParameter('visionPrompt', itemIndex) as string;
	const imagesParam = this.getNodeParameter('images', itemIndex, {}) as {
		imageValues?: Array<Record<string, string>>;
	};
	const additionalFields = this.getNodeParameter('visionAdditionalFields', itemIndex, {}) as IDataObject;

	const content: IDataObject[] = [];

	if (!imagesParam?.imageValues || imagesParam.imageValues.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one image must be provided for vision analysis');
	}

	for (const imageConfig of imagesParam.imageValues) {
		const { imageSource, detail = 'auto' } = imageConfig;
		let imageUrl = '';

		if (imageSource === 'url') {
			imageUrl = imageConfig.imageUrl;
			if (!imageUrl) {
				throw new NodeOperationError(this.getNode(), 'Image URL is required when using URL source');
			}
		} else if (imageSource === 'base64') {
			const base64Data = imageConfig.base64Data;
			if (!base64Data) {
				throw new NodeOperationError(this.getNode(), 'Base64 data is required when using base64 source');
			}
			let cleanedBase64 = base64Data.trim();
			if (cleanedBase64.startsWith('data:')) {
				const base64Index = cleanedBase64.indexOf('base64,');
				if (base64Index !== -1) cleanedBase64 = cleanedBase64.substring(base64Index + 7);
			}
			cleanedBase64 = cleanedBase64.replace(/\s/g, '');
			if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanedBase64)) {
				throw new NodeOperationError(this.getNode(), 'Invalid base64 data format');
			}
			const imageFormat = imageConfig.imageFormat || 'auto';
			let mimeType = 'image/jpeg';
			if (imageFormat === 'png') mimeType = 'image/png';
			else if (imageFormat === 'webp') mimeType = 'image/webp';
			else if (imageFormat === 'gif') mimeType = 'image/gif';
			imageUrl = `data:${mimeType};base64,${cleanedBase64}`;
		} else {
			// binary — read the actual bytes via n8n's helper. This works for BOTH the
			// default (in-memory base64 in .data) and the filesystem binary data mode,
			// where .data is empty and the file lives on disk. Never rely on .data directly.
			const binaryProperty = imageConfig.binaryProperty || 'data';
			const binaryData = items[itemIndex].binary?.[binaryProperty];
			if (!binaryData) {
				throw new NodeOperationError(
					this.getNode(),
					`No binary data found in property "${binaryProperty}". Available properties: ${Object.keys(
						items[itemIndex].binary || {},
					).join(', ')}`,
				);
			}
			const imageFormat = imageConfig.imageFormat || 'auto';
			let mimeType = binaryData.mimeType || 'image/jpeg';
			if (mimeType.includes('jpeg') || mimeType.includes('jpg')) mimeType = 'image/jpeg';
			else if (mimeType.includes('png')) mimeType = 'image/png';
			else if (mimeType.includes('webp')) mimeType = 'image/webp';
			else if (mimeType.includes('gif')) mimeType = 'image/gif';
			else mimeType = 'image/jpeg';
			if (imageFormat !== 'auto') mimeType = `image/${imageFormat}`;

			let buffer: Buffer;
			try {
				buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryProperty);
			} catch (err) {
				throw new NodeOperationError(
					this.getNode(),
					`Could not read binary data from property "${binaryProperty}": ${(err as Error).message}`,
				);
			}
			if (!buffer || buffer.length === 0) {
				throw new NodeOperationError(
					this.getNode(),
					`Binary property "${binaryProperty}" is empty`,
				);
			}
			imageUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
		}

		const imageContent: IDataObject = {
			type: 'image_url',
			image_url: { url: imageUrl } as IDataObject,
		};
		if (detail === 'high' || detail === 'low') {
			(imageContent.image_url as IDataObject).detail = detail;
		}
		content.push(imageContent);
	}

	content.push({ type: 'text', text: prompt });

	const requestBody: IDataObject = {
		model,
		messages: [{ role: 'user', content }],
	};

	if (additionalFields.max_tokens !== undefined) requestBody.max_tokens = additionalFields.max_tokens;
	if (additionalFields.temperature !== undefined) requestBody.temperature = additionalFields.temperature;
	if (additionalFields.top_p !== undefined) requestBody.top_p = additionalFields.top_p;
	if (additionalFields.stream !== undefined) requestBody.stream = additionalFields.stream;

	const responseData = await siliconflowRequest.call(this, '/chat/completions', requestBody);
	const choice = (responseData as any).choices?.[0];
	if (!choice) {
		throw new NodeOperationError(this.getNode(), 'No response received from the vision model');
	}

	return {
		analysis: choice.message?.content || '',
		model: (responseData as any).model,
		finishReason: choice.finish_reason,
		usage: (responseData as any).usage,
		imageCount: imagesParam.imageValues.length,
		prompt,
		_rawResponse: responseData,
	} as IDataObject;
}

// ----------------------------------------------------------------
// Embeddings
// ----------------------------------------------------------------
async function handleEmbeddings(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const model = resolveModelId(this, itemIndex, 'embeddingModelMode', 'embeddingModel', 'embeddingModelId');
	const inputRaw = this.getNodeParameter('input', itemIndex) as unknown;
	const additionalFields = this.getNodeParameter('embeddingAdditionalFields', itemIndex, {}) as IDataObject;

	// input may be a plain string or a JSON array of strings
	let input: string | string[];
	if (typeof inputRaw === 'string') {
		const trimmed = inputRaw.trim();
		if (trimmed.startsWith('[')) {
			try {
				const parsed = JSON.parse(trimmed);
				input = Array.isArray(parsed) ? (parsed as string[]) : trimmed;
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

	const requestBody: IDataObject = { model, input };
	if (additionalFields.encoding_format) {
		requestBody.encoding_format = additionalFields.encoding_format;
	}

	const responseData = await siliconflowRequest.call(this, '/embeddings', requestBody);
	return {
		embeddings: (responseData as any).data?.map((item: any) => item.embedding) || [],
		model: (responseData as any).model,
		usage: (responseData as any).usage,
		_rawResponse: responseData,
	} as IDataObject;
}

// ----------------------------------------------------------------
// Image Generation
// ----------------------------------------------------------------
async function handleImage(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const model = resolveModelId(this, itemIndex, 'imageModelMode', 'imageModel', 'imageModelId');
	const prompt = this.getNodeParameter('imagePrompt', itemIndex) as string;
	const additionalFields = this.getNodeParameter('imageAdditionalFields', itemIndex, {}) as IDataObject;

	const requestBody: IDataObject = {
		model,
		prompt,
		image_size: additionalFields.image_size ?? '1024x1024',
		batch_size: additionalFields.batch_size ?? 1,
	};

	if (additionalFields.negative_prompt) {
		requestBody.negative_prompt = additionalFields.negative_prompt;
	}
	if (typeof additionalFields.seed === 'number' && additionalFields.seed !== 0) {
		requestBody.seed = additionalFields.seed;
	}
	if (typeof additionalFields.guidance_scale === 'number') {
		requestBody.guidance_scale = additionalFields.guidance_scale;
	}
	if (typeof additionalFields.num_inference_steps === 'number') {
		requestBody.num_inference_steps = additionalFields.num_inference_steps;
	}

	const responseData = await siliconflowRequest.call(this, '/images/generations', requestBody);
	return {
		images: (responseData as any).images || [],
		model,
		_rawResponse: responseData,
	} as IDataObject;
}

// ----------------------------------------------------------------
// Rerank
// ----------------------------------------------------------------
async function handleRerank(this: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const model = resolveModelId(this, itemIndex, 'rerankModelMode', 'rerankModel', 'rerankModelId');
	const query = this.getNodeParameter('query', itemIndex) as string;
	const documentsParam = this.getNodeParameter('documents', itemIndex) as string;
	const additionalFields = this.getNodeParameter('rerankAdditionalFields', itemIndex, {}) as IDataObject;

	let documents: string[];
	if (documentsParam.includes('\n')) {
		documents = documentsParam
			.split('\n')
			.map((doc) => doc.trim())
			.filter((doc) => doc);
	} else {
		documents = documentsParam
			.split(',')
			.map((doc) => doc.trim())
			.filter((doc) => doc);
	}
	if (documents.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one document must be provided');
	}

	const requestBody: IDataObject = { model, query, documents };
	if (additionalFields.top_n !== undefined) requestBody.top_n = additionalFields.top_n;
	if (additionalFields.return_documents !== undefined)
		requestBody.return_documents = additionalFields.return_documents;
	if (additionalFields.max_chunks_per_doc !== undefined)
		requestBody.max_chunks_per_doc = additionalFields.max_chunks_per_doc;
	if (additionalFields.overlap_tokens !== undefined)
		requestBody.overlap_tokens = additionalFields.overlap_tokens;

	const responseData = await siliconflowRequest.call(this, '/rerank', requestBody);
	return {
		results: (responseData as any).results || [],
		query,
		documentsCount: documents.length,
		usage: (responseData as any).tokens,
		_rawResponse: responseData,
	} as IDataObject;
}

// ----------------------------------------------------------------
// Audio (TTS / ASR)
// ----------------------------------------------------------------
interface AudioResult {
	json: IDataObject;
	binary?: IBinaryData;
}

async function handleAudio(this: IExecuteFunctions, itemIndex: number): Promise<AudioResult> {
	const operation = this.getNodeParameter('operation', itemIndex, 'generate') as string;
	if (operation === 'transcribe') {
		return handleTranscribe.call(this, itemIndex);
	}
	return handleGenerateSpeech.call(this, itemIndex);
}

// ---- Audio > Generate Speech (TTS) ----
// 请求体为 JSON，响应为二进制音频流；与 siliconflowRequest（JSON 来回）不同，
// 这里需要：① 手动序列化请求体并设置 Content-Type: application/json；
//           ② 以 arraybuffer 方式接收响应，再转成 Buffer 交给 prepareBinaryData。
async function handleGenerateSpeech(this: IExecuteFunctions, itemIndex: number): Promise<AudioResult> {
	const model = resolveModelId(this, itemIndex, 'ttsModelMode', 'ttsModel', 'ttsModelId');
	const input = this.getNodeParameter('ttsInput', itemIndex) as string;
	const additionalFields = this.getNodeParameter('ttsAdditionalFields', itemIndex, {}) as IDataObject;

	if (!input || !input.trim()) {
		throw new NodeOperationError(this.getNode(), 'Text to synthesize is required');
	}

	// 音色解析：list → 用所选模型拼接 {model}:{voice}；custom → 直接用输入值；none → 不发送。
	// 音色前缀不必与所选模型一致（API 均可使用），这里默认按所选模型拼接最直观。
	const voiceMode = this.getNodeParameter('ttsVoiceMode', itemIndex, 'list') as string;
	let voice = '';
	if (voiceMode === 'list') {
		const voiceName = this.getNodeParameter('ttsVoiceList', itemIndex, 'alex') as string;
		voice = `${model}:${voiceName}`;
	} else if (voiceMode === 'custom') {
		voice = (this.getNodeParameter('ttsVoiceCustom', itemIndex, '') as string).trim();
	}

	const requestBody: IDataObject = { model, input };
	if (voice) {
		requestBody.voice = voice;
	}

	const responseFormat = (additionalFields.response_format as string) ?? 'mp3';
	requestBody.response_format = responseFormat;
	if (additionalFields.sample_rate !== undefined) {
		requestBody.sample_rate = additionalFields.sample_rate;
	}
	if (additionalFields.speed !== undefined) {
		requestBody.speed = additionalFields.speed;
	}
	if (additionalFields.gain !== undefined) {
		requestBody.gain = additionalFields.gain;
	}
	if (additionalFields.stream !== undefined) {
		requestBody.stream = additionalFields.stream;
	}

	const buffer = await siliconflowRequestBinary.call(this, '/audio/speech', requestBody);

	const mimeType = responseFormatToMime(responseFormat);
	const fileName = `speech.${responseFormat}`;
	const binary = await this.helpers.prepareBinaryData(buffer, fileName, mimeType);

	return {
		json: {
			model,
			voice: voice || null,
			format: responseFormat,
			size: buffer.length,
			input,
		},
		binary,
	};
}

// ---- Audio > Transcribe (ASR) ----
// 请求为 multipart/form-data：上传音频二进制 + model 字段；响应为 JSON { text }。
async function handleTranscribe(this: IExecuteFunctions, itemIndex: number): Promise<AudioResult> {
	const model = resolveModelId(this, itemIndex, 'asrModelMode', 'asrModel', 'asrModelId');
	const audioSource = this.getNodeParameter('asrAudioSource', itemIndex, 'binary') as string;
	const customFileName = (this.getNodeParameter('asrFileName', itemIndex, '') as string).trim();

	const { buffer, fileName } = await getAudioBuffer.call(this, itemIndex, audioSource, customFileName);

	const mimeType = guessAudioMime(fileName);
	const responseData = await siliconflowRequestMultipart.call(
		this,
		'/audio/transcriptions',
		model,
		buffer,
		fileName,
		mimeType,
	);

	return {
		json: {
			text: (responseData as any).text ?? '',
			model,
			fileName,
		},
	};
}

// Resolve an audio source (binary / url / base64) into a Buffer + file name.
async function getAudioBuffer(
	this: IExecuteFunctions,
	itemIndex: number,
	source: string,
	customFileName: string,
): Promise<{ buffer: Buffer; fileName: string }> {
	const items = this.getInputData();

	if (source === 'url') {
		const url = (this.getNodeParameter('asrAudioUrl', itemIndex, '') as string).trim();
		if (!url) {
			throw new NodeOperationError(this.getNode(), 'Audio URL is required when using URL source');
		}
		// Plain HTTP GET — do NOT attach the SiliconFlow credential to an arbitrary URL.
		const options: IHttpRequestOptions = {
			method: 'GET',
			url,
			encoding: 'arraybuffer',
		};
		const buf = toBuffer(await this.helpers.httpRequest.call(this, options));
		if (buf.length === 0) {
			throw new NodeOperationError(this.getNode(), 'Downloaded audio from URL was empty');
		}
		const name = customFileName || fileNameFromUrl(url) || 'audio.mp3';
		return { buffer: buf, fileName: name };
	}

	if (source === 'base64') {
		const raw = (this.getNodeParameter('asrBase64Data', itemIndex, '') as string).trim();
		if (!raw) {
			throw new NodeOperationError(this.getNode(), 'Base64 data is required when using base64 source');
		}
		let cleaned = raw;
		if (cleaned.startsWith('data:')) {
			const idx = cleaned.indexOf('base64,');
			if (idx !== -1) cleaned = cleaned.substring(idx + 7);
		}
		cleaned = cleaned.replace(/\s/g, '');
		if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
			throw new NodeOperationError(this.getNode(), 'Invalid base64 audio data');
		}
		const buf = Buffer.from(cleaned, 'base64');
		if (buf.length === 0) {
			throw new NodeOperationError(this.getNode(), 'Decoded base64 audio is empty');
		}
		const name = customFileName || 'audio.mp3';
		return { buffer: buf, fileName: name };
	}

	// binary — read the actual bytes via n8n's helper (works for both in-memory and
	// filesystem binary data modes; never rely on .data directly).
	const binaryProperty = (this.getNodeParameter('asrBinaryProperty', itemIndex, 'data') as string).trim() || 'data';
	const binaryData = items[itemIndex].binary?.[binaryProperty];
	if (!binaryData) {
		throw new NodeOperationError(
			this.getNode(),
			`No binary data found in property "${binaryProperty}". Available properties: ${Object.keys(
				items[itemIndex].binary || {},
			).join(', ')}`,
		);
	}
	let buf: Buffer;
	try {
		buf = await this.helpers.getBinaryDataBuffer(itemIndex, binaryProperty);
	} catch (err) {
		throw new NodeOperationError(
			this.getNode(),
			`Could not read binary data from property "${binaryProperty}": ${(err as Error).message}`,
		);
	}
	if (!buf || buf.length === 0) {
		throw new NodeOperationError(this.getNode(), `Binary property "${binaryProperty}" is empty`);
	}
	const name = customFileName || binaryData.fileName || 'audio.mp3';
	return { buffer: buf, fileName: name };
}

// ----------------------------------------------------------------
// Binary-response request helper (TTS: JSON body → binary audio response)
// ----------------------------------------------------------------
async function siliconflowRequestBinary(
	this: IExecuteFunctions,
	path: string,
	body: IDataObject,
): Promise<Buffer> {
	const credentials = (await this.getCredentials('siliconFlowApi')) as { baseUrl?: string };
	const baseUrl = (credentials.baseUrl || '').replace(/\/+$/, '');
	const options: IHttpRequestOptions = {
		method: 'POST',
		url: `${baseUrl}${path}`,
		body: JSON.stringify(body),
		json: false,
		encoding: 'arraybuffer',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'audio/*',
		},
	};
	const result = await this.helpers.httpRequestWithAuthentication.call(
		this,
		'siliconFlowApi',
		options,
	);
	const buffer = toBuffer(result);
	if (!buffer || buffer.length === 0) {
		throw new NodeOperationError(this.getNode(), 'Audio response from the API was empty');
	}
	return buffer;
}

// ----------------------------------------------------------------
// Multipart request helper (ASR: upload audio file → JSON { text })
// ----------------------------------------------------------------
async function siliconflowRequestMultipart(
	this: IExecuteFunctions,
	path: string,
	model: string,
	fileBuffer: Buffer,
	fileName: string,
	mimeType: string,
): Promise<IDataObject> {
	const credentials = (await this.getCredentials('siliconFlowApi')) as { baseUrl?: string };
	const baseUrl = (credentials.baseUrl || '').replace(/\/+$/, '');

	// form-data is a direct dependency of n8n-workflow, so it is always available
	// at runtime in any n8n environment — no extra package dependency needed here.
	const form = new FormData();
	form.append('model', model);
	form.append('file', fileBuffer, { filename: fileName, contentType: mimeType });

	const options: IHttpRequestOptions = {
		method: 'POST',
		url: `${baseUrl}${path}`,
		body: form,
		json: true,
		// The multipart Content-Type (with boundary) must come from the form instance.
		headers: form.getHeaders() as IDataObject,
	};

	return (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'siliconFlowApi',
		options,
	)) as IDataObject;
}

// Coerce an httpRequest result (Buffer / ArrayBuffer / TypedArray) into a Node Buffer.
function toBuffer(value: unknown): Buffer {
	if (Buffer.isBuffer(value)) return value;
	if (value instanceof ArrayBuffer) return Buffer.from(value);
	if (ArrayBuffer.isView(value)) {
		const view = value as ArrayBufferView;
		return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
	}
	if (typeof value === 'string') return Buffer.from(value, 'binary');
	throw new Error('Unexpected audio response type from the API');
}

function responseFormatToMime(format: string): string {
	switch (format) {
		case 'wav':
			return 'audio/wav';
		case 'opus':
			return 'audio/opus';
		case 'pcm':
			return 'audio/pcm';
		case 'mp3':
		default:
			return 'audio/mpeg';
	}
}

function guessAudioMime(fileName: string): string {
	const ext = (fileName.split('.').pop() || '').toLowerCase();
	switch (ext) {
		case 'wav':
			return 'audio/wav';
		case 'mp3':
			return 'audio/mpeg';
		case 'ogg':
			return 'audio/ogg';
		case 'flac':
			return 'audio/flac';
		case 'm4a':
			return 'audio/mp4';
		case 'aac':
			return 'audio/aac';
		case 'opus':
			return 'audio/opus';
		default:
			return 'application/octet-stream';
	}
}

function fileNameFromUrl(url: string): string {
	try {
		const u = new URL(url);
		const base = u.pathname.split('/').pop();
		return base && base.includes('.') ? base : '';
	} catch {
		return '';
	}
}
