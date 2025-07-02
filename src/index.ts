import 'dotenv/config'

import express, { Request, Response } from 'express'
import { AgentMail, AgentMailClient } from 'agentmail'

const INBOX_USERNAME = 'soc2test'

const inboxId = `${INBOX_USERNAME}@agentmail.to`

const client = new AgentMailClient()

client.inboxes.create({
    username: INBOX_USERNAME,
    clientId: 'soc2test-inbox',
})

client.webhooks.create({
    url: 'https://delve-demo.onrender.com/receive',
    inboxIds: [inboxId],
    eventTypes: ['message.received'],
    clientId: 'soc2test-webhook',
})

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/', async (req: Request, res: Response) => {
    const threads = await client.inboxes.threads.list(inboxId)

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
      <input type="email" name="email" placeholder="Email" />
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
    const attachment = await client.inboxes.threads.getAttachment(inboxId, threadId, attachmentId)
    attachment.pipe(res)
})

app.post('/send', async (req: Request, res: Response) => {
    const { email } = req.body

    await client.inboxes.messages.send(inboxId, {
        to: email,
        subject: 'SOC 2 Report Request',
        text: 'Hello,\n\nWe would like to request a SOC 2 report. Please let us know the next steps.\n\nBest,\nAgentMail',
    })

    res.redirect('/')
})

app.post('/receive', async (req: Request, res: Response) => {
    const message = req.body.message as AgentMail.Message
    console.log(message)
    res.send('OK')
})

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
})
