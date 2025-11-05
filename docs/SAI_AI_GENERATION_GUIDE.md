# SAI AI Generation Guide

## Multi-Provider AI Integration

The TrinityCore SAI Unified Editor supports **4 AI providers** for intelligent script generation:

1. **OpenAI GPT-4** - Cloud-based, highest quality
2. **Claude/Anthropic** - Cloud-based, excellent reasoning
3. **Ollama** - Local LLMs (Llama 2, Mistral, Code Llama, etc.)
4. **LM Studio** - Local API server with various models

---

## 🌐 Cloud Providers

### OpenAI GPT-4

**Best for:** Highest quality generations, production use

**Setup:**
1. Get an API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. In SAI Editor → AI tab → Settings
3. Select "OpenAI" as provider
4. Enter your API key
5. Choose model (GPT-4 Turbo recommended)
6. Save configuration

**Models Available:**
- `gpt-4-turbo-preview` - Latest GPT-4 with 128K context (recommended)
- `gpt-4` - Standard GPT-4 with 8K context
- `gpt-3.5-turbo` - Faster, cheaper, 16K context

**Cost:** ~$0.01-0.03 per generation (depending on complexity)

**Example Configuration:**
```json
{
  "provider": "openai",
  "apiKey": "sk-...your-key...",
  "model": "gpt-4-turbo-preview",
  "temperature": 0.7
}
```

---

### Claude/Anthropic

**Best for:** Complex reasoning, long context windows, safety

**Setup Method 1: Claude Code Max Subscription (No API Key Required)**

If you have **Claude Code with Max subscription**, you can use Claude without a separate API key:

1. In SAI Editor → AI tab → Settings
2. Select "Claude" as provider
3. **Check** "I have Claude Code with Max subscription"
4. Choose model (Claude 3 Opus recommended)
5. Save configuration

**This method is:**
- ✅ FREE if you have Claude Code Max
- ✅ No separate API key needed
- ✅ Direct integration with your subscription
- ✅ Includes Claude 3 Opus (highest quality)

**Note:** For web UI usage, this requires a backend server that integrates with the Claude Code API. The backend should listen at `http://localhost:3001/api/claude-generate`. If you're running the editor directly in the browser without a backend, use Method 2 (API key) instead.

**Setup Method 2: Anthropic API Key (Standard)**

If you want to use your own Anthropic API account:

