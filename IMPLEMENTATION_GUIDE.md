# Cross-Platform File Path Handling - Implementation Guide for MCP Servers

**Author**: Based on openai-gpt-image-mcp-server v1.0.3
**Date**: 2025-10-10
**Purpose**: Guide for implementing cross-platform file path handling in MCP servers

---

## 📋 Table of Contents

1. [Problem Overview](#problem-overview)
2. [Solution Architecture](#solution-architecture)
3. [Implementation Steps](#implementation-steps)
4. [Code Examples](#code-examples)
5. [Testing Checklist](#testing-checklist)
6. [Common Pitfalls](#common-pitfalls)

---

## 🎯 Problem Overview

### The Issue

MCP clients like Claude Desktop run in containers (Linux) but need to access the host filesystem:

```
Claude Desktop (macOS)
  └─> Internal Linux Container
       └─> MCP Server (Node.js)
            └─> Needs to write to macOS filesystem
```

**What Fails:**
```javascript
// ❌ This fails in Claude Desktop on macOS
const outputPath = 'generated_file.png';
fs.writeFile(outputPath, data);  // Error: Can't find path
```

**Why It Fails:**
- Relative paths resolve to container's working directory
- Container working directory != Host filesystem
- No clear default location for files
- Path format differences (Windows `\` vs Unix `/`)

---

## 🏗️ Solution Architecture

### Key Components

1. **Default Output Directory** - Smart cross-platform default
2. **Path Normalization** - Convert relative to absolute paths
3. **Auto-creation** - Create parent directories automatically
4. **Environment Variable** - Allow user customization

### Design Principles

✅ **Zero Configuration** - Works out of the box
✅ **User Accessible** - Files saved in obvious location
✅ **Cross-Platform** - macOS, Windows, Linux compatible
✅ **Customizable** - Users can override default location
✅ **Safe** - Validates paths before API calls

---

## 🔧 Implementation Steps

### Step 1: Create Path Utility Module

Create `src/utils/path.ts`:

```typescript
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Get default output directory (cross-platform)
 *
 * Priority:
 * 1. YOUR_MCP_OUTPUT_DIR environment variable
 * 2. ~/Downloads/your-mcp-files (default)
 */
export function getDefaultOutputDirectory(): string {
  // Check environment variable first
  const envDir = process.env.YOUR_MCP_OUTPUT_DIR;  // ← Change this
  if (envDir) {
    return path.resolve(envDir);
  }

  // Use os.homedir() for cross-platform home directory
  const homeDir = os.homedir();
  const defaultDir = path.join(homeDir, 'Downloads', 'your-mcp-files');  // ← Change this

  return defaultDir;
}

/**
 * Normalize and validate output path (cross-platform)
 *
 * - Absolute paths: used as-is
 * - Relative paths: resolved relative to default output directory
 * - Creates parent directory if it doesn't exist
 */
export async function normalizeAndValidatePath(outputPath: string): Promise<string> {
  let absolutePath: string;

  // If already absolute, use as-is
  if (path.isAbsolute(outputPath)) {
    absolutePath = outputPath;
  } else {
    // Relative path: resolve from default output directory
    const defaultDir = getDefaultOutputDirectory();
    absolutePath = path.join(defaultDir, outputPath);
  }

  // Ensure parent directory exists (create if needed)
  const dir = path.dirname(absolutePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create output directory: ${dir}`);
  }

  return absolutePath;
}

/**
 * Get user-friendly display path
 * Converts absolute path to ~ notation for better readability
 */
export function getDisplayPath(absolutePath: string): string {
  const homeDir = os.homedir();
  if (absolutePath.startsWith(homeDir)) {
    return absolutePath.replace(homeDir, '~');
  }
  return absolutePath;
}
```

### Step 2: Update Your Tool Functions

**Before:**
```typescript
export async function yourTool(params: YourParams): Promise<string> {
  const { output_path = 'default_file.ext' } = params;

  // Call API...
  const result = await api.generate(...);

  // Save file
  await fs.writeFile(output_path, result);  // ❌ Can fail!

  return `File saved: ${output_path}`;
}
```

**After:**
```typescript
import { normalizeAndValidatePath, getDisplayPath } from '../utils/path.js';

export async function yourTool(params: YourParams): Promise<string> {
  const { output_path = 'default_file.ext' } = params;

  // ✅ Normalize path BEFORE API call
  const normalizedPath = await normalizeAndValidatePath(output_path);

  // Call API...
  const result = await api.generate(...);

  // Save file to normalized path
  await fs.writeFile(normalizedPath, result);  // ✅ Always works!

  // Show user-friendly path
  const displayPath = getDisplayPath(normalizedPath);
  return `File saved: ${displayPath}`;
}
```

### Step 3: Update MCP Configuration Documentation

Add environment variable to your setup instructions:

```json
{
  "mcpServers": {
    "your-mcp-server": {
      "command": "your-mcp-server",
      "env": {
        "API_KEY": "your-api-key",
        "YOUR_MCP_OUTPUT_DIR": "/Users/username/Documents/your-files"
      }
    }
  }
}
```

### Step 4: Update Tool Schema (Optional but Recommended)

```typescript
{
  name: 'your_tool',
  description: 'Your tool description. Files are saved to ~/Downloads/your-mcp-files by default.',
  inputSchema: {
    properties: {
      output_path: {
        type: 'string',
        description: 'Output file path. Can be absolute or relative to YOUR_MCP_OUTPUT_DIR (default: ~/Downloads/your-mcp-files)'
      }
    }
  }
}
```

---

## 💻 Code Examples

### Example 1: File Generation Tool

```typescript
interface GenerateParams {
  prompt: string;
  output_path?: string;
}

export async function generateFile(
  client: APIClient,
  params: GenerateParams
): Promise<string> {
  const { prompt, output_path = 'generated_file.txt' } = params;

  // 1. Normalize path FIRST (before expensive API call)
  const normalizedPath = await normalizeAndValidatePath(output_path);

  // 2. Call API
  const result = await client.generate({ prompt });

  // 3. Save file
  await fs.writeFile(normalizedPath, result.content);

  // 4. Return user-friendly message
  const displayPath = getDisplayPath(normalizedPath);
  return `File generated successfully: ${displayPath}`;
}
```

### Example 2: File Download Tool

```typescript
interface DownloadParams {
  url: string;
  output_path?: string;
}

export async function downloadFile(
  params: DownloadParams
): Promise<string> {
  const { url, output_path = 'downloaded_file.bin' } = params;

  // 1. Normalize path
  const normalizedPath = await normalizeAndValidatePath(output_path);

  // 2. Download
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();

  // 3. Save
  await fs.writeFile(normalizedPath, Buffer.from(buffer));

  // 4. Display
  const displayPath = getDisplayPath(normalizedPath);
  return `Downloaded: ${displayPath}`;
}
```

### Example 3: Batch Processing

```typescript
interface BatchParams {
  items: string[];
  output_dir?: string;
}

export async function batchProcess(
  params: BatchParams
): Promise<string> {
  const { items, output_dir = 'batch_output' } = params;

  // Normalize directory path
  const normalizedDir = await normalizeAndValidatePath(output_dir);

  const results: string[] = [];

  for (const [index, item] of items.entries()) {
    const filename = `item_${index + 1}.txt`;
    const filePath = path.join(normalizedDir, filename);

    // Process and save
    const result = await processItem(item);
    await fs.writeFile(filePath, result);

    results.push(filename);
  }

  const displayDir = getDisplayPath(normalizedDir);
  return `Processed ${items.length} items → ${displayDir}\n${results.join('\n')}`;
}
```

---

## ✅ Testing Checklist

### Unit Tests

```typescript
import { describe, it, expect } from 'your-test-framework';
import { normalizeAndValidatePath, getDefaultOutputDirectory } from './path';

describe('Path Utilities', () => {
  it('should handle absolute paths', async () => {
    const result = await normalizeAndValidatePath('/absolute/path/file.txt');
    expect(result).toBe('/absolute/path/file.txt');
  });

  it('should resolve relative paths from default dir', async () => {
    const result = await normalizeAndValidatePath('relative/file.txt');
    expect(result).toContain('Downloads');
    expect(result).toContain('relative/file.txt');
  });

  it('should create parent directories', async () => {
    const result = await normalizeAndValidatePath('deep/nested/dir/file.txt');
    // Should not throw error
    expect(result).toBeDefined();
  });

  it('should respect environment variable', () => {
    process.env.YOUR_MCP_OUTPUT_DIR = '/custom/path';
    const result = getDefaultOutputDirectory();
    expect(result).toBe('/custom/path');
  });
});
```

### Manual Testing

| Platform | Test Case | Expected Result |
|----------|-----------|----------------|
| **macOS** | Relative path `test.txt` | Saved to `~/Downloads/your-mcp-files/test.txt` |
| **Windows** | Relative path `test.txt` | Saved to `C:\Users\username\Downloads\your-mcp-files\test.txt` |
| **Linux** | Relative path `test.txt` | Saved to `/home/username/Downloads/your-mcp-files/test.txt` |
| **All** | Absolute path `/tmp/test.txt` | Saved to `/tmp/test.txt` |
| **All** | With `YOUR_MCP_OUTPUT_DIR=/custom` | Saved to `/custom/test.txt` |
| **All** | Deep path `a/b/c/test.txt` | Creates `a/b/c/` directories automatically |

### Integration Testing in Claude Desktop

1. **Install your MCP server** in Claude Desktop
2. **Test basic operation:**
   ```
   Generate a file called "test.txt"
   ```
   - Check: File appears in `~/Downloads/your-mcp-files/`
   - Check: Success message shows `~/Downloads/your-mcp-files/test.txt`

3. **Test custom directory:**
   - Set `YOUR_MCP_OUTPUT_DIR` in config
   - Generate another file
   - Check: File appears in custom location

4. **Test absolute path:**
   ```
   Generate a file at /Users/yourname/Desktop/absolute_test.txt
   ```
   - Check: File appears on Desktop

---

## ⚠️ Common Pitfalls

### 1. ❌ Don't Use `process.cwd()`

```typescript
// ❌ BAD - Container working directory
const badPath = path.join(process.cwd(), 'file.txt');

// ✅ GOOD - User home directory
const goodPath = path.join(os.homedir(), 'Downloads', 'your-mcp-files', 'file.txt');
```

### 2. ❌ Don't Use `~` Without Expansion

```typescript
// ❌ BAD - Node.js doesn't expand ~
const badPath = '~/Documents/file.txt';
fs.writeFile(badPath, data);  // Error!

// ✅ GOOD - Use os.homedir()
const goodPath = path.join(os.homedir(), 'Documents', 'file.txt');
```

### 3. ❌ Don't Hardcode Path Separators

```typescript
// ❌ BAD - Breaks on Windows
const badPath = homeDir + '/Documents/file.txt';

// ✅ GOOD - Use path.join()
const goodPath = path.join(homeDir, 'Documents', 'file.txt');
```

### 4. ❌ Don't Forget to Create Directories

```typescript
// ❌ BAD - May fail if directory doesn't exist
await fs.writeFile('/path/to/new/dir/file.txt', data);

// ✅ GOOD - Create directory first
await fs.mkdir('/path/to/new/dir', { recursive: true });
await fs.writeFile('/path/to/new/dir/file.txt', data);
```

### 5. ❌ Don't Validate Paths After API Calls

```typescript
// ❌ BAD - Wastes API quota if path is invalid
const result = await expensiveAPICall();  // Costs money!
await fs.writeFile(invalidPath, result);  // Then fails :(

// ✅ GOOD - Validate path first
const validPath = await normalizeAndValidatePath(outputPath);
const result = await expensiveAPICall();  // Only call if path is valid
await fs.writeFile(validPath, result);
```

---

## 🎯 Quick Start Template

Copy this into your MCP server project:

```typescript
// src/utils/path.ts
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

export function getDefaultOutputDirectory(): string {
  const envDir = process.env.YOUR_MCP_OUTPUT_DIR;  // ← Customize
  if (envDir) return path.resolve(envDir);
  return path.join(os.homedir(), 'Downloads', 'your-mcp-files');  // ← Customize
}

export async function normalizeAndValidatePath(outputPath: string): Promise<string> {
  const absolutePath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(getDefaultOutputDirectory(), outputPath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  return absolutePath;
}

export function getDisplayPath(absolutePath: string): string {
  return absolutePath.replace(os.homedir(), '~');
}
```

```typescript
// src/tools/your-tool.ts
import { normalizeAndValidatePath, getDisplayPath } from '../utils/path.js';

export async function yourTool(params: Params): Promise<string> {
  const { output_path = 'default.txt' } = params;
  const normalizedPath = await normalizeAndValidatePath(output_path);

  // Your logic here...
  await fs.writeFile(normalizedPath, data);

  return `Saved: ${getDisplayPath(normalizedPath)}`;
}
```

---

## 📚 References

- **Original Implementation**: [openai-gpt-image-mcp-server](https://github.com/ex-takashima/openAI-gpt-image-1-MCP-SERVER)
- **Node.js path module**: https://nodejs.org/api/path.html
- **Node.js os module**: https://nodejs.org/api/os.html
- **MCP Documentation**: https://modelcontextprotocol.io/

---

## 💡 Tips for Specific Use Cases

### For Audio/Video Files

Use more specific default directory:

```typescript
return path.join(os.homedir(), 'Music', 'your-mcp-audio');
// or
return path.join(os.homedir(), 'Movies', 'your-mcp-video');
```

### For Data/Database Files

Consider using app data directory:

```typescript
// macOS: ~/Library/Application Support/your-mcp
// Windows: %APPDATA%/your-mcp
// Linux: ~/.local/share/your-mcp

const appDataDir = process.env.APPDATA ||
  (os.platform() === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : path.join(os.homedir(), '.local', 'share'));

return path.join(appDataDir, 'your-mcp');
```

### For Temporary Files

```typescript
import * as os from 'os';
return path.join(os.tmpdir(), 'your-mcp-temp');
```

---

**Good luck with your MCP server implementation! 🚀**
