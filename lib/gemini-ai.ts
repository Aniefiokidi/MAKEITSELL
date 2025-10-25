import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

export interface GeminiResponse {
  canResolve: boolean
  response: string
  suggestedActions?: string[]
  escalationReason?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
}

export const analyzeQueryWithGemini = async (
  query: string,
  context?: {
    userId?: string
    userRole?: string
    userEmail?: string
    orderId?: string
    productId?: string
    conversationHistory?: any[]
  }
): Promise<GeminiResponse> => {
  try {
    const prompt = `
You are an intelligent customer support AI for BRANDA marketplace, a unified platform connecting customers with vendors.

**Your Role:**
- Help customers with orders, products, accounts, and general marketplace questions
- Provide accurate, helpful responses based on the marketplace context
- Escalate complex issues to human support when appropriate
- Suggest specific actions customers can take

**Context Information:**
- User ID: ${context?.userId || 'Not provided'}
- User Role: ${context?.userRole || 'customer'}
- User Email: ${context?.userEmail || 'Not provided'}
- Order ID: ${context?.orderId || 'Not provided'}
- Product ID: ${context?.productId || 'Not provided'}
- Conversation History: ${context?.conversationHistory ? JSON.stringify(context.conversationHistory.slice(-3)) : 'None'}

**Customer Query:** "${query}"

**Instructions:**
Analyze this customer query and respond with a JSON object containing:
1. "canResolve": boolean - Can you fully resolve this issue with your response?
2. "response": string - Your helpful response to the customer (be friendly, clear, and actionable)
3. "suggestedActions": string[] - Array of specific actions the customer can take (optional)
4. "escalationReason": string - If can't resolve, explain why human intervention is needed (optional)
5. "priority": string - Priority level if escalation needed: "low", "medium", "high", "urgent" (optional)

**Common Issues You Can Handle:**
- Order status and tracking
- Basic account questions
- General product information
- Shipping timeframes
- Return policies
- Basic troubleshooting

**Issues Requiring Escalation:**
- Payment disputes
- Defective/damaged products
- Refund requests
- Vendor disputes
- Account security issues
- Complex technical problems

Respond ONLY with valid JSON. No additional text or formatting.
`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Clean the response to ensure it's valid JSON
    const cleanedText = text.trim().replace(/```json\s*|\s*```/g, '')

    try {
      const parsedResponse = JSON.parse(cleanedText) as GeminiResponse
      return parsedResponse
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError)
      console.error('Raw response:', text)

      // Fallback response
      return {
        canResolve: false,
        response: "I'm having trouble processing your request right now. Let me connect you with a human support specialist who can better assist you.",
        escalationReason: "AI response parsing failed - technical issue",
        priority: "medium"
      }
    }
  } catch (error) {
    console.error('Gemini AI error:', error)

    // Fallback to basic keyword matching if Gemini fails
    return fallbackKeywordAnalysis(query)
  }
}

// Fallback function using the old keyword-based system
const fallbackKeywordAnalysis = (query: string): GeminiResponse => {
  const lowerQuery = query.toLowerCase()

  if (lowerQuery.includes("order") && (lowerQuery.includes("status") || lowerQuery.includes("track"))) {
    return {
      canResolve: true,
      response: "I can help you track your order! Your order is currently being processed by the vendor and should ship within 1-2 business days. You'll receive a tracking number via email once it ships.",
      suggestedActions: ["Check your email for updates", "Contact vendor directly if urgent"]
    }
  }

  if (lowerQuery.includes("refund") || lowerQuery.includes("return")) {
    return {
      canResolve: false,
      response: "I understand you'd like to request a refund. This requires review by our customer service team to ensure the best resolution for your specific situation.",
      escalationReason: "Refund requests require human review for policy compliance",
      priority: "medium"
    }
  }

  if (lowerQuery.includes("defective") || lowerQuery.includes("broken") || lowerQuery.includes("damaged")) {
    return {
      canResolve: false,
      response: "I'm sorry to hear about the defective product. This issue needs to be handled by the vendor who sold the item, as they can provide the best solution including replacement or refund options.",
      escalationReason: "Product quality issues require vendor involvement",
      priority: "high"
    }
  }

  if (lowerQuery.includes("payment") || lowerQuery.includes("billing") || lowerQuery.includes("charge")) {
    return {
      canResolve: false,
      response: "Payment issues require careful review to protect your financial information. I'm connecting you with our secure payment support team who can safely assist with billing questions.",
      escalationReason: "Payment issues require secure handling by specialized team",
      priority: "high"
    }
  }

  // Default fallback
  return {
    canResolve: false,
    response: "I understand you need help, but this seems like a complex issue that would benefit from human assistance. Let me connect you with one of our customer service specialists who can provide personalized support.",
    escalationReason: "Query requires human interpretation and specialized assistance",
    priority: "medium"
  }
}

export const generateFollowUpQuestions = (category: string): string[] => {
  const followUps: Record<string, string[]> = {
    order_status: [
      "What's your order number?",
      "When did you place the order?",
      "Have you received any shipping notifications?",
    ],
    refund_request: [
      "What's the reason for the refund?",
      "When did you receive the item?",
      "Do you have the order number?",
    ],
    product_defective: [
      "Can you describe the defect?",
      "When did you receive the item?",
      "Do you have photos of the issue?",
    ],
    shipping_delay: [
      "What was the expected delivery date?",
      "Have you contacted the vendor?",
      "Is this time-sensitive?",
    ],
  }

  return (
    followUps[category] || [
      "Can you provide more details?",
      "When did this issue start?",
      "Have you tried any solutions already?",
    ]
  )
}