1. Get an API key from [console.anthropic.com](https://console.anthropic.com/)
2. In SAI Editor → AI tab → Settings
3. Select "Claude" as provider
4. **Uncheck** "I have Claude Code with Max subscription"
5. Enter your API key
6. Choose model (Claude 3 Opus for best quality)
7. Save configuration

**Models Available:**
- `claude-3-opus-20240229` - Highest capability, 200K context
- `claude-3-sonnet-20240229` - Balanced performance, 200K context
- `claude-3-haiku-20240307` - Fastest, lowest cost, 200K context

**Cost (Method 2 only):** Varies by model (~$0.015 per 1K tokens for Opus)

**Example Configuration (Method 1 - Claude Code Max):**
```json
{
  "provider": "claude",
  "useClaudeCodeMax": true,
  "model": "claude-3-opus-20240229",
  "temperature": 0.7
}
```

**Example Configuration (Method 2 - API Key):**
```json
{
  "provider": "claude",
  "apiKey": "sk-ant-...your-key...",
  "model": "claude-3-opus-20240229",
  "temperature": 0.7
}
```

---

## 🖥️ Local Providers (No API Key Required!)

### Ollama

**Best for:** Free, private, offline use, no API costs

**Setup:**

1. **Install Ollama:**
   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.com/install.sh | sh

   # Windows: Download from ollama.com
   ```

2. **Pull a model:**
   ```bash
   # Recommended for SAI generation
   ollama pull llama2:70b      # Best quality (requires 48GB RAM)
   ollama pull llama2:13b      # Good balance (requires 8GB RAM)
   ollama pull mistral:latest  # Fast and capable (requires 4GB RAM)
   ollama pull codellama:34b   # Code-specialized (requires 20GB RAM)
   ollama pull phi:latest      # Smallest/fastest (requires 2GB RAM)
   ```

3. **Start Ollama:**
   ```bash
   ollama serve  # Runs on http://localhost:11434
   ```

4. **Configure in SAI Editor:**
   - Select "Ollama" as provider
   - API URL: `http://localhost:11434` (default)
   - Choose your downloaded model
   - Save configuration

**Models Available:**
- Llama 2 (7B, 13B, 70B) - Meta's open model
- Mistral (7B) - Fast and capable
- Code Llama (7B, 13B, 34B) - Code-specialized
- Phi-2 (2.7B) - Microsoft's small but capable model
- Many more at [ollama.com/library](https://ollama.com/library)

**Cost:** FREE (local compute only)

**Example Configuration:**
```json
{
  "provider": "ollama",
  "apiUrl": "http://localhost:11434",
  "model": "llama2:70b",
  "temperature": 0.7
}
```

---

### LM Studio

**Best for:** GUI-based local model management, easy switching

**Setup:**

1. **Download LM Studio:**
   - Visit [lmstudio.ai](https://lmstudio.ai/)
   - Download for your OS (Windows/macOS/Linux)

2. **Download models in LM Studio:**
   - Open LM Studio
   - Go to "Discover" tab
   - Search and download models:
     - Llama 2 variants
     - Mistral variants
     - Code Llama
     - WizardCoder
     - etc.

3. **Start Local Server:**
   - In LM Studio, go to "Local Server" tab
   - Select your model
   - Click "Start Server"
   - Default: `http://localhost:1234`

4. **Configure in SAI Editor:**
   - Select "LM Studio" as provider
   - API URL: `http://localhost:1234` (default)
   - Model: `local-model`
   - Save configuration

**Cost:** FREE (local compute only)

**Example Configuration:**
```json
{
  "provider": "lmstudio",
  "apiUrl": "http://localhost:1234",
  "model": "local-model",
  "temperature": 0.7
}
```

---

## 📝 Using AI Generation

### Basic Usage

1. **Open SAI Editor**
2. **Go to AI tab** in right sidebar
3. **Enter a description:**
   ```
   A fire mage that casts fireball every 3 seconds and
   summons fire elementals at 50% health
   ```
4. **Click "Generate Script"**
5. **Review the generated script**
6. **Click "Apply to Editor"**

### Advanced Context

For better results, provide context:

**Creature Entry:** `12345`
**Type:** `Humanoid`
**Rank:** `Elite`
**Level:** `60`
**Additional Context:**
```
This is a boss encounter in a raid. The boss should have
3 phases based on health percentage (100%, 66%, 33%).
Each phase should introduce new abilities.
```

### Example Prompts

**Simple Combat NPC:**
```
A warrior NPC that uses Heroic Strike every 5 seconds
```

**Boss with Phases:**
```
A dragon boss with 3 health-based phases:
- Phase 1 (100-66%): Breath attack every 8 seconds
- Phase 2 (66-33%): Summon 2 adds + continue breath
- Phase 3 (33-0%): Enrage, faster attacks
```

**Quest NPC:**
```
A quest giver that says a greeting when players accept
quest 1234 and a farewell when they complete it
```

**Patrol NPC:**
```
A guard that patrols between 4 waypoints, pausing 5
seconds at each point
```

---

## ⚙️ Configuration Tips

### Temperature Settings

- **0.0-0.3:** Very focused, deterministic, consistent
- **0.4-0.7:** Balanced (recommended for most cases)
- **0.8-1.0:** More creative, varied, experimental

### Model Selection

**For High Quality (Cloud):**
- OpenAI: GPT-4 Turbo
- Claude: Claude 3 Opus

**For Cost Efficiency (Cloud):**
- OpenAI: GPT-3.5 Turbo
- Claude: Claude 3 Haiku

**For Local (Free):**
- Best Quality: Llama 2 70B (requires 48GB RAM)
- Good Balance: Llama 2 13B or Mistral 7B
- Fast/Small: Phi-2 (2.7B)

### Provider Comparison

| Provider | Quality | Speed | Cost | Privacy | Setup |
|----------|---------|-------|------|---------|-------|
| GPT-4 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | $$ | ❌ | Easy |
| Claude 3 Opus | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | $$ | ❌ | Easy |
| Ollama (Llama 70B) | ⭐⭐⭐⭐ | ⭐⭐ | FREE | ✅ | Medium |
| Ollama (Mistral) | ⭐⭐⭐ | ⭐⭐⭐⭐ | FREE | ✅ | Medium |
| LM Studio | ⭐⭐⭐⭐ | ⭐⭐⭐ | FREE | ✅ | Easy |

---

## 🔧 Troubleshooting

### OpenAI Issues

**"Invalid API key"**
- Verify key is correct
- Check if key has credits/billing enabled
- Visit platform.openai.com/account/billing

**"Rate limit exceeded"**
- Wait a few seconds
- Upgrade to paid tier
- Use local provider instead

### Claude Issues

**"Authentication failed" (with API key)**
- Verify API key from console.anthropic.com
- Ensure you have an active account
- Check if key has proper permissions

**Using Claude Code Max subscription:**
- Make sure you have checked "I have Claude Code with Max subscription"
- No API key is required when using Max subscription
- Your Claude Code subscription will be used automatically
- Verify your Max subscription is active

**Not sure which method to use?**
- If you have Claude Code Max: Use Method 1 (check the box, no API key)
- If you want to use your own Anthropic credits: Use Method 2 (uncheck the box, enter API key)

### Ollama Issues

**"Connection refused"**
- Check Ollama is running: `ollama list`
- Start server: `ollama serve`
- Verify URL: `http://localhost:11434`

**"Model not found"**
- Pull the model: `ollama pull llama2:13b`
- List available: `ollama list`

**"Out of memory"**
- Use smaller model (7B instead of 70B)
- Close other applications
- Check system requirements

### LM Studio Issues

**"Connection refused"**
- Start Local Server in LM Studio
- Check port (default 1234)
- Verify model is loaded

**"Model too slow"**
- Use GPU acceleration if available
- Use smaller model
- Reduce context window

---

## 💡 Best Practices

### 1. Start with Templates
Use templates as a base, then refine with AI

### 2. Be Specific
More detail = better results:
```
❌ "A mage NPC"
✅ "A level 60 frost mage that casts Frostbolt every
   3 seconds and uses Frost Nova when enemies are close"
```

### 3. Iterate
Generate → Review → Adjust prompt → Regenerate

### 4. Provide Context
Use creature type, rank, level fields for better accuracy

### 5. Validate
Always validate generated scripts before exporting

---

## 🔒 Privacy & Security

**Cloud Providers (OpenAI, Claude):**
- Your prompts are sent to their servers
- Subject to their privacy policies
- Data may be used for improvement (opt-out available)

**Local Providers (Ollama, LM Studio):**
- ✅ Everything runs on your machine
- ✅ No data sent to external servers
- ✅ Complete privacy
- ✅ Works offline

**Recommendation:** Use local providers for sensitive/proprietary content.

---

## 📚 Additional Resources

- [OpenAI Documentation](https://platform.openai.com/docs)
- [Claude Documentation](https://docs.anthropic.com/)
- [Ollama GitHub](https://github.com/ollama/ollama)
- [LM Studio Website](https://lmstudio.ai/)
- [Llama 2 Models](https://ai.meta.com/llama/)
- [Mistral AI](https://mistral.ai/)

---

## 🎯 Quick Start Recommendations

**Have Claude Code Max?** ⭐
→ Use **Claude 3 Opus** (included with subscription, no API key needed!)

**Just Getting Started?**
→ Use **Ollama with Mistral** (free, fast, easy)

**Need Best Quality?**
→ Use **GPT-4 Turbo** or **Claude 3 Opus**

**Working on Proprietary Scripts?**
→ Use **Ollama with Llama 2 70B** (best local quality)

**Want GUI?**
→ Use **LM Studio** (easiest local setup)

---

## Support

For issues or questions:
- GitHub Issues: [trinitycore-mcp/issues](https://github.com/agatho/trinitycore-mcp/issues)
- TrinityCore Forums
- Discord: TrinityCore Development

---

**Generated with ❤️ by TrinityCore SAI Unified Editor v3.0.0**
