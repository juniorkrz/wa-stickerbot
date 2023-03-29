import { Configuration, CreateCompletionRequest, OpenAIApi } from 'openai'
import { Bard } from 'googlebard'

const bardCookie = process.env.BARD_COOKIE

const org = process.env.OPENAI_API_ORG
const key = process.env.OPENAI_API_KEY
const base = process.env.OPENAI_API_BASE

export const ask = async (question: string, sender: string = '') => {
  if (bardCookie) {
    const bot = new Bard(bardCookie)
    const response = await bot.ask(question, sender)
    return response
  }
  else if (org && key) {
    const completionRequest: CreateCompletionRequest = {
      model: 'code-davinci-002',
      prompt: question,
      stop: '\n',
      top_p: 0.25,
      max_tokens: 1024,
      frequency_penalty: 1,
      presence_penalty: 1,
      n: 5
    }
    const configuration = new Configuration({
      organization: org,
      apiKey: key,
      basePath: base
    })
    const openai = new OpenAIApi(configuration)
    const aiResponse = await openai.createCompletion(completionRequest)
    const choices = aiResponse.data.choices
    return (
      choices.reduce((prev, choice) => {
        const choiceLength = choice.text ? choice.text.length : 0
        const accLength = prev.text ? prev.text.length : 0
        if (choiceLength > accLength) {
          return choice
        } else {
          return prev
        }
      }).text || '👎'
    )
  }
}
