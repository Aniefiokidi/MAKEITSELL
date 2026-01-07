import { GoogleGenerativeAI } from '@google/generative-ai'

// Use client-side environment variable with fallback
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY

if (!apiKey) {
  console.warn('Gemini API key not found. AI features will be limited.')
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-pro' }) : null

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
    userName?: string
    userRole?: string
    userEmail?: string
    orderId?: string
    productId?: string
    conversationHistory?: any[]
  }
): Promise<GeminiResponse> => {
  try {
    // Check if API key is valid (not placeholder values)
    if (!apiKey || 
        apiKey === 'your_api_key_here' || 
        apiKey === 'your_actual_api_key_here' || 
        apiKey.length < 10) {
      console.log('Using fallback analysis - no valid Gemini API key')
      return fallbackKeywordAnalysis(query, context)
    }

    // Fallback response when model is not available
    if (!model) {
      console.log('Using fallback analysis - no Gemini model')
      return fallbackKeywordAnalysis(query, context)
    }
    const prompt = `
You are an exceptionally intelligent customer support AI for Make It Sell marketplace, with advanced reasoning capabilities comparable to ChatGPT or Google Bard.

**Your Intelligence:**
- Think logically and infer what users really need, even if they don't state it explicitly
- Use common sense reasoning to understand context and intent
- Connect dots between different pieces of information
- Anticipate follow-up needs and provide comprehensive solutions
- Understand implied questions and provide complete answers

**Reasoning Examples:**
- "how do I register" → User wants to create an account, provide registration steps
- "I can't find my order" → User needs order tracking help, ask for order details
- "it's not working" → Ask what specifically isn't working and troubleshoot systematically
- "I'm having issues" → Probe deeper to understand the specific problem

**Your Personality:**
- Conversational and natural, like talking to a smart friend who gets it
- Contextually aware of the entire conversation and marketplace dynamics
- Proactive in understanding user intent and needs
- Think before responding - what would a human customer service expert do?
- Show genuine understanding and empathy for user situations

**Context Information:**
- User Name: ${context?.userName || 'valued customer'}
- User ID: ${context?.userId || 'Not provided'}
- User Role: ${context?.userRole || 'customer'}  
- User Email: ${context?.userEmail || 'Not provided'}
- Order ID: ${context?.orderId || 'Not provided'}
- Product ID: ${context?.productId || 'Not provided'}
- Conversation History: ${context?.conversationHistory ? JSON.stringify(context.conversationHistory.slice(-3)) : 'None'}

**Current Query:** "${query}"

**Instructions:**
1. THINK FIRST: What does the user really want? What's the underlying need?
2. Use logical reasoning to understand context, even with incomplete information
3. ALWAYS use the customer's name naturally in conversation when available
4. Recognize and respond to casual greetings appropriately (like "how are you", "what's up", etc.)
5. Be conversational and friendly - you can have brief social interactions before helping
6. Analyze queries with common sense - infer intent from context
7. Provide comprehensive, practical responses that solve the actual problem
8. If someone asks "what can you do", don't just list features - explain how you can help their specific situation
9. Be conversational, not robotic. Use natural language patterns and emojis when appropriate
10. Ask intelligent follow-up questions that show you understand their situation
11. Remember and reference previous parts of the conversation
12. Provide specific, actionable advice tailored to their exact needs
13. Show understanding of marketplace dynamics and common user pain points
14. Be proactive - anticipate what they might need next and address it
15. Handle casual conversation naturally before transitioning to business
16. Use reasoning skills: if they say "register" they mean create account, if "login issues" they can't access account, etc.

**Marketplace Knowledge:**
- Orders: Processing (1-2 days) → Shipped (1-3 days) → Delivered (varies by location)
- Returns: 30-day window, vendor-specific policies, keep packaging/receipts
- Payments: Secure processing, 1-2 day authorization, dispute resolution available
- Vendors: Independent sellers, direct communication encouraged, quality varies
- Account issues: Password resets, profile updates, notification preferences
- Seller program: Application process, verification required, commission structure

**Response Format (JSON):**
{
  "canResolve": boolean,
  "response": "Natural, conversational response that feels human-like and intelligent",
  "suggestedActions": ["Specific next steps if relevant"],
  "escalationReason": "Only if human intervention truly needed",
  "priority": "low|medium|high|urgent"
}

Remember: You're not just answering questions - you're having an intelligent conversation and solving problems proactively.
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

    // Check if it's an API key error and use fallback immediately
    if (error?.message?.includes('API key not valid') || 
        error?.message?.includes('API_KEY_INVALID') ||
        error?.status === 400) {
      console.log('Invalid API key detected, using intelligent fallback')
      return fallbackKeywordAnalysis(query, context)
    }

    // For other errors, also use fallback
    console.log('Gemini AI error, using fallback system')
    return fallbackKeywordAnalysis(query, context)
  }
}

// Highly intelligent fallback with advanced reasoning capabilities
const fallbackKeywordAnalysis = (query: string, context?: { userName?: string }): GeminiResponse => {
  const lowerQuery = query.toLowerCase()
  const userName = context?.userName && context.userName !== 'there' ? context.userName : null
  const greeting = userName ? `${userName}` : 'there'

  // INTELLIGENT REASONING: Registration/Account Creation
  if (lowerQuery.includes('register') || lowerQuery.includes('sign up') || lowerQuery.includes('create account') || lowerQuery.includes('how do i join') || lowerQuery.includes('new account')) {
    return {
      canResolve: true,
      response: `${greeting}, I'll help you get signed up! It's really easy and only takes a couple minutes.

Here's how to create your account:

1. Look for the "Sign Up" button at the top right of the page
2. Enter your email and create a password
3. Fill in your name and basic info
4. Check your email and click the verification link
5. That's it - you're ready to start shopping!

Once you're signed up, you can save your favorite items, track orders, and even become a seller later if you want.

Ready to get started, or do you have any questions about signing up?`,
      suggestedActions: [
        "Click 'Sign Up' in the top navigation",
        "Prepare your email and choose a strong password",
        "Check your email for verification after signing up",
        "Tell me if you want to buy or sell (or both)"
      ]
    }
  }

  // REASONING: Login/Access Issues
  if (lowerQuery.includes('login') || lowerQuery.includes('log in') || lowerQuery.includes('sign in') || lowerQuery.includes('cant access') || lowerQuery.includes("can't get in") || lowerQuery.includes('password') || lowerQuery.includes('account') && (lowerQuery.includes('locked') || lowerQuery.includes('blocked'))) {
    return {
      canResolve: true,
      response: `${greeting}, I can help you get back into your account! Account access issues are really frustrating, so let's get this sorted quickly.

First, let's try the most common solutions:

**If you forgot your password:**
• Click "Forgot Password" on the login page
• Enter your email address (the same one you used to register)
• Check your email for the reset link (including spam folder)
• Create a new password and try logging in

**If you remember your password but it's not working:**
• Make sure Caps Lock is off
• Try typing your password in a text editor first to make sure it's correct
• Clear your browser cache and cookies, then try again
• Try logging in with an incognito/private browser window

**If your account is locked:**
• This usually happens after too many failed login attempts
• Wait about 15-30 minutes, then try again
• Or use the password reset option to unlock it

What specific problem are you running into? Are you getting any error messages, or is it just not accepting your credentials?`,
      suggestedActions: [
        "Try the 'Forgot Password' reset process",
        "Check your spam folder for reset emails", 
        "Clear browser cache and try incognito mode",
        "Tell me the exact error message you're seeing"
      ]
    }
  }

  // REASONING: Complaints and negative feedback
  if (lowerQuery.includes('complain') || lowerQuery.includes('angry') || lowerQuery.includes('frustrated') || lowerQuery.includes('terrible') || lowerQuery.includes('awful') || lowerQuery.includes('worst') || lowerQuery.includes('hate') || lowerQuery.includes('disappointed')) {
    return {
      canResolve: true,
      response: `${greeting}, I can hear that you're really frustrated, and I completely understand. When things don't go as expected, it's totally natural to be upset. Let me help make this right.

I want to listen to what happened and see how we can fix this situation for you. Whether it's a bad product, poor service, shipping issues, or anything else - your experience matters to us.

**Here's what I can do:**
• Help you get refunds or replacements for defective items
• Escalate issues with vendors who aren't responding
• Guide you through dispute resolution if needed
• Connect you with our customer service team for complex issues

**Most importantly**: I want to understand exactly what went wrong so we can prevent it from happening to other customers too.

Can you tell me what specifically happened? I'm here to listen and help you get the resolution you deserve. Don't hold back - I want to know the whole story so I can help properly.`,
      suggestedActions: [
        "Tell me exactly what went wrong",
        "Share details about the vendor or product involved",
        "Let me know what outcome you're hoping for",
        "Consider escalating to human support if needed"
      ]
    }
  }

  // REASONING: Positive feedback and compliments
  if (lowerQuery.includes('great') || lowerQuery.includes('awesome') || lowerQuery.includes('excellent') || lowerQuery.includes('love') || lowerQuery.includes('amazing') || lowerQuery.includes('perfect') || lowerQuery.includes('thank you') || lowerQuery.includes('satisfied')) {
    return {
      canResolve: true,
      response: `${greeting}, that's absolutely wonderful to hear! 😊 It really makes my day when customers have positive experiences. I love hearing success stories!

**I'm so glad you're happy!** Whether it's a great product, excellent vendor service, smooth delivery, or just enjoying the marketplace experience - positive feedback like yours is what keeps us motivated to keep improving.

**Want to spread the love?**
• Consider leaving a review for the vendor - it really helps other customers and small businesses
• Tell friends about products you love
• Check out our deals section for more great finds

**Need anything else?**
Even when things are going great, I'm here if you need help with anything else - tracking other orders, finding similar products, or just general marketplace questions.

What specifically made your experience so positive? I'd love to hear more details!`,
      suggestedActions: [
        "Leave a positive review for the vendor",
        "Browse for similar products you might like",
        "Check out current deals and promotions",
        "Share what made your experience so great"
      ]
    }
  }

  // REASONING: Vendor communication issues
  if (lowerQuery.includes('vendor') || lowerQuery.includes('seller') || lowerQuery.includes('store') || lowerQuery.includes('merchant') || lowerQuery.includes('not responding') || lowerQuery.includes('no reply') || lowerQuery.includes('contact seller')) {
    return {
      canResolve: true,
      response: `${greeting}, vendor communication can sometimes be tricky since they're independent sellers with different response times and styles. Let me help you navigate this:

**How to Contact Vendors:**
• Go to their store page and use the "Contact Seller" button
• Be specific about your order number and issue
• Give them 24-48 hours to respond (many are small businesses)
• Check your spam folder for replies

**If Vendors Aren't Responding:**
• Try contacting them through a different method if available
• Be patient - they might be dealing with high order volume
• If it's urgent (like a defective product), let me know and I can escalate
• For persistent non-response, we can step in to help

**What Works Best:**
• Be polite and clear about what you need
• Include your order number and relevant details
• Explain the specific issue and desired resolution
• Ask specific questions rather than vague complaints

**When to Escalate to Us:**
• No response after 3-5 business days
• Vendor is being unreasonable or rude
• Product quality issues they won't address
• Disputes about returns or refunds

What's the situation with your vendor? Are they not responding, or is there a specific issue you need help communicating about?`,
      suggestedActions: [
        "Contact the vendor through their store page with specific details",
        "Wait 24-48 hours for a response before following up",
        "Include your order number and clear description of the issue",
        "Let me know if you need help escalating the situation"
      ]
    }
  }

  // REASONING: Wishlist, favorites, and account features
  if (lowerQuery.includes('wishlist') || lowerQuery.includes('favorites') || lowerQuery.includes('save') || lowerQuery.includes('bookmark') || lowerQuery.includes('later') || lowerQuery.includes('remind') || lowerQuery.includes('notification')) {
    return {
      canResolve: true,
      response: `${greeting}, great question! Managing your favorites and getting notifications can make your shopping experience so much better. Here's how to make the most of these features:

**Saving Items for Later:**
• Click the heart icon on product pages to add to favorites
• Access your saved items from your account dashboard
• Items stay saved even if you log out
• You can organize them into different lists if available

**Getting Notifications:**
• **Price drops**: Get alerted when saved items go on sale
• **Back in stock**: Know when out-of-stock items return
• **Order updates**: Track shipping and delivery automatically
• **New arrivals**: Follow vendors to see their latest products

**Managing Your Preferences:**
• Go to account settings to control what notifications you receive
• Choose email, SMS, or in-app notifications (or combinations)
• Set frequency preferences so you're not overwhelmed

**Pro Tips:**
• Save items during your browsing sessions to compare later
• Follow vendors whose style you like
• Check your favorites regularly for price changes or sales

What specifically would you like to save or get notified about? I can walk you through the exact steps!`,
      suggestedActions: [
        "Click the heart icon to save items you like",
        "Check your account settings for notification preferences",
        "Follow vendors whose products interest you",
        "Tell me what specific items or updates you want to track"
      ]
    }
  }

  // REASONING: Smart capability inquiry - when user asks "what can you do"
  if (lowerQuery.includes('what can you do') || lowerQuery.includes('how can you help') || lowerQuery.includes('what are you capable of') || lowerQuery.includes('help me with')) {
    return {
      canResolve: true,
      response: `Hey ${greeting}! Great question - I'm here as your intelligent assistant and I can help you with quite a lot actually. Think of me as your personal marketplace guide who actually understands what you need.

I can help you track down lost orders, figure out tricky return policies, solve account headaches, navigate payment issues, guide you through becoming a seller, and troubleshoot technical problems. What makes me different is that I actually think about your situation and give you specific, practical advice.

For example:
• If you say "I can't find my order," I'll help you track it down step by step
• If you say "how do I return this," I'll explain the exact process for your situation  
• If you say "I'm having issues," I'll dig deeper to understand what's really wrong

I'm pretty good at reading between the lines and understanding what you actually need, even if you don't say it perfectly.

What's on your mind today? What specific challenge can I help you tackle?`,
      suggestedActions: [
        "Tell me about a specific issue you're having",
        "Ask about an order you're tracking",
        "Get help with your account or login",
        "Learn about selling on the platform"
      ]
    }
  }

  // REASONING: Seller performance and sales tracking
  if ((lowerQuery.includes('sales') && (lowerQuery.includes('made') || lowerQuery.includes('my sales') || lowerQuery.includes('how many'))) || lowerQuery.includes('seller dashboard') || lowerQuery.includes('vendor performance') || lowerQuery.includes('my earnings') || lowerQuery.includes('sales report')) {
    return {
      canResolve: true,
      response: `${greeting}, I can help you check your sales performance as a seller!

Here's how to see your sales data:

1. Go to your Seller Dashboard (click your profile, then "Seller Dashboard")
2. You'll see your key stats right on the main page:
   - Total sales this month
   - Number of orders completed  
   - Your current earnings
   - Recent order activity

3. For detailed reports, look for the "Analytics" or "Reports" section
4. You can filter by different time periods (last week, month, year)

**What you can track:**
• How many items you've sold
• Your total earnings and pending payments
• Which products are your best sellers
• Customer reviews and ratings
• Order fulfillment times

**Not a seller yet?** You can apply to become one through the "Become a Seller" option in the main menu.

Want me to help you find any specific sales information?`,
      suggestedActions: [
        "Go to your Seller Dashboard to see current stats",
        "Check the Analytics section for detailed reports",
        "Apply to become a seller if you haven't yet",
        "Tell me what specific sales info you need"
      ]
    }
  }

  // REASONING: Sales, deals, and promotions (for buyers)
  if (lowerQuery.includes('sales') || lowerQuery.includes('deals') || lowerQuery.includes('discounts') || lowerQuery.includes('promotions') || lowerQuery.includes('offers') || lowerQuery.includes('coupons') || lowerQuery.includes('what about sales') || lowerQuery.includes('any sales') || lowerQuery.includes('on sale')) {
    return {
      canResolve: true,
      response: `${greeting}, great question about sales and deals! I love helping people find good discounts.

Here's where to find the best deals:

1. Check the "Deals" section in the main menu - that's where all the current sales are
2. Look for red "SALE" badges on products while browsing
3. Follow your favorite vendors - they often notify followers about special offers
4. Sign up for email alerts to get notified about flash sales

**Types of deals you'll find:**
• Daily deals that change every 24 hours
• Seasonal sales (holidays, back-to-school, etc.)
• Clearance items when vendors need to clear inventory
• Bundle deals when you buy multiple items together
• First-time buyer discounts from some vendors

**Pro tip:** Add items to your wishlist - you'll get notifications if they go on sale!

Want me to help you find deals on anything specific?`,
      suggestedActions: [
        "Browse the Deals section for current sales",
        "Look for sale badges while shopping",
        "Add items to your wishlist to track price drops",
        "Tell me what type of products you want deals on"
      ]
    }
  }

  // REASONING: Product-related queries
  if (lowerQuery.includes('product') || lowerQuery.includes('item') || lowerQuery.includes('where is') || lowerQuery.includes('find') || lowerQuery.includes('search') || lowerQuery.includes('looking for')) {
    return {
      canResolve: true,
      response: `${greeting}, I can definitely help you find what you're looking for! Whether you're searching for a specific product or just browsing, I've got you covered.

**To find products:**
• Use the search bar at the top - it searches product names, descriptions, and categories
• Browse by categories in the main menu
• Check out featured products on the homepage
• Use filters to narrow down by price, brand, or ratings

**If you're looking for something specific:**
Tell me what product you need and I can give you tips on the best way to find it. Sometimes the trick is using different search terms or checking related categories.

**If a product seems missing:**
It might be out of stock, discontinued, or listed under a different name. I can help you find alternatives or contact the vendor directly.

What specifically are you trying to find? I can give you more targeted search advice.`,
      suggestedActions: [
        "Tell me what product you're looking for",
        "Try using the search bar with different keywords",
        "Browse categories that match your needs",
        "Check if the item might be listed under a different name"
      ]
    }
  }

  // REASONING: Pricing and payment queries
  if (lowerQuery.includes('price') || lowerQuery.includes('cost') || lowerQuery.includes('expensive') || lowerQuery.includes('cheap') || lowerQuery.includes('payment') || lowerQuery.includes('pay') || lowerQuery.includes('charge') || lowerQuery.includes('fee')) {
    return {
      canResolve: true,
      response: `${greeting}, I can help you understand pricing and payment options! Let me break this down for you:

**About Pricing:**
• Each vendor sets their own prices - we don't control individual product costs
• Prices include the item cost plus any shipping fees (varies by vendor location)
• Look for deals and discounts on the homepage or deals section
• Compare similar products from different vendors for the best value

**Payment Options:**
• We accept all major credit cards (Visa, MasterCard, American Express)
• PayPal and other secure digital payment methods
• Payment processing is secure and usually takes 1-2 business days to appear on your statement

**If you're seeing unexpected charges:**
Check your order history first - it might be a purchase you forgot about or a delayed charge from a previous order.

**Looking for better prices?**
Try checking multiple vendors for the same item, look for bulk discounts, or browse our deals section.

Is there a specific pricing question or payment issue I can help you with?`,
      suggestedActions: [
        "Check your order history for recent purchases",
        "Browse the deals section for discounts",
        "Compare prices between different vendors",
        "Tell me about any specific payment issues"
      ]
    }
  }

  // REASONING: Shipping and delivery concerns
  if (lowerQuery.includes('shipping') || lowerQuery.includes('delivery') || lowerQuery.includes('when will') || lowerQuery.includes('how long') || lowerQuery.includes('fast') || lowerQuery.includes('slow') || lowerQuery.includes('tracking')) {
    return {
      canResolve: true,
      response: `${greeting}, shipping questions are super common! Let me give you the complete picture on how delivery works here:

**Shipping Timeline:**
• **Processing**: 1-2 business days (vendor prepares your order)
• **Shipping**: 1-5 business days (depends on vendor location and your location)
• **Total**: Usually 2-7 business days from order to doorstep

**Tracking Your Order:**
• You'll get a tracking number via email once it ships
• Check your account dashboard for real-time order status
• Sometimes tracking emails end up in spam - always check there

**Why might shipping be delayed?**
• High demand periods (holidays, sales)
• Weather or shipping carrier delays
• Item needs to be restocked
• Vendor is processing a large volume of orders

**Want faster shipping?**
Look for vendors in your area or check if express shipping options are available during checkout.

Are you tracking a current order, or planning a purchase and want to know timing?`,
      suggestedActions: [
        "Check your order status in your account dashboard",
        "Look for tracking emails (including spam folder)",
        "Contact the vendor directly for specific timing",
        "Choose vendors closer to your location for faster delivery"
      ]
    }
  }

  // REASONING: Order modifications and cancellations
  if (lowerQuery.includes('cancel') || lowerQuery.includes('change order') || lowerQuery.includes('modify') || lowerQuery.includes('wrong') || lowerQuery.includes('mistake') || lowerQuery.includes('ordered wrong')) {
    return {
      canResolve: true,
      response: `${greeting}, I totally understand - sometimes we need to change or cancel orders! The good news is there are usually options, depending on the timing.

**For Cancellations:**
• **If just ordered**: Contact the vendor immediately through their store page - they can often cancel before processing
• **If being processed**: Check your order status - if it hasn't shipped yet, cancellation might still be possible
• **If already shipped**: You'll need to wait for delivery and then return the item

**For Order Changes:**
• **Address changes**: Contact vendor ASAP - they can sometimes update before shipping
• **Item changes**: Usually need to cancel original order and place new one
• **Quantity changes**: Vendor might be able to modify if caught early

**Quick action is key!**
The sooner you reach out, the more options you have. Vendors are usually pretty understanding about honest mistakes.

What specifically do you need to change or cancel? I can give you the exact steps for your situation.`,
      suggestedActions: [
        "Contact the vendor immediately through their store page",
        "Check your order status to see if it's shipped yet",
        "Explain the situation clearly to the vendor",
        "Be prepared to return and reorder if already shipped"
      ]
    }
  }

  // REASONING: Security and privacy concerns
  if (lowerQuery.includes('safe') || lowerQuery.includes('secure') || lowerQuery.includes('privacy') || lowerQuery.includes('scam') || lowerQuery.includes('fraud') || lowerQuery.includes('trust') || lowerQuery.includes('legitimate') || lowerQuery.includes('real')) {
    return {
      canResolve: true,
      response: `${greeting}, security is super important and I'm glad you're thinking about it! Let me put your mind at ease about safety here:

**Our Security Measures:**
• All payments are processed through secure, encrypted systems
• We verify vendors before they can sell on our platform
• Customer data is protected with industry-standard security
• We monitor for suspicious activity and fraudulent listings

**How to Stay Safe:**
• Always buy through our platform - don't do external transactions
• Check vendor ratings and reviews before purchasing
• Be cautious of deals that seem too good to be true
• Report suspicious listings or communications to us immediately

**Red Flags to Watch For:**
• Vendors asking you to pay outside the platform
• Extremely low prices on expensive items
• Poor grammar in product descriptions
• No vendor reviews or ratings

**Your Protection:**
• Purchase protection for qualifying transactions
• Dispute resolution process if something goes wrong
• Dedicated support team to investigate issues

Is there something specific that's making you concerned? I can help you evaluate whether it's legitimate.`,
      suggestedActions: [
        "Check vendor ratings and reviews carefully",
        "Report any suspicious activity to support",
        "Always complete transactions through our platform",
        "Tell me about any specific concerns you have"
      ]
    }
  }

  // REASONING: Mobile app and technical issues
  if (lowerQuery.includes('app') || lowerQuery.includes('mobile') || lowerQuery.includes('phone') || lowerQuery.includes('tablet') || lowerQuery.includes('browser') || lowerQuery.includes('website') || lowerQuery.includes('loading') || lowerQuery.includes('slow')) {
    return {
      canResolve: true,
      response: `${greeting}, technical issues can be really frustrating! Let me help you get everything running smoothly:

**Common Quick Fixes:**
• **Clear your browser cache and cookies** - this fixes 80% of issues
• **Try an incognito/private browsing window** - bypasses cache problems
• **Update your browser** - old versions can have compatibility issues
• **Check your internet connection** - slow connection = slow loading

**Mobile Specific:**
• **Restart the app** completely (close and reopen)
• **Update the app** from your app store
• **Restart your phone/tablet** if the app keeps crashing
• **Free up storage space** - full devices run slowly

**Browser Specific:**
• **Try a different browser** (Chrome, Firefox, Safari, Edge)
• **Disable browser extensions** temporarily to see if one is causing issues
• **Check if other websites work** to rule out internet problems

**Still having problems?**
Tell me exactly what's happening - what device, what browser, what specific error or issue you're seeing. The more details, the better I can help troubleshoot.

What specific technical issue are you running into?`,
      suggestedActions: [
        "Clear browser cache and cookies, then try again",
        "Test in an incognito/private browsing window",
        "Try a different browser or update your current one",
        "Describe the exact error or issue you're experiencing"
      ]
    }
  }

  // REASONING: Checkout and buying process issues
  if (lowerQuery.includes('checkout') || lowerQuery.includes('buy') || lowerQuery.includes('purchase') || lowerQuery.includes('cart') || lowerQuery.includes('add to cart') || lowerQuery.includes('order') && (lowerQuery.includes('how') || lowerQuery.includes('place'))) {
    return {
      canResolve: true,
      response: `${greeting}, I'd be happy to walk you through the buying process! It's actually pretty straightforward once you know the steps:

**How to Make a Purchase:**
1. **Find your item** - use search or browse categories
2. **Check details** - read description, check size/color options, reviews
3. **Add to cart** - click "Add to Cart" button
4. **Review cart** - click cart icon to see your items, adjust quantities
5. **Checkout** - click "Checkout" and enter shipping/payment info
6. **Confirm order** - review everything and click "Place Order"

**Common Checkout Issues:**
• **Cart won't update**: Try refreshing the page
• **Payment declined**: Check card details, expiration date, billing address
• **Shipping errors**: Verify your address is complete and correct
• **Items unavailable**: Some items may have sold out since you added them

**Before You Buy:**
• Read vendor reviews and product ratings
• Check shipping costs and delivery timeframes
• Verify return/exchange policies
• Make sure you're logged into your account

**Pro Tips:**
• Save items to favorites first to compare prices
• Check for discount codes or deals before checkout
• Consider buying from vendors closer to you for faster shipping

What specific part of the buying process are you having trouble with?`,
      suggestedActions: [
        "Make sure you're logged into your account",
        "Review your cart before proceeding to checkout",
        "Double-check your payment and shipping information",
        "Tell me exactly where in the process you're getting stuck"
      ]
    }
  }

  // REASONING: Conversational responses to casual greetings
  if (lowerQuery.includes('how are you') || lowerQuery.includes('how you doing') || lowerQuery.includes('whats up') || lowerQuery.includes("what's up") || lowerQuery.includes('how is it going') || lowerQuery.includes("how's it going")) {
    return {
      canResolve: true,
      response: `I'm doing great, thanks for asking ${greeting}! 😊 Just here helping customers like yourself navigate the marketplace. I'm actually having a good day - love solving problems and helping people find what they need.

How are YOU doing? More importantly, what brings you here today? Got any marketplace mysteries I can help solve for you?`,
      suggestedActions: [
        "Tell me what's going on with your order",
        "Ask me about any account issues",
        "Get help with something specific",
        "Just browse around and see what we have"
      ]
    }
  }

  // REASONING: Acknowledgments and casual responses
  if (lowerQuery.includes('okay') || lowerQuery.includes('ok') || lowerQuery.includes('alright') || lowerQuery.includes('cool') || lowerQuery.includes('thanks') || lowerQuery.includes('thank you')) {
    return {
      canResolve: true,
      response: `Great ${greeting}! I'm glad we're on the same page. Is there anything specific I can help you with while you're here? I'm pretty good at solving all sorts of marketplace puzzles - from tracking down orders to figuring out account stuff.`,
      suggestedActions: [
        "Ask about your current orders",
        "Get help with your account",
        "Learn about returns or exchanges",
        "Find out about selling on the platform"
      ]
    }
  }

  // REASONING: Intelligent greeting responses
  if (lowerQuery.includes('hi') || lowerQuery.includes('hello') || lowerQuery.includes('hey') || lowerQuery.trim() === '') {
    return {
      canResolve: true,
      response: `Hi ${greeting}! Good to see you. I'm here and ready to help with whatever you need. Are you dealing with an order, have questions about your account, or maybe looking into something else? Just let me know what's going on.`,
      suggestedActions: [
        "Tell me about your order status",
        "Ask about account issues", 
        "Get help with returns or refunds",
        "Learn about becoming a seller"
      ]
    }
  }

  // REASONING: General troubleshooting with intelligent inference
  if (lowerQuery.includes('not working') || lowerQuery.includes("doesn't work") || lowerQuery.includes('broken') || lowerQuery.includes('issue') || lowerQuery.includes('problem') || lowerQuery.includes('error')) {
    return {
      canResolve: true,
      response: `I can definitely help you troubleshoot this, ${greeting}! When something's not working right, it can be really frustrating, so let's figure out what's going on.

To give you the best help, I need to understand exactly what's happening:

**What specifically isn't working?**
• Is it a page that won't load?
• A button that doesn't respond?
• An error message you're seeing?
• Something with your order or account?

**When did this start happening?**
• Just now, or has it been going on for a while?
• Was it working before and suddenly stopped?

**What were you trying to do when it broke?**
• Placing an order, checking account, browsing products?

The more details you can give me, the faster I can help you get it fixed. In the meantime, try refreshing the page or clearing your browser cache - sometimes that resolves weird glitches immediately.

What exactly is giving you trouble?`,
      suggestedActions: [
        "Describe exactly what's not working",
        "Tell me when the problem started",
        "Try refreshing the page or clearing cache",
        "Share any error messages you're seeing"
      ]
    }
  }
  
  // Smart return and refund assistance
  if (lowerQuery.includes('return') || lowerQuery.includes('refund') || lowerQuery.includes('exchange')) {
    return {
      canResolve: true,
      response: `${greeting}, returns can definitely be a bit confusing since every vendor has their own policies, but I can help you navigate this.

The general rule is you have a 30-day window from when you receive something, but here's what makes it tricky - each seller sets their own specific terms. Some are super flexible, others are more strict about condition requirements.

Your best move is to check the return policy on the original product page first - it should spell out exactly what that specific vendor accepts. Keep all your packaging and receipts handy because most vendors will want the item in original condition.

If the return policy seems reasonable for your situation, reach out to the vendor directly through their store page. They're usually pretty responsive since their reputation depends on good customer service.

What's the situation with your item? Is it damaged, not what you expected, or just not the right fit? That might change the approach.`,
      suggestedActions: [
        "Check the specific return policy on the product page",
        "Contact the vendor through their store page",
        "Keep original packaging and receipt ready",
        "Tell me more about why you need to return it"
      ]
    }
  }

  // Advanced account and login support
  if (lowerQuery.includes('login') || lowerQuery.includes('password') || lowerQuery.includes('account') || lowerQuery.includes('sign in')) {
    return {
      canResolve: true,
      response: `Account issues are always annoying, ${greeting} - let's get you back in there quickly.

The most common fix is a password reset using the 'Forgot Password' link on the login page. Sometimes people try to log in with the wrong email (especially if you have multiple accounts), so double-check that too.

If the reset email doesn't show up in a few minutes, check your spam folder - password reset emails sometimes get flagged. Also, if you're using an older browser or have strict privacy settings, that can sometimes cause issues.

Quick troubleshooting: try clearing your browser cache and cookies, or just open an incognito/private window and try logging in there. If that works, it's definitely a browser cache issue.

What exactly is happening when you try to log in? Are you getting an error message, or is it just not accepting your password?`,
      suggestedActions: [
        "Try the 'Forgot Password' reset process",
        "Check your spam folder for reset emails", 
        "Clear browser cache and try again",
        "Try logging in with an incognito window"
      ]
    }
  }

  // Intelligent payment and billing support  
  if (lowerQuery.includes('payment') || lowerQuery.includes('card') || lowerQuery.includes('charged') || lowerQuery.includes('billing')) {
    return {
      canResolve: true,
      response: `Payment stuff can be stressful, ${greeting}, so let me help you figure out what's going on.

We use secure payment processing, and it typically takes 1-2 business days for charges to show up on your statement. The charge will usually show up from the payment processor rather than the individual vendor name, which can be confusing.

If you're seeing a charge you don't recognize, first check your order history in your account - it might be from a purchase you forgot about or a subscription renewal. The order details will show you exactly what was charged and when.

We accept all major credit cards, PayPal, and other secure payment methods. If your card was declined, it's usually either insufficient funds, an expired card, or your bank flagging it as suspicious (which happens with new merchants sometimes).

What specific payment issue are you running into? Is it a charge you don't recognize, a declined payment, or something else?`,
      suggestedActions: [
        "Check your order history for recent purchases",
        "Verify your payment method details are current", 
        "Contact your bank if charges were declined",
        "Review your account settings for saved payment info"
      ]
    }
  }

  // Comprehensive seller program guidance
  if (lowerQuery.includes('sell') || lowerQuery.includes('vendor') || lowerQuery.includes('become seller') || lowerQuery.includes('store')) {
    return {
      canResolve: true,
      response: `Thinking about selling? That's awesome, ${greeting}! The seller program here is actually pretty straightforward, and I can walk you through what's involved.

You'll start by hitting the 'Become a Seller' page where you'll fill out an application with basic business info - nothing too scary, just stuff like what you want to sell, your business details (or personal info if you're just starting out), and some verification documents.

The approval process usually takes 1-3 business days. They're mainly checking that you're legitimate and that what you want to sell fits with the marketplace guidelines.

Once you're approved, you'll get access to your seller dashboard where you can list products, manage orders, track your sales, and handle customer communications. There's a commission structure (they take a small percentage of sales), but that's pretty standard for marketplaces.

The cool thing is you can start small and scale up - lots of successful sellers here started with just a few products to test the waters.

What kind of products are you thinking about selling? That might help me give you more specific advice about getting started.`,
      suggestedActions: [
        "Visit the 'Become a Seller' application page",
        "Prepare your business documentation",
        "Research similar products on the platform",
        "Tell me about what you want to sell"
      ]
    }
  }

  // REASONING: Specific order status and delivery queries
  if (lowerQuery.includes('active deliveries') || lowerQuery.includes('current orders') || lowerQuery.includes('orders in transit') || lowerQuery.includes('what orders') || lowerQuery.includes('my orders') || lowerQuery.includes('pending orders') || lowerQuery.includes('shipped orders')) {
    return {
      canResolve: true,
      response: `${greeting}, I can help you check what's being delivered to you right now! 

Here's how to see your active deliveries:

1. Click on your profile icon (top right corner)
2. Select "My Orders" 
3. Look for any orders that say "Shipped" or "On the way"

Those are your active deliveries! Each one will show you:
- What you ordered
- When it should arrive
- A tracking number you can click to see where it is right now

If you see "Processing" that means the seller is still getting your order ready - it hasn't shipped yet.

Want me to explain anything else about tracking your orders?`,
      suggestedActions: [
        "Go to My Orders in your account",
        "Click on any shipped order to track it",
        "Check your email for shipping updates",
        "Ask me about a specific order if you're worried"
      ]
    }
  }

  // REASONING: Gift orders and special occasions
  if (lowerQuery.includes('gift') || lowerQuery.includes('present') || lowerQuery.includes('birthday') || lowerQuery.includes('holiday') || lowerQuery.includes('christmas') || lowerQuery.includes('valentine') || lowerQuery.includes('gift wrap') || lowerQuery.includes('gift message')) {
    return {
      canResolve: true,
      response: `${greeting}, gift orders are always special! Let me help you make sure your gift arrives perfectly and on time.

**Gift Order Options:**
• **Gift wrapping** - many vendors offer this service (check during checkout)
• **Gift messages** - add personal notes during the order process
• **Different shipping address** - send directly to the recipient
• **Gift receipts** - prices hidden, easy returns for recipient

**Timing Your Gift:**
• **Order early** - especially during holidays when shipping is slower
• **Check vendor location** - closer vendors = faster delivery
• **Express shipping** - available from many vendors for rush gifts
• **Delivery confirmation** - know exactly when it arrives

What kind of gift are you planning, and when do you need it delivered?`,
      suggestedActions: [
        "Check vendor gift wrapping and messaging options",
        "Verify shipping address and delivery timing",
        "Consider express shipping for time-sensitive gifts",
        "Tell me about the occasion and timing you need"
      ]
    }
  }

  // REASONING: Business and bulk orders
  if (lowerQuery.includes('bulk') || lowerQuery.includes('wholesale') || lowerQuery.includes('business') || lowerQuery.includes('large order') || lowerQuery.includes('quantity discount') || lowerQuery.includes('volume pricing')) {
    return {
      canResolve: true,
      response: `${greeting}, excellent question about bulk and business ordering! Many vendors offer quantity discounts and special business terms.

**How Bulk Orders Work:**
• Each vendor sets their own quantity discount rules
• Some offer automatic discounts at checkout for large quantities
• Others require you to contact them directly for bulk pricing
• Business accounts sometimes get better volume pricing

**Tips for Large Orders:**
• **Contact the vendor first** - they might offer better pricing than listed
• **Ask about shipping** - bulk orders often qualify for free shipping
• **Confirm inventory** - make sure they have enough stock
• **Negotiate terms** - payment terms, delivery schedules

What kind of bulk order are you planning? I can give you more specific advice based on your needs.`,
      suggestedActions: [
        "Contact the vendor directly for bulk pricing quotes",
        "Check product pages for quantity discount information",
        "Ask about business account benefits",
        "Tell me what products and quantities you need"
      ]
    }
  }

  // REASONING: International and special shipping
  if (lowerQuery.includes('international') || lowerQuery.includes('overseas') || lowerQuery.includes('ship abroad') || lowerQuery.includes('different country') || lowerQuery.includes('customs') || lowerQuery.includes('global')) {
    return {
      canResolve: true,
      response: `${greeting}, international shipping requires some extra planning, but I can guide you through it!

**International Shipping Basics:**
• Not all vendors ship internationally - check each vendor's policies
• Shipping times are longer (typically 1-3 weeks)
• Additional costs include customs duties and international fees
• Some countries have restrictions on certain products

**Before Ordering Internationally:**
• **Check vendor's international policy** on their store page
• **Verify shipping costs** before completing checkout
• **Research import restrictions** for your country
• **Understand return policies** - returning internationally is expensive

What country are you shipping to? I can give you more specific guidance!`,
      suggestedActions: [
        "Check if your desired vendors ship to your country",
        "Research customs duties for your specific products",
        "Verify your international address format is correct",
        "Tell me your destination country for specific advice"
      ]
    }
  }

  // Default intelligent response for any other query
  return {
    canResolve: true,
    response: `${greeting}, I'd love to help you out! I can tell you want assistance with something, and I'm here to provide exactly the guidance you need.

I'm pretty comprehensive at helping with orders, deliveries, account issues, returns, payments, vendor questions, technical problems, and marketplace navigation. I can also help with special situations like gifts, bulk orders, international shipping, and more.

What's the specific situation you're dealing with? The more details you can give me, the better I can tailor my advice to your exact needs.`,
    suggestedActions: [
      "Describe your specific issue in detail",
      "Tell me what you were trying to accomplish", 
      "Ask about any aspect of the marketplace",
      "Let me know what kind of help you need"
    ]
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