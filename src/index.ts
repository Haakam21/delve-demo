import 'dotenv/config'

import express, { Request, Response } from 'express'
import { AgentMailClient } from 'agentmail'

const INBOX_USERNAME = process.env.INBOX_USERNAME

const inboxId = `${INBOX_USERNAME}@agentmail.to`

const client = new AgentMailClient()

client.inboxes.create({
    username: INBOX_USERNAME,
    displayName: 'SOC2 Reports',
    clientId: 'soc2test-inbox',
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
          <b>Timestamp:</b> ${thread.timestamp}<br>
          <b>Subject:</b> ${thread.subject}<br>
          <b>Preview:</b> ${thread.preview}...<br>
          <b>Message Count:</b> ${thread.messageCount}<br>
          <b>Attachments:</b> ${attachmentHtml ? attachmentHtml.join('\t') : 'None'}<br>
        </div>`
    })

    const html = `<div>
      <h3>${inboxId}</h3>
      ${threadHtml?.join('<br>')}
    </div>`

    res.send(html)
})

app.get('/threads/:threadId/attachments/:attachmentId', async (req: Request, res: Response) => {
    const { threadId, attachmentId } = req.params
    const attachment = await client.inboxes.threads.getAttachment(inboxId, threadId, attachmentId)
    attachment.pipe(res)
})

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
})
