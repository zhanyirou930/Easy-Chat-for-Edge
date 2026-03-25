# EasyChat for Edge - Changelog

## Latest Features v2.0

### 🎭 Local Avatar Upload System
- **Support user avatar uploads**
  - Upload local images as user and AI avatars in settings
  - Support all common image formats (JPG, PNG, GIF, WebP, etc.)
  - Images stored in Base64 format, no external links needed
  - Can clear custom avatars anytime to restore defaults
  - Default uses Emoji expressions (👤 User, 🤖 AI)

### 📋 Multiple Profile Management
- **Support creating and managing multiple profiles**
  - Create independent configurations for different AI models
  - Each profile saves complete API settings, parameters and avatars
  - Quickly switch between different profiles
  - Support deleting non-default profiles
  - Currently active profile is highlighted

### 🤖 Support All Mainstream AI Models
- **OpenAI Series**
  - GPT-5.x series (5.4, 5.3, 5.2, 5.1, 5.0)
  - GPT-4o / GPT-4o Mini
  - GPT-4 Turbo / GPT-4
  - GPT-3.5 Turbo
  - o1 / o1-mini / o3-mini (reasoning models)

- **Claude Series**
  - Claude 3.5 Sonnet
  - Claude 3.5 Haiku
  - Claude 3 Opus

- **Google Gemini Series**
  - Gemini 2.0 Flash
  - Gemini 1.5 Pro
  - Gemini 1.5 Flash

- **DeepSeek Series**
  - DeepSeek Chat
  - DeepSeek Reasoner

- **Other Models**
  - Grok 2
  - Llama 3.3 70B
  - Qwen Max
  - Custom models

### ⚠️ Data Management
- **One-click clear all data**
  - New "Clear All Data" feature
  - Clears all conversations, configurations, avatars, etc.
  - Double confirmation to prevent accidental operations
  - Auto reload page after clearing

### 🎨 Bubble Design Upgrade
- **New gradient design**
  - User messages: Purple-blue gradient (#667eea → #764ba2)
  - AI messages: Dark theme colors with borders and shadows
  - Optimized rounded corners, more modern
  - Removed potentially infringing decorative elements

- **Avatar style optimization**
  - Avatars with gradient borders
  - User avatar: Purple-blue gradient border
  - AI avatar: Green gradient border
  - Default uses Emoji expressions, clean and beautiful

## Previous Features

### Custom Avatar System
- ✨ **Support custom avatar URLs**
  - Enter custom user and AI avatar URLs in settings
  - Support image links starting with http:// or https://
  - Leave empty to use default avatars

### Streaming Control
- ⚡ **Optional streaming**
  - Enable/disable streaming in settings
  - Streaming: Real-time display of AI replies, render as generated
  - Non-streaming: Display complete response at once

### Real-time Markdown Rendering
- 📝 **Beautify Markdown during streaming**
  - Auto-render Markdown every 100ms during streaming
  - Real-time display of formatted headings, lists, code blocks, etc.
  - Final complete render when finished
  - Provides smoother reading experience

### Web Search Feature
- 🌐 **Integrated Tavily API**
  - Configure Tavily API Key in settings
  - Click 🌐 button in top bar to enable/disable web search
  - Search results automatically appended to user messages

### Batch Management
- 🗑️ **Clear all conversations**
  - New "Clear All Conversations" button at bottom of sidebar
  - Delete operations use confirmation dialog to avoid mistakes

## Usage Instructions

### Upload Custom Avatars
1. Click "Settings" in the sidebar
2. Find "User Avatar" or "AI Avatar" in "Interface Settings"
3. Click "Upload Image" button, select local image file
4. Save settings to take effect
5. Click "Clear" button to remove custom avatar

### Manage Profiles
1. Click "📋 Profile Management" in the sidebar
2. Enter new profile name, click "Create"
3. Click "Load" in profile list to switch to that profile
4. Click "Delete" to remove unwanted profiles (except default)
5. Each profile independently saves API settings, parameters and avatars

### Configure Streaming
1. Click "Settings" in the sidebar
2. Check or uncheck "Enable Streaming" in "Interface Settings"
3. Save settings
4. Streaming will display AI replies in real-time and auto-render Markdown

### Configure Web Search
1. Click "Settings" in the sidebar
2. Enter your API key in "Tavily API Key" field
3. Save settings
4. Click 🌐 button in top bar to enable web search

### Clear All Data
1. Click "⚠️ Clear All Data" button at bottom of sidebar
2. Confirm operation
3. All data will be cleared, page auto reloads

## Technical Details

### New Configuration Items
- `streamEnabled` - Enable streaming (default: true)
- `userAvatar` - User avatar Base64 data (default: empty, shows Emoji)
- `aiAvatar` - AI avatar Base64 data (default: empty, shows Emoji)
- `profiles` - Profile object, stores multiple configurations
- `currentProfile` - Currently active profile name

### Supported AI Models
- OpenAI GPT series (GPT-5.x, GPT-4o, GPT-4, GPT-3.5, o1/o3)
- Anthropic Claude series (Claude 3.5, Claude 3)
- Google Gemini series (Gemini 2.0, Gemini 1.5)
- DeepSeek series (Chat, Reasoner)
- Other models (Grok, Llama, Qwen, etc.)

### Code Changes
- `chat.html` - Added profile management interface, avatar upload buttons, clear all data button, new AI model options
- `chat.js` - Implemented profile management, local avatar upload, clear all data, streaming/non-streaming toggle, real-time Markdown rendering
- CSS style updates - Optimized bubble gradient effects, avatar border styles, removed infringing decorative elements

### Removed Files
- `icons/avatar.jpg` - Removed potentially infringing user avatar
- `icons/ai_avatar.jpg` - Removed potentially infringing AI avatar
- `icons/peek.png` - Removed potentially infringing decorative image
- `icons/peek_hand.png` - Removed potentially infringing decorative image

## Open Source Ready
This version is ready for open source release. All features have been tested and work properly. All potentially infringing content has been removed.
