# Image Generation MCP Server - Starter Template

A production-ready template for building MCP (Model Context Protocol) servers that provide AI image generation capabilities with comprehensive history management.

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- An API key for your chosen provider (OpenAI, Stable Diffusion, etc.)

### Installation

```bash
# 1. Clone or copy this template
cp -r starter-templates my-image-server
cd my-image-server

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.template .env
# Edit .env with your API keys and settings

# 4. Build
npm run build

# 5. Test with MCP Inspector
npx @modelcontextprotocol/inspector node build/index.js
```

### Configuration for Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "image-generation": {
      "command": "node",
      "args": ["/absolute/path/to/my-image-server/build/index.js"],
      "env": {
        "IMAGE_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-your-key-here",
        "IMAGE_OUTPUT_DIR": "/Users/yourname/Downloads/ai-images",
        "THUMBNAIL_ENABLED": "true"
      }
    }
  }
}
```

---

## 📁 Project Structure

```
starter-templates/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── providers/
│   │   ├── base.ts             # Provider interface
│   │   └── example.ts          # Example provider implementation
│   ├── utils/
│   │   ├── database.ts         # SQLite history management
│   │   ├── metadata.ts         # Image metadata embedding
│   │   └── resources.ts        # MCP Resources API
│   ├── tools/
│   │   └── generateImage.ts    # Sample tool implementation
│   └── types/
│       └── index.ts            # TypeScript interfaces
├── tests/
│   ├── providers.test.ts
│   ├── database.test.ts
│   └── integration.test.ts
├── package.json
├── tsconfig.json
├── .env.template
└── README.md (this file)
```

---

## 🔧 Implementation Steps

### Step 1: Choose Your Provider

Edit `src/providers/example.ts` or create a new provider file:

```typescript
// src/providers/openai.ts
import OpenAI from 'openai';
import { ImageProvider } from './base.js';

export class OpenAIProvider implements ImageProvider {
  name = 'OpenAI DALL-E';
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateImage(args: GenerateImageArgs): Promise<Buffer[]> {
    const response = await this.client.images.generate({
      model: 'dall-e-3',
      prompt: args.prompt,
      size: '1024x1024',
      n: 1,
      response_format: 'b64_json'
    });

    return response.data.map(img =>
      Buffer.from(img.b64_json!, 'base64')
    );
  }

  supports = {
    generation: true,
    editing: true,
    upscaling: false,
    customization: false
  };

  limits = {
    maxSampleCount: 10,
    supportedAspectRatios: ['1:1', '16:9', '9:16'],
    maxResolution: '1024x1792'
  };
}
```

### Step 2: Register Tools

Add your tools in `src/index.ts`:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_image",
        description: "Generate an image from a text prompt",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Text description of the image"
            }
          },
          required: ["prompt"]
        }
      }
    ]
  };
});
```

### Step 3: Handle Tool Calls

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'generate_image':
      return await handleGenerateImage(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});
```

### Step 4: Test

```bash
# Run tests
npm test

# Start server in debug mode
DEBUG=true npm run dev
```

---

## 📚 Available Features

This template includes:

### Core Features ✅
- ✅ Provider abstraction layer (easily swap OpenAI, Stable Diffusion, etc.)
- ✅ SQLite-based history management
- ✅ Full-text search with FTS5
- ✅ Metadata embedding in images (PNG/JPEG/WebP)
- ✅ UUID-based tracking
- ✅ MCP Resources API integration
- ✅ Thumbnail generation for Claude Desktop
- ✅ Parameter hashing for integrity verification

### Optional Features 🔧
- 🔧 Async job queue (uncomment in database.ts)
- 🔧 Prompt templates (uncomment in database.ts)
- 🔧 Automated backups
- 🔧 Multi-provider support

---

## 🛠️ Customization Guide

### Adding a New Provider

1. Create `src/providers/yourprovider.ts`
2. Implement the `ImageProvider` interface
3. Add to factory in `src/providers/base.ts`

### Adding a New Tool

1. Create `src/tools/yourTool.ts`
2. Define parameters in `src/types/index.ts`
3. Register in `src/index.ts`

### Customizing Database Schema

Edit `src/utils/database.ts`:
```typescript
// Add custom fields
db.exec(`
  ALTER TABLE history ADD COLUMN custom_field TEXT;
`);
```

### Customizing Metadata

Edit `src/utils/metadata.ts`:
```typescript
function getMetadataFields(level: string) {
  return {
    // Add your custom metadata
    custom_field: data.customField
  };
}
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test database.test.ts
```

### Test Structure

```typescript
// tests/providers.test.ts
import { describe, it, expect } from 'vitest';
import { OpenAIProvider } from '../src/providers/openai.js';

describe('OpenAIProvider', () => {
  it('should generate image from prompt', async () => {
    const provider = new OpenAIProvider();
    const result = await provider.generateImage({
      prompt: 'A test image'
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Buffer);
  });
});
```

---

## 📖 Documentation Reference

For detailed implementation guides, see:

- `../FEATURES_SPECIFICATION.md` - Complete feature specifications
- `../IMPLEMENTATION_GUIDE.md` - Provider-specific implementations
- `../HISTORY_GUIDE.md` - History & metadata management
- `../FEATURES_SUMMARY_JA.md` - Japanese summary

---

## 🔍 Troubleshooting

### Database Locked Error

```bash
# Enable WAL mode
sqlite3 history.db "PRAGMA journal_mode=WAL;"
```

### Thumbnails Not Showing

```typescript
// Ensure pure base64 format
{
  type: "image",
  data: "iVBORw...",  // Pure base64, not data URI
  mimeType: "image/png"
}
```

### Provider Connection Failed

```bash
# Check API key
echo $OPENAI_API_KEY

# Test provider directly
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

## 🚀 Deployment

### Docker

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY build ./build

ENV NODE_ENV=production
CMD ["node", "build/index.js"]
```

Build and run:

```bash
docker build -t image-gen-mcp .
docker run -e OPENAI_API_KEY=$OPENAI_API_KEY image-gen-mcp
```

### systemd Service

Create `/etc/systemd/system/image-mcp.service`:

```ini
[Unit]
Description=Image Generation MCP Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/my-image-server
ExecStart=/usr/bin/node build/index.js
Restart=on-failure
Environment="IMAGE_PROVIDER=openai"
Environment="OPENAI_API_KEY=sk-your-key"

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable image-mcp
sudo systemctl start image-mcp
```

---

## 📝 License

MIT License - feel free to use for commercial or personal projects.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

## 📬 Support

- 📖 Documentation: See parent directory docs
- 🐛 Issues: GitHub Issues
- 💬 Discussions: GitHub Discussions

---

**Happy Building! 🎨**
