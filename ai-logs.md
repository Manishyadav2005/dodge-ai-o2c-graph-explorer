# AI Coding Session Logs

## Tools Used
- ChatGPT (for architecture, debugging, and prompt design)
- VS Code (development environment)

---

## Development Workflow

1. Started by understanding the Order-to-Cash (O2C) domain
2. Designed a graph-based data structure representing:
   - Customers
   - Orders
   - Deliveries
   - Billing
   - Payments
   - Products

3. Used AI to:
   - Generate initial Next.js project structure
   - Build API routes for query handling
   - Integrate Gemini API for natural language understanding

---

## Prompt Engineering

- Designed prompts to restrict queries strictly to O2C domain
- Avoided hallucinations by limiting responses to dataset
- Ensured only structured queries are processed

Example Prompt Strategy:
- "Extract intent from user query related to O2C entities"
- "Reject queries outside dataset scope"

---

## Debugging & Iteration

- Fixed API key issues (GEMINI_API_KEY not set)
- Resolved deployment errors on Vercel
- Handled merge conflicts in GitHub
- Improved query parsing for better accuracy

---

## Key Learnings

- Importance of guardrails in LLM systems
- Handling real-world data inconsistencies
- Combining AI + rule-based systems for reliability

---

## Conclusion

The project demonstrates effective use of AI tools to build a real-world application with practical constraints and domain-specific logic.