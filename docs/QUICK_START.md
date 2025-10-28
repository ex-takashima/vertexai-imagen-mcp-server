# Quick Start Guide

Get started with vertexai-imagen-mcp-server in **5 minutes** or less.

**Version**: 0.7.0+
**Platform**: Claude Desktop (Windows / macOS)

---

## Prerequisites

✅ [Node.js](https://nodejs.org/) 18 or higher
✅ [Claude Desktop](https://claude.ai/download) installed
✅ Google Cloud account with Vertex AI API enabled

---

## Step 1: Enable Vertex AI API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** > **Library**
4. Search for **"Vertex AI API"**
5. Click **Enable**

⏱️ **Time**: 2 minutes

---

## Step 2: Get Authentication Credentials

Choose **ONE** of the following methods:

### Option A: API Key (Easiest, for testing)

1. Go to [API Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials** > **API Key**
3. Copy the API key (starts with `AIza...`)
4. Note your **Project ID** from the console header

✅ **Best for**: Testing, development, quick setup

---

### Option B: Service Account File (Recommended)

1. Go to [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click **Create Service Account**
3. Name: `vertexai-imagen-mcp`
4. Grant role: **Vertex AI User**
5. Click **Create Key** > **JSON**
6. Save the file to a secure location (e.g., `C:\projects\.private\service-account.json`)

✅ **Best for**: Production, secure environments

---

### Option C: Service Account JSON (For CI/CD)

Same as Option B, but you'll paste the JSON content as a string instead of using a file path.

✅ **Best for**: CI/CD pipelines, containerized environments

---

⏱️ **Time**: 2 minutes

---

## Step 3: Configure Claude Desktop

### Windows

1. Open: `%APPDATA%\Claude\claude_desktop_config.json`
   - Press `Win + R`, type `%APPDATA%\Claude`, press Enter
   - Open `claude_desktop_config.json` in a text editor

2. Add the configuration (choose based on your auth method):

#### Using API Key:
```json
{
  "mcpServers": {
    "vertexai-imagen": {
      "command": "npx",
      "args": ["-y", "@dondonudonjp/vertexai-imagen-mcp-server"],
      "env": {
        "GOOGLE_API_KEY": "AIzaSy...",
        "GOOGLE_PROJECT_ID": "your-project-id"
      }
    }
  }
}
```

#### Using Service Account File:
```json
{
  "mcpServers": {
    "vertexai-imagen": {
      "command": "vertexai-imagen-mcp-server",
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "C:\\projects\\.private\\service-account.json",
        "GOOGLE_PROJECT_ID": "your-project-id"
      }
    }
  }
}
```

**Important for Windows**:
- Use double backslashes (`\\`) in file paths
- Example: `C:\\projects\\...` not `C:\projects\...`

---

### macOS

1. Open: `~/Library/Application Support/Claude/claude_desktop_config.json`
   ```bash
   open ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. Add the configuration (choose based on your auth method):

#### Using API Key:
```json
{
  "mcpServers": {
    "vertexai-imagen": {
      "command": "npx",
      "args": ["-y", "@dondonudonjp/vertexai-imagen-mcp-server"],
      "env": {
        "GOOGLE_API_KEY": "AIzaSy...",
        "GOOGLE_PROJECT_ID": "your-project-id"
      }
    }
  }
}
```

#### Using Service Account File:
```json
{
  "mcpServers": {
    "vertexai-imagen": {
      "command": "vertexai-imagen-mcp-server",
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/Users/username/.gcloud/service-account.json",
        "GOOGLE_PROJECT_ID": "your-project-id"
      }
    }
  }
}
```

⏱️ **Time**: 1 minute

---

## Step 4: Restart Claude Desktop

1. **Quit** Claude Desktop completely (not just close the window)
   - Windows: Right-click system tray icon > Quit
   - macOS: Claude > Quit Claude

2. **Restart** Claude Desktop

3. Wait for the MCP server to initialize (5-10 seconds)

⏱️ **Time**: 30 seconds

---

## Step 5: Generate Your First Image

In Claude Desktop, try this prompt:

```
Use the generate_image tool to create an image of:
"A serene Japanese garden with cherry blossoms and a traditional wooden bridge"
```

Claude will:
1. Call the `generate_image` tool
2. Generate the image using Vertex AI Imagen
3. Save it to your output directory
4. Show you the result

🎉 **Congratulations!** You've successfully set up vertexai-imagen-mcp-server.

⏱️ **Time**: 30 seconds

---

## Verification

If everything works correctly, you should see:

✅ Claude can use the `generate_image` tool
✅ An image is generated and saved
✅ The file path is displayed
✅ No error messages appear

**Output Directory (default)**:
- Windows: `%USERPROFILE%\vertexai-imagen-output`
- macOS: `~/vertexai-imagen-output`

---

## Troubleshooting

### Error: "Environment variable validation failed"

**Problem**: Authentication not configured

**Solution**:
1. Check `claude_desktop_config.json` syntax (valid JSON)
2. Verify environment variables are in the `"env"` section
3. Ensure at least one auth method is set
4. Restart Claude Desktop

---

### Error: "GOOGLE_PROJECT_ID is required"

**Problem**: Using API Key without Project ID

**Solution**: Add `GOOGLE_PROJECT_ID` to your config:
```json
{
  "env": {
    "GOOGLE_API_KEY": "AIzaSy...",
    "GOOGLE_PROJECT_ID": "your-project-id"
  }
}
```

---

### Error: "Failed to obtain OAuth access token"

**Problem**: Service account file not found or invalid

**Solution**:
1. Check file path is correct
2. Use absolute path (not relative)
3. Verify file exists and is readable
4. On Windows, use double backslashes: `C:\\path\\to\\file.json`

---

### Error: "Vertex AI API has not been used"

**Problem**: Vertex AI API not enabled

**Solution**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Vertex AI API for your project
3. Wait 1-2 minutes for propagation
4. Try again

---

### Server Not Appearing in Claude

**Problem**: MCP server not loaded

**Solution**:
1. Check `claude_desktop_config.json` for syntax errors
2. Verify JSON is valid (use [JSONLint](https://jsonlint.com/))
3. Completely quit and restart Claude Desktop
4. Check Claude Desktop logs:
   - Windows: `%APPDATA%\Claude\logs`
   - macOS: `~/Library/Logs/Claude`

---

### Image Not Generating

**Problem**: API call failing

**Solution**:
1. Check Google Cloud quotas
2. Verify billing is enabled
3. Check API is enabled
4. Review Claude Desktop logs for error details
5. Enable debug mode for more information

---

## Enable Debug Mode (Optional)

For troubleshooting, add `DEBUG` to your configuration:

```json
{
  "env": {
    "GOOGLE_APPLICATION_CREDENTIALS": "...",
    "GOOGLE_PROJECT_ID": "...",
    "DEBUG": "true"
  }
}
```

Debug logs will appear in Claude Desktop logs.

---

## Next Steps

Now that you're set up, explore more features:

### 📚 Learn More

- **[Environment Variables Reference](./ENVIRONMENT_VARIABLES.md)** - All 20 configuration options
- **[README](../README.md)** - Complete documentation with examples
- **[Thumbnail Settings](./thumbnail-mechanism.md)** - Enable image previews
- **[Metadata Embedding](./metadata-embedding.md)** - Track generation parameters

### 🎨 Try More Tools

- **`edit_image`** - Edit existing images with masks
- **`customize_image`** - Subject-driven generation
- **`upscale_image`** - Enhance image resolution
- **`generate_and_upscale_image`** - Generate + upscale in one step

### ⚙️ Customize Settings

Common customizations:

```json
{
  "env": {
    "GOOGLE_APPLICATION_CREDENTIALS": "...",
    "GOOGLE_PROJECT_ID": "...",

    "VERTEXAI_IMAGEN_OUTPUT_DIR": "C:\\My-AI-Images",
    "VERTEXAI_IMAGEN_THUMBNAIL": "true",
    "VERTEXAI_IMAGEN_THUMBNAIL_SIZE": "480",
    "VERTEXAI_IMAGEN_EMBED_METADATA": "true",
    "GOOGLE_IMAGEN_MODEL": "imagen-4.0-generate-001"
  }
}
```

See [Environment Variables Reference](./ENVIRONMENT_VARIABLES.md) for all options.

---

## Support

### Issues & Questions

- **GitHub Issues**: [Report bugs or request features](https://github.com/ex-takashima/vertexai-imagen-mcp-server/issues)
- **Documentation**: [Full README](../README.md)
- **Vertex AI Docs**: [Official documentation](https://cloud.google.com/vertex-ai/docs)

### Common Questions

**Q: Can I use this with Claude Pro?**
A: Yes! This MCP server works with both Claude Free and Claude Pro in Claude Desktop.

**Q: Does this work with Claude.ai (web)?**
A: No, MCP servers only work with Claude Desktop.

**Q: What does this cost?**
A: Vertex AI Imagen charges per generated image. Check [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing) for current rates.

**Q: Can I use multiple authentication methods?**
A: Yes, but only one will be used. Priority: API Key > Service Account JSON > Service Account File.

**Q: Where are my images saved?**
A: By default:
- Windows: `%USERPROFILE%\vertexai-imagen-output`
- macOS: `~/vertexai-imagen-output`

Customize with `VERTEXAI_IMAGEN_OUTPUT_DIR`.

---

**Total Setup Time**: ~5 minutes

**Last Updated**: 2025-10-17
**Version**: 0.7.0+
