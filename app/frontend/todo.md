# LLM Chat Service - Development Plan

## Design Guidelines

### Design References
- **ChatGPT UI**: Clean chat interface with model selector
- **Style**: Modern dark theme, minimal, functional

### Color Palette
- Primary Background: #0f0f0f (Deep dark)
- Secondary Background: #1a1a2e (Card/sidebar)
- Accent: #6366f1 (Indigo - buttons, highlights)
- Accent Hover: #818cf8 (Light indigo)
- Text Primary: #f1f5f9 (White-ish)
- Text Secondary: #94a3b8 (Slate gray)
- Border: #2d2d44 (Subtle border)
- User Message BG: #6366f1 (Indigo)
- Assistant Message BG: #1e1e36 (Dark purple-gray)

### Typography
- Font: Inter (sans-serif)
- Heading: font-weight 700, 24px
- Body: font-weight 400, 14-16px

### Key Component Styles
- Chat bubbles: rounded-2xl, subtle shadow
- Model selector: dropdown with dark theme
- Input area: fixed bottom, dark bg with border
- Scrollable chat area

## Project Structure

```
/workspace/app/frontend/
├── .envrc                          # Environment variables
├── .env.local                      # Next.js style env (used by Vite)
├── Dockerfile                      # Multi-stage Docker build
├── deployments/
│   └── helm-chart/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│           ├── deployment.yaml
│           ├── service.yaml
│           ├── configmap.yaml
│           └── ingress.yaml
├── src/
│   ├── context/
│   │   └── ChatContext.tsx          # Chat state management
│   ├── components/
│   │   ├── ModelSelector.tsx        # Model selection dropdown
│   │   ├── ChatMessage.tsx          # Single message bubble
│   │   ├── ChatInput.tsx            # Message input area
│   │   └── ChatWindow.tsx           # Main chat window
│   ├── lib/
│   │   └── api.ts                   # LiteLLM API calls
│   └── pages/
│       └── Index.tsx                # Main page
```

## Tasks

1. Create .envrc and .env.local with LITELLM_BASE_URL and LITELLM_API_KEY
2. Create src/lib/api.ts - API functions for models list and chat completions
3. Create src/context/ChatContext.tsx - State management for chat
4. Create src/components/ModelSelector.tsx - Model selection UI
5. Create src/components/ChatMessage.tsx - Message bubble component
6. Create src/components/ChatInput.tsx - Input area component
7. Create src/components/ChatWindow.tsx - Main chat window combining all
8. Update src/pages/Index.tsx - Main page with ChatWindow
9. Update index.html - Title update
10. Update src/App.tsx - Clean routes
11. Create Dockerfile
12. Create deployments/helm-chart/ files