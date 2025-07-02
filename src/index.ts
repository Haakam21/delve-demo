import 'dotenv/config'

import { AgentMailClient } from 'agentmail'
import OpenAI from 'openai'
import express, { Request, Response } from 'express'

const INBOX_USERNAME = 'soc2test'

const inboxId = `${INBOX_USERNAME}@agentmail.to`

const agentmail = new AgentMailClient()

agentmail.inboxes.create({
    username: INBOX_USERNAME,
    clientId: 'soc2test-inbox',
})

agentmail.webhooks.create({
    url: 'https://delve-demo.onrender.com/receive',
    inboxIds: [inboxId],
    eventTypes: ['message.received'],
    clientId: 'soc2test-webhook',
})

const openai = new OpenAI()

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/', async (req: Request, res: Response) => {
    const threads = await agentmail.inboxes.threads.list(inboxId)

    const threadHtml = threads.threads?.map((thread) => {
        const attachmentHtml = thread.attachments?.map((attachment) => {
            return `<a href="threads/${thread.threadId}/attachments/${attachment.attachmentId}" target="_blank">${attachment.filename}</a>`
        })

        return `<div>
          <b>Timestamp:</b> ${thread.timestamp.toLocaleString()}<br>
          <b>Subject:</b> ${thread.subject}<br>
          <b>Preview:</b> ${thread.preview}...<br>
          <b>Message Count:</b> ${thread.messageCount}<br>
          <b>Attachments:</b> ${attachmentHtml ? attachmentHtml.join('\t') : 'None'}<br>
        </div>`
    })

    const formHtml = `<form action="/send" method="post">
      <h3>Trigger Agent</h3>
      <input type="email" name="to" placeholder="To" />
      <input type="email" name="cc" placeholder="Cc" />
      <button type="submit">Send</button>
    </form>`

    const html = `<div>
      <h2>${inboxId}</h2>
      ${formHtml}<br>
      ${threadHtml?.join('<br>')}
    </div>`

    res.send(html)
})

app.get('/threads/:threadId/attachments/:attachmentId', async (req: Request, res: Response) => {
    const { threadId, attachmentId } = req.params

    const attachment = await agentmail.inboxes.threads.getAttachment(inboxId, threadId, attachmentId)

    attachment.pipe(res)
})

app.post('/send', async (req: Request, res: Response) => {
    const { to, cc } = req.body

    await agentmail.inboxes.messages.send(inboxId, {
        to,
        cc,
        subject: 'SOC 2 Report Request',
        text: 'Hello,\n\nWe would like to request a SOC 2 report. Please let us know the next steps.\n\nBest,\nAgentMail',
    })

    res.redirect('/')
})

app.post('/receive', async (req: Request, res: Response) => {
    const { message } = req.body

    const thread = await agentmail.inboxes.threads.get(inboxId, message.thread_id)

    const response = await openai.responses.create({
        model: 'gpt-4o',
        instructions: `
        You are an email assistant. Your email address is ${inboxId}.
        Your task is to get a SOC 2 report from a company on behalf of the user.

        You have already sent an email to the company requestion the SOC 2 report.
        You will be given the email thread when the company has responded.

        If the company has provided the SOC 2 report, thank them for their response.
        If the company has not provided the SOC 2 report, inform them you will loop in the team for next steps.

        Respond in plain text as if you are writing an email.
        In the email signature, refer to yourself as "AgentMail".

        Do not specify the email subject, only the email body.
        Do not include any other text in your response.
        `,
        input: JSON.stringify(thread),
    })

    await agentmail.inboxes.messages.reply(inboxId, message.message_id, {
        text: response.output_text,
    })

    res.send('OK')
})

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
})
