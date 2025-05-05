import axios from 'axios'

export async function checkSubscriptionStatus(userId: string): Promise<boolean> {
  try {
    const response = await axios.post('https://www.interviewspeaker.co/api/check-plan-status', {
      user_id: userId
    })
    const active = response.data.active
    return active
  } catch (error) {
    console.error('Failed to check subscription status:', error)
    return false
  }
}
