interface TransferRecipientResponse {
  success: boolean
  recipientCode?: string
  message?: string
  raw?: any
}

interface InitiateTransferResponse {
  success: boolean
  transferCode?: string
  status?: string
  message?: string
  raw?: any
}

const PAYSTACK_BASE_URL = 'https://api.paystack.co'

const TRANSFER_REFERENCE_PATTERN = /^[a-z0-9_-]{16,50}$/

const getPaystackSecret = () => {
  const key = (process.env.PAYSTACK_SECRET_KEY || '').trim()
  if (!key || !key.startsWith('sk_')) {
    throw new Error('PAYSTACK_SECRET_KEY missing or invalid')
  }
  return key
}

export async function createTransferRecipient(params: {
  name: string
  accountNumber: string
  bankCode: string
}): Promise<TransferRecipientResponse> {
  try {
    const secret = getPaystackSecret()

    const response = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: params.name,
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        currency: 'NGN',
      }),
    })

    const result = await response.json()
    if (result?.status && result?.data?.recipient_code) {
      return {
        success: true,
        recipientCode: result.data.recipient_code,
        raw: result,
      }
    }

    return {
      success: false,
      message: result?.message || 'Unable to create transfer recipient',
      raw: result,
    }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Unable to create transfer recipient',
    }
  }
}

export async function initiateTransfer(params: {
  amount: number
  recipientCode: string
  reference: string
  reason: string
}): Promise<InitiateTransferResponse> {
  try {
    const reference = String(params.reference || '').trim()
    if (!TRANSFER_REFERENCE_PATTERN.test(reference)) {
      return {
        success: false,
        message: 'Transfer reference must be 16-50 chars and contain only lowercase letters, digits, hyphens, or underscores',
      }
    }

    const secret = getPaystackSecret()

    const response = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(params.amount * 100),
        recipient: params.recipientCode,
        reason: params.reason,
        reference,
      }),
    })

    const result = await response.json()
    if (result?.status && result?.data?.transfer_code) {
      return {
        success: true,
        transferCode: result.data.transfer_code,
        status: String(result.data.status || '').toLowerCase(),
        raw: result,
      }
    }

    return {
      success: false,
      message: result?.message || 'Unable to initiate bank transfer',
      raw: result,
    }
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Unable to initiate bank transfer',
    }
  }
}
