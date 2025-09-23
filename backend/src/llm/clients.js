// backend/src/llm/clients.js
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

/**
 * Factory for the chat model (Azure OpenAI if AZURE_* envs are set; otherwise OpenAI.com fallback)
 */
export function makeChatModel({ streaming = true, temperature = 0.4 } = {}) {
  if (process.env.AZURE_OPENAI_API_KEY) {
    return new ChatOpenAI({
      // Azure OpenAI config
      azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
      azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,    // e.g. "weu-tst01-oai-mod01"
      azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME, // your chat deployment name
      azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-06-01",
      streaming,
      temperature,
    });
  }

  // Fallback to OpenAI.com (only if you set OPENAI_API_KEY / OPENAI_MODEL)
  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
    streaming,
    temperature,
  });
}

/**
 * Factory for embeddings (Azure OpenAI if AZURE_* envs are set; otherwise OpenAI.com fallback)
 */
export function makeEmbeddings() {
  if (process.env.AZURE_OPENAI_API_KEY) {
    return new OpenAIEmbeddings({
      azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
      azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
      azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT, // your embeddings deployment name
      azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-06-01",
    });
  }
  return new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  });
}
