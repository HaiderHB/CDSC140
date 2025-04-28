import axios from 'axios'

export async function checkSubscriptionStatus(userId: string): Promise<boolean> {
  return true
  try {
    const response = await axios.post('https://interviewspeaker.co/check-user-status', {
      user_id: userId
    })
    const status = response.data.status
    return status === 'active' || status === 'on_hold'
  } catch (error) {
    console.error('Failed to check subscription status:', error)
    return false
  }
}
