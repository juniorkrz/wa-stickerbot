import { Configuration, CreateCompletionRequest, OpenAIApi } from 'openai'

const org = process.env.OPENAI_API_ORG
const key = process.env.OPENAI_API_KEY

export const ask = async (question: string) => {
  if (org && key) {
    const completionRequest: CreateCompletionRequest = {
      model: 'text-davinci-003',
      prompt: `//Human readable\nQ: ${question}\nA:`,
      stop: '\n',
      temperature: 0.25,
      max_tokens: 1024,
      frequency_penalty: 1
    }
    const configuration = new Configuration({
      organization: org,
      apiKey: key
    })
    const openai = new OpenAIApi(configuration)
    const aiResponse = await openai.createCompletion(completionRequest)
    console.log(aiResponse)
    const choices = aiResponse.data.choices
    if (aiResponse) {
      return choices[0].text
    }
    return '👎'
  }
}
