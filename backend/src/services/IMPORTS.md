# LangChain Import Best Practices

## ✅ Correct way to import

Use LangChain's OpenAI wrappers—don't import the openai SDK client directly in your agent code:

```javascript
// ✅ Correct imports
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { DirectoryLoader } from "@langchain/community/document_loaders/fs/directory";
import { TextLoader } from "@langchain/community/document_loaders/fs/text";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
```

## ❌ Avoid

Do not use the OpenAI v5 client directly, as it's not needed when using LangChain:

```javascript
// ❌ Avoid this
import { OpenAI } from "openai";
```

## Why?

- LangChain provides optimized wrappers around the OpenAI API
- Using LangChain's wrappers ensures compatibility with the rest of the LangChain ecosystem
- Helps avoid version conflicts and runtime errors
- Makes it easier to switch between different AI providers if needed

## Common Imports Reference

```javascript
// Core LLM functionality
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";

// Document loaders
import { DirectoryLoader } from "@langchain/community/document_loaders/fs/directory";
import { TextLoader } from "@langchain/community/document_loaders/fs/text";
import { JSONLoader } from "@langchain/community/document_loaders/fs/json";

// Vector stores
import { MemoryVectorStore } from "langchain/vectorstores/memory";

// Chains and tools
import { RetrievalQAChain } from "langchain/chains";
import { Calculator } from "@langchain/community/tools/calculator";
```
