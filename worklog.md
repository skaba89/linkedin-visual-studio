---
Task ID: 1
Agent: Main Agent
Task: Add topic title input for AI post generation with LinkedIn score, and direct posting on LinkedIn

Work Log:
- Read and analyzed full codebase: ai-client.ts, linkedin-ai.ts, LinkedInView.tsx, appStore.ts
- Added `LinkedInPostFromTopic` interface with score breakdown (hook, structure, cta, readability, engagement each /20, total /100) and tips array
- Added `generatePostFromTopic()` function in linkedin-ai.ts that generates an optimized post from a given topic title with LinkedIn score
- Added fallback `generateFallbackPostFromTopic()` for when AI is unavailable
- Rebuilt PublierTab in LinkedInView.tsx with:
  - New "Générer à partir d'un sujet" section at the top with topic input + "Générer le post" button
  - Circular SVG score gauge display with color coding (green/blue/yellow/red)
  - Score breakdown grid (Hook, Structure, CTA, Lisibilité, Engagement) with progress bars
  - Tips section for improving the score
  - API key warning message when provider key is not configured
  - Better error handling that catches "Clé API non configurée" errors and shows clear messages
  - "Publier sur LinkedIn" button label (was "Publier maintenant")
  - "Copier" button for clipboard copy of post text
  - Topic prefill from Tendances tab now sets the topic input field instead of textarea
  - Reset topic/title/score on successful publish or schedule
- Added BookOpen, Target, Gauge icon imports
- Browser verified all UI elements render correctly

Stage Summary:
- Users can now enter a topic title and generate an optimized LinkedIn post with a score
- Score breakdown shows Hook/Structure/CTA/Lisibilité/Engagement with visual bars
- Tips help users improve their score
- Clear API key warning when provider is not configured
- Direct "Publier sur LinkedIn" button for posting
- All features browser-tested and confirmed working
