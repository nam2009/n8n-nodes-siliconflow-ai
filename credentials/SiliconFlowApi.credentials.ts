import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * SiliconFlow（硅基流动）API 凭证
 *
 * 文档：https://docs.siliconflow.cn/cn/api-reference/authentication
 * 获取 API Key：https://cloud.siliconflow.cn/account/ak
 */
export class SiliconFlowApi implements ICredentialType {
	name = 'siliconFlowApi';
	displayName = 'SiliconFlow API';
	documentationUrl = 'https://docs.siliconflow.cn/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: '在 https://cloud.siliconflow.cn/account/ak 创建的 API 密钥',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.siliconflow.cn/v1',
			required: true,
			description: 'SiliconFlow OpenAI 兼容 API 根地址。国内用户一般无需修改；如使用海外站点请改为对应地址。',
		},
	];

	// 在每个请求头里注入 Bearer Token
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// 凭证测试：调用 /models 公开端点验证 Key 是否有效
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/models',
			method: 'GET',
		},
	};
}
