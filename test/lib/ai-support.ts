// Mock AI responses for different types of support queries
export interface AIResponse {
  canResolve: boolean
  response: string
  suggestedActions?: string[]
  escalationReason?: string
}

const commonResponses = {
  order_status: {
    canResolve: true,
    response:
      "I can help you track your order! Let me look that up for you. Your order is currently being processed by the vendor and should ship within 1-2 business days. You'll receive a tracking number via email once it ships.",
    suggestedActions: ["Check your email for updates", "Contact vendor directly if urgent"],
  },
  refund_request: {
    canResolve: false,
    response:
      "I understand you'd like to request a refund. This requires review by our customer service team to ensure the best resolution for your specific situation.",
    escalationReason: "Refund requests require human review for policy compliance",
  },
  product_defective: {
    canResolve: false,
    response:
      "I'm sorry to hear about the defective product. This issue needs to be handled by the vendor who sold the item, as they can provide the best solution including replacement or refund options.",
    escalationReason: "Product quality issues require vendor involvement",
  },
  shipping_delay: {
    canResolve: true,
    response:
      "I apologize for the shipping delay. This can happen due to various factors like weather, high demand, or vendor processing time. Most delays resolve within 2-3 additional business days. I can help you contact the vendor for more specific information.",
    suggestedActions: [
      "Wait 2-3 more business days",
      "Contact vendor for updates",
      "Request expedited shipping if available",
    ],
  },
  account_issue: {
    canResolve: true,
    response:
      "I can help with most account-related questions! Common solutions include resetting your password, updating your profile information, or checking your order history. What specific account issue are you experiencing?",
    suggestedActions: ["Reset password", "Update profile", "Check account settings"],
  },
  payment_issue: {
    canResolve: false,
    response:
      "Payment issues require careful review to protect your financial information. I'm connecting you with our secure payment support team who can safely assist with billing questions.",
    escalationReason: "Payment issues require secure handling by specialized team",
  },
}

export const analyzeQuery = async (query: string, orderInfo?: any): Promise<AIResponse> => {
  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const lowerQuery = query.toLowerCase()

  // Simple keyword matching (in a real app, this would use actual AI/NLP)
  if (lowerQuery.includes("order") && (lowerQuery.includes("status") || lowerQuery.includes("track"))) {
    return commonResponses.order_status
  }

  if (lowerQuery.includes("refund") || lowerQuery.includes("return")) {
    return commonResponses.refund_request
  }

  if (lowerQuery.includes("defective") || lowerQuery.includes("broken") || lowerQuery.includes("damaged")) {
    return commonResponses.product_defective
  }

  if (lowerQuery.includes("shipping") && (lowerQuery.includes("delay") || lowerQuery.includes("late"))) {
    return commonResponses.shipping_delay
  }

  if (lowerQuery.includes("account") || lowerQuery.includes("login") || lowerQuery.includes("password")) {
    return commonResponses.account_issue
  }

  if (lowerQuery.includes("payment") || lowerQuery.includes("billing") || lowerQuery.includes("charge")) {
    return commonResponses.payment_issue
  }

  // Default response for unrecognized queries
  return {
    canResolve: false,
    response:
      "I understand you need help, but this seems like a complex issue that would benefit from human assistance. Let me connect you with one of our customer service specialists who can provide personalized support.",
    escalationReason: "Query requires human interpretation and specialized assistance",
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
