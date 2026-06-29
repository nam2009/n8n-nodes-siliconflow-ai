'use strict';

// Re-export the credential and node classes for tooling that resolves the
// package `main` entry. n8n itself loads nodes via the `n8n.nodes` /
// `n8n.credentials` arrays declared in package.json, so this file is optional.
module.exports = {
	SiliconFlowApi: require('./dist/credentials/SiliconFlowApi.credentials.js')
		.SiliconFlowApi,
	SiliconFlow: require('./dist/nodes/SiliconFlow/SiliconFlow.node.js').SiliconFlow,
	SiliconFlowChatModel: require('./dist/nodes/SiliconFlowChatModel/SiliconFlowChatModel.node.js')
		.SiliconFlowChatModel,
};
