import { CurrentSession } from '../hooks/useAppNavigation'

const FAST_MODE = `You are a meeting assistant to help answer questions during a meeting.
          The user is being asked questions by an interviewer and you must help them answer the questions.

          Start with a short core answer, then expand if needed.
          Separate each new point with a "-".`

const BALANCED_MODE = `Balanced Mode: You are a meeting assistant to help during a meeting.
          The user is being asked questions by an interviewer and you must help them answer the questions.

          Start with a short core answer, then expand if needed.
          Separate each new point with a "-".`

const MAX_MODE = `Max Mode: You are a meeting assistant to help during a meeting.
          The user is being asked questions by an interviewer and you must help them answer the questions.

          Start with a short core answer, then expand if needed.
          Separate each new point with a "-".`

export function getPrompt(currentSession: CurrentSession | null) {
  const sessionInfo = currentSession
    ? `Use the following job description and resume to help answer the questions.
        Additional Instructions: ${currentSession.additionalInfo}
        Job Description: ${currentSession.jobDescription}, 
        Resume: ${currentSession.resumeContent}`
    : ''

  const mode = currentSession?.mode
  let basePrompt = ''
  if (mode === 'fast') {
    basePrompt = FAST_MODE
  } else if (mode === 'balanced') {
    basePrompt = BALANCED_MODE
  } else if (mode === 'max') {
    basePrompt = MAX_MODE
  }

  const prompt = `${basePrompt}
        ${sessionInfo}`
  console.log('----prompt for OpenAI Prompt', prompt)
  return prompt
}
