# Environment Variables Reference

Complete reference for all environment variables supported by vertexai-imagen-mcp-server.

**Version**: 0.7.0+
**Last Updated**: 2025-10-17

---

## Table of Contents

- [Authentication Variables](#authentication-variables)
- [Google Cloud Configuration](#google-cloud-configuration)
- [Storage Configuration](#storage-configuration)
- [Thumbnail Settings](#thumbnail-settings)
- [Metadata Settings](#metadata-settings)
- [Template Settings](#template-settings)
- [Performance Settings](#performance-settings)
- [Debug Settings](#debug-settings)
- [Configuration Examples](#configuration-examples)

---

## Authentication Variables

At least **one** of the following authentication methods must be configured:

### `GOOGLE_API_KEY`

**Type**: String
**Required**: One of the three auth methods
**Default**: None

Google Cloud API Key for authentication.

**Use Case**:
- Quick setup and testing
- Development environments
- Individual developer use

**Requirements**:
- Must be used with `GOOGLE_PROJECT_ID`
- Less secure than service account
- Subject to API key quotas

**Example**:
```json
{
  "env": {
    "GOOGLE_API_KEY": "AIzaSyDk7n...",
    "GOOGLE_PROJECT_ID": "my-project-123"
  }
}
```

**How to get**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services > Credentials
3. Create API Key
4. Enable Vertex AI API

---

### `GOOGLE_SERVICE_ACCOUNT_KEY`

**Type**: String (JSON)
**Required**: One of the three auth methods
**Default**: None

Service account credentials as JSON string.

**Use Case**:
- Production environments
- CI/CD pipelines
- When you cannot use file-based credentials

**Format**: Must be valid JSON string
```json
{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "...",
  "client_id": "...",
  ...
}
```

**Example**:
```json
{
  "env": {
    "GOOGLE_SERVICE_ACCOUNT_KEY": "{\"type\":\"service_account\",\"project_id\":\"my-project\",...}"
  }
}
```

**How to get**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to IAM & Admin > Service Accounts
3. Create or select a service account
4. Create JSON key
5. Convert to single-line string for use in config

---

### `GOOGLE_APPLICATION_CREDENTIALS`

**Type**: String (File Path)
**Required**: One of the three auth methods
**Default**: None

Path to service account JSON key file.

**Use Case**:
- Local development
- When using file-based credentials is convenient
- Standard Google Cloud authentication method

**Format**: Absolute or relative path to JSON file

**Example (Windows)**:
```json
{
  "env": {
    "GOOGLE_APPLICATION_CREDENTIALS": "C:\\projects\\vertexai-imagen-mcp-server\\.private\\service-account.json"
  }
}
```

**Example (macOS/Linux)**:
```json
{
  "env": {
    "GOOGLE_APPLICATION_CREDENTIALS": "/Users/username/.gcloud/service-account.json"
  }
}
```

**How to get**:
1. Create service account key (same as `GOOGLE_SERVICE_ACCOUNT_KEY`)
2. Save the JSON file to a secure location
3. Use the file path in this variable

---

### `GOOGLE_PROJECT_ID`

**Type**: String
**Required**: When using `GOOGLE_API_KEY`, optional for service accounts
**Default**: Auto-detected from service account

Your Google Cloud project ID.

**Use Case**:
- Required for API Key authentication
- Optional for service account (auto-detected)
- Explicitly specify project when using multiple projects

**Example**:
```json
{
  "env": {
    "GOOGLE_PROJECT_ID": "my-vertex-ai-project"
  }
}
```

**How to get**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Copy the Project ID from the dashboard

---

## Google Cloud Configuration

### `GOOGLE_REGION`

**Type**: String
**Required**: No
**Default**: `us-central1`

Google Cloud region for Vertex AI API.

**Supported Regions**:
- `us-central1` (Default, Iowa)
- `us-east1` (South Carolina)
- `us-west1` (Oregon)
- `europe-west1` (Belgium)
- `europe-west4` (Netherlands)
- `asia-east1` (Taiwan)
- `asia-northeast1` (Tokyo)
- `asia-southeast1` (Singapore)

**Example**:
```json
{
  "env": {
    "GOOGLE_REGION": "asia-northeast1"
  }
}
```

**Note**: Choose a region closest to your users for lower latency.

---

### `GOOGLE_IMAGEN_MODEL`

**Type**: String
**Required**: No
**Default**: `imagen-3.0-generate-002`

Default model for image generation.

**Supported Models**:
- `imagen-3.0-generate-002` (Default, Imagen 3)
- `imagen-3.0-generate-001` (Imagen 3, older version)
- `imagen-4.0-generate-001` (Imagen 4, supports 2K)
- `imagen-4.0-ultra-generate-001` (Imagen 4 Ultra, supports 2K)

**Example**:
```json
{
  "env": {
    "GOOGLE_IMAGEN_MODEL": "imagen-4.0-generate-001"
  }
}
```

**Note**: Can be overridden per-request using the `model` parameter.

---

### `GOOGLE_IMAGEN_UPSCALE_MODEL`

**Type**: String
**Required**: No
**Default**: `imagegeneration@002`

Model used for image upscaling.

**Example**:
```json
{
  "env": {
    "GOOGLE_IMAGEN_UPSCALE_MODEL": "imagegeneration@002"
  }
}
```

---

### `GOOGLE_IMAGEN_EDIT_MODEL`

**Type**: String
**Required**: No
**Default**: `imagen-3.0-capability-001`

Model used for image editing and customization.

**Example**:
```json
{
  "env": {
    "GOOGLE_IMAGEN_EDIT_MODEL": "imagen-3.0-capability-001"
  }
}
```

---

## Storage Configuration

### `VERTEXAI_IMAGEN_OUTPUT_DIR`

**Type**: String (Directory Path)
**Required**: No
**Default**: `~/vertexai-imagen-output` or `%USERPROFILE%\vertexai-imagen-output` (Windows)

Directory where generated images are saved.

**Example (Windows)**:
```json
{
  "env": {
    "VERTEXAI_IMAGEN_OUTPUT_DIR": "C:\\Users\\username\\Pictures\\AI-Images"
  }
}
```

**Example (macOS/Linux)**:
```json
{
  "env": {
    "VERTEXAI_IMAGEN_OUTPUT_DIR": "/Users/username/Pictures/AI-Images"
  }
}
```

**Note**: Directory will be created automatically if it doesn't exist.

---

### `VERTEXAI_IMAGEN_DB`

**Type**: String (File Path)
**Required**: No
**Default**: `[OUTPUT_DIR]/data/vertexai-imagen.db`

Path to SQLite database for history and job management.

**Example**:
```json
{
  "env": {
    "VERTEXAI_IMAGEN_DB": "C:\\projects\\data\\imagen-history.db"
  }
}
```

**Note**: Database file will be created automatically.

---

## Thumbnail Settings

### `VERTEXAI_IMAGEN_THUMBNAIL`

**Type**: Boolean String (`"true"` or `"false"`)
**Required**: No
**Default**: `"false"`

Enable automatic thumbnail generation for MCP image responses.

**Use Case**:
- Enable to see image previews in Claude Desktop
- Disable to reduce token usage (~1,500 tokens per image)

**Example**:
```json
{
  "env": {
    "VERTEXAI_IMAGEN_THUMBNAIL": "true"
  }
}
```

**Token Impact**:
- Enabled: ~1,500 additional tokens per image
- Disabled: No thumbnail, file URI only

---

### `VERTEXAI_IMAGEN_THUMBNAIL_SIZE`

**Type**: Integer String
**Required**: No
**Default**: `256`
**Range**: 0-1000

Maximum dimension (width or height) for thumbnails in pixels.

**Example**:
```json
{
  "env": {
    "VERTEXAI_IMAGEN_THUMBNAIL": "true",
    "VERTEXAI_IMAGEN_THUMBNAIL_SIZE": "480"
  }
}
```

**Recommendations**:
- `256`: Fast, low token usage (~800 tokens)
- `480`: Good quality, moderate tokens (~1,500 tokens)
- `640`: High quality, higher tokens (~2,500 tokens)

---

### `VERTEXAI_IMAGEN_THUMBNAIL_QUALITY`

**Type**: Integer String
**Required**: No
**Default**: `80`
**Range**: 0-100

JPEG quality for thumbnail compression.

**Example**:
```json
{
  "env": {
    "VERTEXAI_IMAGEN_THUMBNAIL": "true",
    "VERTEXAI_IMAGEN_THUMBNAIL_QUALITY": "90"
  }
}
```

**Recommendations**:
- `60-70`: Lower quality, smaller size
- `80`: Balanced (default)
- `90-100`: Higher quality, larger size

---

## Metadata Settings

### `VERTEXAI_IMAGEN_EMBED_METADATA`

**Type**: Boolean String (`"true"` or `"false"`)
**Required**: No
**Default**: `"true"`

Enable embedding metadata into generated PNG images.

**Embedded Information**:
- UUID (unique identifier)
- Generation parameters hash
- Tool name
- Model used
- Creation timestamp
- Aspect ratio
- Sample image size

**Example**:
```json
{
  "env": {
    "VERTEXAI_IMAGEN_EMBED_METADATA": "true"
  }
}
```

**Use Case**:
- Track image generation parameters
- Reproduce images with same parameters
- Search history by parameters

---

### `VERTEXAI_IMAGEN_METADATA_LEVEL`

**Type**: Enum String (`"minimal"`, `"standard"`, or `"full"`)
**Required**: No
**Default**: `"standard"`

Level of detail for embedded metadata.

**Levels**:
- `"minimal"`: UUID and timestamp only
- `"standard"`: Core parameters (model, aspect ratio, etc.)
- `"full"`: All parameters including safety settings, negative prompts, etc.

**Example**:
```json
{
  "env": {
    "VERTEXAI_IMAGEN_EMBED_METADATA": "true",
    "VERTEXAI_IMAGEN_METADATA_LEVEL": "full"
  }
}
```

---

## Template Settings

### `VERTEXAI_IMAGEN_TEMPLATES_DIR`

**Type**: String (Directory Path)
**Required**: No
**Default**: `[OUTPUT_DIR]/templates`

Directory for prompt template YAML files.

**Example**:
```json
{
  "env": {
    "VERTEXAI_IMAGEN_TEMPLATES_DIR": "C:\\projects\\imagen-templates"
  }
}
```

**Directory Structure**:
```
templates/
├── portrait.yaml
├── landscape.yaml
└── custom/
    └── my-template.yaml
```

**See Also**: [Template Documentation](./template-usage.md)

---

## Performance Settings

### `VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS`

**Type**: Integer String
**Required**: No
**Default**: `2`
**Range**: 1-10

Maximum number of concurrent background jobs.

**Example**:
```json
{
  "env": {
    "VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS": "3"
  }
}
```

**Recommendations**:
- `1`: Sequential processing, lowest memory usage
- `2`: Default, balanced
- `3-5`: Higher throughput, more memory usage
- `6-10`: High-performance setups only

**Note**: Higher values increase memory usage and API quota consumption.

---

### `VERTEXAI_RATE_LIMIT_MAX_CALLS`

**Type**: Integer String
**Required**: No
**Default**: `60`
**Range**: 1-1000

Maximum number of API calls per time window.

**Example**:
```json
{
  "env": {
    "VERTEXAI_RATE_LIMIT_MAX_CALLS": "100",
    "VERTEXAI_RATE_LIMIT_WINDOW_MS": "60000"
  }
}
```

**Use Case**:
- Prevent quota exhaustion
- Comply with API rate limits
- Control costs

**Recommendations**:
- Check your Vertex AI quota limits
- Default `60` calls/minute is safe for most projects
- Increase cautiously to avoid quota issues

---

### `VERTEXAI_RATE_LIMIT_WINDOW_MS`

**Type**: Integer String (Milliseconds)
**Required**: No
**Default**: `60000` (1 minute)
**Range**: 1000-3600000 (1 second to 1 hour)

Time window for rate limiting in milliseconds.

**Example**:
```json
{
  "env": {
    "VERTEXAI_RATE_LIMIT_MAX_CALLS": "100",
    "VERTEXAI_RATE_LIMIT_WINDOW_MS": "60000"
  }
}
```

**Common Values**:
- `60000`: 1 minute (default)
- `300000`: 5 minutes
- `3600000`: 1 hour

---

## Debug Settings

### `DEBUG`

**Type**: String (any value enables debug)
**Required**: No
**Default**: Not set (debug disabled)

Enable detailed debug logging to stderr.

**Example**:
```json
{
  "env": {
    "DEBUG": "true"
  }
}
```

**Debug Output Includes**:
- Authentication method used
- API request details
- Rate limiting information
- Environment validation results
- Image processing steps

**Note**: Debug logs appear in Claude Desktop logs or console stderr.

---

## Configuration Examples

### Example 1: API Key Authentication (Quick Setup)

```json
{
  "mcpServers": {
    "vertexai-imagen": {
      "command": "npx",
      "args": ["-y", "@dondonudonjp/vertexai-imagen-mcp-server"],
      "env": {
        "GOOGLE_API_KEY": "AIzaSyDk7n...",
        "GOOGLE_PROJECT_ID": "my-project-123"
      }
    }
  }
}
```

---

### Example 2: Service Account File (Recommended)

```json
{
  "mcpServers": {
    "vertexai-imagen": {
      "command": "vertexai-imagen-mcp-server",
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "C:\\projects\\.private\\service-account.json",
        "GOOGLE_PROJECT_ID": "my-project-123"
      }
    }
  }
}
```

---

### Example 3: Production Setup with All Features

```json
{
  "mcpServers": {
    "vertexai-imagen": {
      "command": "vertexai-imagen-mcp-server",
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "C:\\projects\\.private\\service-account.json",
        "GOOGLE_PROJECT_ID": "my-project-123",
        "GOOGLE_REGION": "us-central1",
        "GOOGLE_IMAGEN_MODEL": "imagen-4.0-generate-001",
        "VERTEXAI_IMAGEN_OUTPUT_DIR": "C:\\AI-Images",
        "VERTEXAI_IMAGEN_THUMBNAIL": "true",
        "VERTEXAI_IMAGEN_THUMBNAIL_SIZE": "480",
        "VERTEXAI_IMAGEN_THUMBNAIL_QUALITY": "85",
        "VERTEXAI_IMAGEN_EMBED_METADATA": "true",
        "VERTEXAI_IMAGEN_METADATA_LEVEL": "full",
        "VERTEXAI_IMAGEN_MAX_CONCURRENT_JOBS": "3",
        "VERTEXAI_RATE_LIMIT_MAX_CALLS": "60",
        "VERTEXAI_RATE_LIMIT_WINDOW_MS": "60000"
      }
    }
  }
}
```

---

### Example 4: Development Setup with Debug

```json
{
  "mcpServers": {
    "vertexai-imagen": {
      "command": "vertexai-imagen-mcp-server",
      "env": {
        "GOOGLE_API_KEY": "AIzaSyDk7n...",
        "GOOGLE_PROJECT_ID": "my-dev-project",
        "VERTEXAI_IMAGEN_THUMBNAIL": "true",
        "VERTEXAI_IMAGEN_EMBED_METADATA": "true",
        "DEBUG": "true"
      }
    }
  }
}
```

---

## Validation

All environment variables are validated on server startup (v0.7.0+).

**Validation Rules**:
- At least one authentication method must be set
- `GOOGLE_PROJECT_ID` required when using `GOOGLE_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_KEY` must be valid JSON
- Numeric values must be within specified ranges
- Boolean values must be `"true"` or `"false"`

**Validation Errors**:
If validation fails, the server will:
1. Display detailed error messages
2. Show which variables are invalid
3. Provide configuration examples
4. Suggest troubleshooting steps

---

## Troubleshooting

### Authentication Error

**Problem**: `EnvValidationError: At least one authentication method must be set`

**Solution**: Set one of:
- `GOOGLE_API_KEY` + `GOOGLE_PROJECT_ID`
- `GOOGLE_SERVICE_ACCOUNT_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS`

---

### Invalid JSON Error

**Problem**: `GOOGLE_SERVICE_ACCOUNT_KEY must be valid JSON`

**Solution**: Ensure the JSON is:
1. Properly escaped (quotes, backslashes)
2. Single-line string (no newlines)
3. Valid JSON format

---

### File Not Found Error

**Problem**: Cannot read service account file

**Solution**: For `GOOGLE_APPLICATION_CREDENTIALS`:
1. Check file path is correct
2. Use absolute path (not relative)
3. Escape backslashes on Windows (`\\`)
4. Verify file exists and is readable

---

### Rate Limit Error

**Problem**: API quota exceeded

**Solution**: Adjust rate limiting:
1. Check your Vertex AI quota
2. Decrease `VERTEXAI_RATE_LIMIT_MAX_CALLS`
3. Increase `VERTEXAI_RATE_LIMIT_WINDOW_MS`
4. Enable rate limiting if not already enabled

---

## See Also

- [Quick Start Guide](./QUICK_START.md)
- [README](../README.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md) (if available)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)

---

**Last Updated**: 2025-10-17
**Version**: 0.7.0+
